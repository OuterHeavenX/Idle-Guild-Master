import { applyCritical, rollCritical } from '../math/CombatMath';
import type { Hero } from '../models/Hero';
import type { Party } from '../models/Party';
import { EventBus } from '../core/EventBus';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  clampMagnitude,
  distanceBetween,
  facingDot,
  moveCircleWithWallSlide,
  normalized,
  softlySeparateCircles,
  type Vec2,
} from './combat/ArenaCollision';
import {
  SOLO_COMBAT_BALANCE,
  aldricAttackDamage,
  encounterRewards,
  ghoulAttackDamage,
  soloEnemyStatsFor,
  zoneClearRewards,
} from './combat/CombatBalance';

export type CombatPhase = 'inactive' | 'fighting' | 'between' | 'defeat' | 'victory';
export type PlayerCombatAction =
  | 'idle'
  | 'move'
  | 'attack-windup'
  | 'attack-active'
  | 'attack-recovery'
  | 'block'
  | 'down';
export type EnemyCombatAction = 'spawn' | 'approach' | 'telegraph' | 'strike' | 'recovery' | 'dead';

export interface DungeonCombatCheckpoint {
  zoneLevel: number;
  completedEncounters: number;
  rewardedEncounters: number[];
  completed: boolean;
  victoryRewarded: boolean;
}

/** Accepts the persisted StateManager CryptSave aliases during the V2 migration. */
export type DungeonCombatCheckpointInput = Partial<DungeonCombatCheckpoint> & {
  encounterIndex?: number;
  objectiveComplete?: boolean;
};

/** Compatibility shape retained for existing HUD and outer wiring during integration. */
export interface Enemy {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  defense: number;
  attack: number;
  burnTicks: number;
  frozenTicks: number;
  threat: Map<string, number>;
}

interface EnemyRuntime extends Enemy {
  position: Vec2;
  facing: Vec2;
  action: EnemyCombatAction;
  actionElapsed: number;
  actionDuration: number;
  strikeApplied: boolean;
  hurtTimer: number;
}

export interface CombatSnapshot {
  active: boolean;
  phase: CombatPhase;
  arena: { width: number; height: number };
  zoneLevel: number;
  encounter: number;
  totalEncounters: number;
  completedEncounters: number;
  player: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    position: Vec2;
    facing: Vec2;
    action: PlayerCombatAction;
    actionProgress: number;
    moving: boolean;
    blocking: boolean;
    guard: number;
    maxGuard: number;
    guardBroken: boolean;
    hurt: boolean;
  };
  enemy: {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    position: Vec2;
    facing: Vec2;
    action: EnemyCombatAction;
    actionProgress: number;
    hurt: boolean;
  };
  canRetry: boolean;
  canLeave: boolean;
  victory: boolean;
  checkpoint: DungeonCombatCheckpoint;
}

export type CombatEvent =
  | { type: 'enter'; snapshot: CombatSnapshot }
  | { type: 'leave'; checkpoint: DungeonCombatCheckpoint }
  | { type: 'player-action'; action: PlayerCombatAction }
  | { type: 'enemy-action'; action: EnemyCombatAction }
  | { type: 'enemy-spawn'; enemyId: string; encounter: number }
  | { type: 'damage'; sourceId: string; targetId: string; amount: number; crit: boolean; blocked: boolean }
  | { type: 'guard-break' }
  | { type: 'enemy-death'; enemyId: string; encounter: number }
  | { type: 'defeat' }
  | { type: 'retry' }
  | { type: 'victory'; checkpoint: DungeonCombatCheckpoint }
  | { type: 'checkpoint'; checkpoint: DungeonCombatCheckpoint };

type CombatListener = (event: CombatEvent) => void;

const PLAYER_START: Vec2 = { x: 108, y: 590 };
const ENEMY_STARTS: readonly Vec2[] = [
  { x: 323, y: 391 },
  { x: 335, y: 474 },
  { x: 302, y: 367 },
];

const actionDurationForPlayer = (action: PlayerCombatAction): number => {
  if (action === 'attack-windup') return SOLO_COMBAT_BALANCE.playerAttackWindup;
  if (action === 'attack-active') return SOLO_COMBAT_BALANCE.playerAttackActive;
  if (action === 'attack-recovery') return SOLO_COMBAT_BALANCE.playerAttackRecovery;
  return 0;
};

const makeId = (): string => globalThis.crypto?.randomUUID?.()
  ?? `crypt-ghoul-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export class CombatSystem {
  private hero?: Hero;
  private zoneLevel = 1;
  private active = false;
  private phase: CombatPhase = 'inactive';
  private accumulator = 0;
  private encounterIndex = 0;
  private completedEncounters = 0;
  private rewardedEncounters = new Set<number>();
  private victoryRewarded = false;
  private betweenTimer = 0;

  private playerPosition: Vec2 = { ...PLAYER_START };
  private playerFacing: Vec2 = { x: 1, y: -0.1 };
  private moveInput: Vec2 = { x: 0, y: 0 };
  private attackQueued = false;
  private blockHeld = false;
  private playerAction: PlayerCombatAction = 'idle';
  private playerActionElapsed = 0;
  private playerAttackApplied = false;
  private playerHurtTimer = 0;
  private guard: number = SOLO_COMBAT_BALANCE.maxGuard;
  private guardRegenDelay = 0;
  private guardBreakTimer = 0;

  private enemy: EnemyRuntime = this.makeEnemy(0, 1);
  private listeners = new Set<CombatListener>();

  constructor(private bus: EventBus, private rng: () => number = Math.random) {}

  subscribe(listener: CombatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enter(hero: Hero, checkpoint: DungeonCombatCheckpointInput = {}): CombatSnapshot {
    this.hero = hero;
    this.zoneLevel = Math.max(1, Math.floor(checkpoint.zoneLevel ?? this.zoneLevel));
    this.completedEncounters = Math.max(
      0,
      Math.min(
        SOLO_COMBAT_BALANCE.totalEncounters,
        Math.floor(checkpoint.completedEncounters ?? checkpoint.encounterIndex ?? this.completedEncounters),
      ),
    );
    this.rewardedEncounters = new Set(
      (checkpoint.rewardedEncounters ?? [...this.rewardedEncounters])
        .map((entry) => Math.floor(entry))
        .filter((entry) => entry >= 0 && entry < SOLO_COMBAT_BALANCE.totalEncounters),
    );
    this.victoryRewarded = checkpoint.victoryRewarded ?? this.victoryRewarded;
    this.encounterIndex = Math.min(this.completedEncounters, SOLO_COMBAT_BALANCE.totalEncounters - 1);
    this.active = true;
    this.accumulator = 0;
    this.resetTransientInput();
    this.playerPosition = { ...PLAYER_START };
    this.playerFacing = { x: 1, y: -0.1 };
    this.guard = SOLO_COMBAT_BALANCE.maxGuard;
    this.guardBreakTimer = 0;
    this.guardRegenDelay = 0;
    this.playerHurtTimer = 0;

    const complete = Boolean(checkpoint.completed ?? checkpoint.objectiveComplete)
      || this.completedEncounters >= SOLO_COMBAT_BALANCE.totalEncounters;
    if (complete) {
      this.completedEncounters = SOLO_COMBAT_BALANCE.totalEncounters;
      this.phase = 'victory';
      this.enemy = this.makeEnemy(SOLO_COMBAT_BALANCE.totalEncounters - 1, this.zoneLevel);
      this.enemy.hp = 0;
      this.setEnemyAction('dead', SOLO_COMBAT_BALANCE.enemyDeathDuration);
    } else {
      this.phase = hero.alive ? 'fighting' : 'defeat';
      this.spawnEnemy();
      if (!hero.alive) this.setPlayerAction('down');
    }

    const snapshot = this.snapshot;
    this.emit({ type: 'enter', snapshot });
    return snapshot;
  }

  leave(): DungeonCombatCheckpoint {
    const checkpoint = this.checkpoint;
    if (!this.active && this.phase === 'inactive') return checkpoint;
    this.active = false;
    this.phase = 'inactive';
    this.accumulator = 0;
    this.resetTransientInput();
    this.emit({ type: 'leave', checkpoint });
    return checkpoint;
  }

  clear(): void {
    this.leave();
    this.hero = undefined;
    this.zoneLevel = 1;
    this.encounterIndex = 0;
    this.completedEncounters = 0;
    this.rewardedEncounters.clear();
    this.victoryRewarded = false;
    this.playerPosition = { ...PLAYER_START };
    this.guard = SOLO_COMBAT_BALANCE.maxGuard;
    this.enemy = this.makeEnemy(0, 1);
  }

  setMove(x: number, y: number): void {
    this.moveInput = clampMagnitude({
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    });
  }

  requestAttack(): boolean {
    if (!this.active || this.phase !== 'fighting' || !this.hero?.alive) return false;
    this.attackQueued = true;
    return true;
  }

  setBlock(active: boolean): void {
    this.blockHeld = Boolean(active) && this.active && this.phase === 'fighting';
  }

  retry(): boolean {
    if (!this.active || this.phase !== 'defeat' || !this.hero) return false;
    const restored = this.hero.stats.maxHp - this.hero.currentHp;
    this.hero.heal(this.hero.stats.maxHp);
    if (restored > 0) this.bus.emit('combat:heal', { sourceId: 'crypt-retry', targetId: this.hero.id, amount: restored });
    this.guard = SOLO_COMBAT_BALANCE.maxGuard;
    this.guardBreakTimer = 0;
    this.guardRegenDelay = 0;
    this.playerHurtTimer = 0;
    this.playerPosition = { ...PLAYER_START };
    this.playerFacing = { x: 1, y: -0.1 };
    this.phase = 'fighting';
    this.accumulator = 0;
    this.resetTransientInput();
    this.setPlayerAction('idle');
    this.spawnEnemy();
    this.bus.emit('combat:party-recovered', { zoneLevel: this.zoneLevel });
    this.emit({ type: 'retry' });
    return true;
  }

  update(dt: number): void {
    if (!this.active || (this.phase !== 'fighting' && this.phase !== 'between')) return;
    const frame = Math.max(0, Math.min(SOLO_COMBAT_BALANCE.maxFrameDelta, Number.isFinite(dt) ? dt : 0));
    this.accumulator += frame;
    let steps = 0;
    while (this.accumulator >= SOLO_COMBAT_BALANCE.fixedStep && steps < SOLO_COMBAT_BALANCE.maxSimulationSteps) {
      this.step(SOLO_COMBAT_BALANCE.fixedStep);
      this.accumulator -= SOLO_COMBAT_BALANCE.fixedStep;
      steps += 1;
    }
    if (steps >= SOLO_COMBAT_BALANCE.maxSimulationSteps) this.accumulator = 0;
  }

  get snapshot(): CombatSnapshot {
    const hero = this.hero;
    const playerDuration = actionDurationForPlayer(this.playerAction);
    return {
      active: this.active,
      phase: this.phase,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      zoneLevel: this.zoneLevel,
      encounter: Math.min(SOLO_COMBAT_BALANCE.totalEncounters, this.encounterIndex + 1),
      totalEncounters: SOLO_COMBAT_BALANCE.totalEncounters,
      completedEncounters: this.completedEncounters,
      player: {
        id: hero?.id ?? 'hero-1',
        name: hero?.name ?? 'Aldric',
        hp: hero?.currentHp ?? 0,
        maxHp: hero?.stats.maxHp ?? 120,
        position: { ...this.playerPosition },
        facing: { ...this.playerFacing },
        action: this.phase === 'defeat' ? 'down' : this.playerAction,
        actionProgress: playerDuration > 0 ? Math.min(1, this.playerActionElapsed / playerDuration) : 0,
        moving: Math.hypot(this.moveInput.x, this.moveInput.y) > 0.08,
        blocking: this.isBlocking(),
        guard: this.guard,
        maxGuard: SOLO_COMBAT_BALANCE.maxGuard,
        guardBroken: this.guardBreakTimer > 0,
        hurt: this.playerHurtTimer > 0,
      },
      enemy: {
        id: this.enemy.id,
        name: this.enemy.name,
        level: this.enemy.level,
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        position: { ...this.enemy.position },
        facing: { ...this.enemy.facing },
        action: this.enemy.action,
        actionProgress: this.enemy.actionDuration > 0
          ? Math.min(1, this.enemy.actionElapsed / this.enemy.actionDuration)
          : 0,
        hurt: this.enemy.hurtTimer > 0,
      },
      canRetry: this.active && this.phase === 'defeat',
      canLeave: this.active,
      victory: this.phase === 'victory',
      checkpoint: this.checkpoint,
    };
  }

  get checkpoint(): DungeonCombatCheckpoint {
    return {
      zoneLevel: this.zoneLevel,
      completedEncounters: this.completedEncounters,
      rewardedEncounters: [...this.rewardedEncounters].sort((a, b) => a - b),
      completed: this.completedEncounters >= SOLO_COMBAT_BALANCE.totalEncounters,
      victoryRewarded: this.victoryRewarded,
    };
  }

  get currentEnemy(): Readonly<Enemy> { return this.enemy; }
  get wave(): number { return Math.min(SOLO_COMBAT_BALANCE.totalEncounters, this.encounterIndex + 1); }
  get cleared(): number { return this.completedEncounters; }
  get canAdvanceZone(): boolean { return this.phase === 'victory'; }
  get recovering(): boolean { return this.phase === 'defeat'; }

  /**
   * Legacy integration shim. Party auto-combat is deliberately disabled; the outer
   * frame loop must call update(dt) exactly once for authoritative solo combat.
   */
  tick(_party: Party, zoneLevel: number): void {
    this.zoneLevel = Math.max(1, Math.floor(zoneLevel || 1));
  }

  /** Compatibility reset used by existing navigation until location wiring is replaced. */
  resetEnemy(zoneLevel: number, resetWave = false): void {
    this.zoneLevel = Math.max(1, Math.floor(zoneLevel || 1));
    if (resetWave) {
      this.completedEncounters = 0;
      this.encounterIndex = 0;
      this.rewardedEncounters.clear();
      this.victoryRewarded = false;
    }
    this.enemy = this.makeEnemy(this.encounterIndex, this.zoneLevel);
    if (this.active && this.phase !== 'defeat') {
      this.phase = 'fighting';
      this.spawnEnemy();
    }
  }

  private step(dt: number): void {
    this.playerHurtTimer = Math.max(0, this.playerHurtTimer - dt);
    this.enemy.hurtTimer = Math.max(0, this.enemy.hurtTimer - dt);
    this.guardBreakTimer = Math.max(0, this.guardBreakTimer - dt);
    this.guardRegenDelay = Math.max(0, this.guardRegenDelay - dt);

    this.updatePlayer(dt);
    if (this.phase === 'between') {
      this.enemy.actionElapsed = Math.min(this.enemy.actionDuration, this.enemy.actionElapsed + dt);
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0) {
        if (this.completedEncounters >= SOLO_COMBAT_BALANCE.totalEncounters) this.completeVictory();
        else {
          this.encounterIndex = this.completedEncounters;
          this.phase = 'fighting';
          this.spawnEnemy();
        }
      }
      return;
    }

    this.updateEnemy(dt);
    const separated = softlySeparateCircles(
      this.playerPosition,
      SOLO_COMBAT_BALANCE.playerRadius,
      this.enemy.position,
      SOLO_COMBAT_BALANCE.enemyRadius,
    );
    this.playerPosition = separated.player;
    this.enemy.position = separated.enemy;
  }

  private updatePlayer(dt: number): void {
    const input = clampMagnitude(this.moveInput);
    const moving = Math.hypot(input.x, input.y) > 0.08;
    if (moving) this.playerFacing = normalized(input, this.playerFacing);

    const attacking = this.isAttackAction(this.playerAction);
    const blocking = this.isBlocking();
    const speedMultiplier = attacking
      ? SOLO_COMBAT_BALANCE.attackMoveMultiplier
      : blocking
        ? SOLO_COMBAT_BALANCE.blockMoveMultiplier
        : 1;
    if (moving) {
      this.playerPosition = moveCircleWithWallSlide(
        this.playerPosition,
        {
          x: input.x * SOLO_COMBAT_BALANCE.playerMoveSpeed * speedMultiplier * dt,
          y: input.y * SOLO_COMBAT_BALANCE.playerMoveSpeed * speedMultiplier * dt,
        },
        SOLO_COMBAT_BALANCE.playerRadius,
      );
    }

    if (!blocking && this.guardRegenDelay <= 0 && this.guardBreakTimer <= 0) {
      this.guard = Math.min(
        SOLO_COMBAT_BALANCE.maxGuard,
        this.guard + SOLO_COMBAT_BALANCE.guardRegenPerSecond * dt,
      );
    }

    if (attacking) {
      this.playerActionElapsed += dt;
      if (this.playerAction === 'attack-active' && !this.playerAttackApplied) this.tryPlayerHit();
      const duration = actionDurationForPlayer(this.playerAction);
      if (this.playerActionElapsed >= duration) this.advancePlayerAttack();
      this.attackQueued = false;
      return;
    }

    if (this.attackQueued && !blocking && this.phase === 'fighting') {
      this.playerAttackApplied = false;
      this.playerActionElapsed = 0;
      this.setPlayerAction('attack-windup');
      this.attackQueued = false;
      return;
    }
    this.attackQueued = false;
    this.setPlayerAction(blocking ? 'block' : moving ? 'move' : 'idle');
  }

  private updateEnemy(dt: number): void {
    const toPlayer = {
      x: this.playerPosition.x - this.enemy.position.x,
      y: this.playerPosition.y - this.enemy.position.y,
    };
    const distance = Math.hypot(toPlayer.x, toPlayer.y);

    if (this.enemy.action === 'spawn') {
      this.enemy.actionElapsed += dt;
      if (this.enemy.actionElapsed >= this.enemy.actionDuration) this.setEnemyAction('approach');
      return;
    }

    if (this.enemy.action === 'approach') {
      this.enemy.facing = normalized(toPlayer, this.enemy.facing);
      if (distance <= SOLO_COMBAT_BALANCE.enemyAttackTriggerRange) {
        this.setEnemyAction('telegraph', SOLO_COMBAT_BALANCE.enemyTelegraphDuration);
        return;
      }
      const direction = normalized(toPlayer, this.enemy.facing);
      this.enemy.position = moveCircleWithWallSlide(
        this.enemy.position,
        {
          x: direction.x * SOLO_COMBAT_BALANCE.enemyMoveSpeed * dt,
          y: direction.y * SOLO_COMBAT_BALANCE.enemyMoveSpeed * dt,
        },
        SOLO_COMBAT_BALANCE.enemyRadius,
      );
      return;
    }

    this.enemy.actionElapsed += dt;
    if (this.enemy.action === 'telegraph' && this.enemy.actionElapsed >= this.enemy.actionDuration) {
      this.enemy.strikeApplied = false;
      this.setEnemyAction('strike', SOLO_COMBAT_BALANCE.enemyStrikeDuration);
      return;
    }
    if (this.enemy.action === 'strike') {
      if (!this.enemy.strikeApplied && this.enemy.actionElapsed >= SOLO_COMBAT_BALANCE.enemyStrikeHitTime) {
        this.enemy.strikeApplied = true;
        this.tryEnemyHit();
      }
      if (this.enemy.actionElapsed >= this.enemy.actionDuration) {
        this.setEnemyAction('recovery', SOLO_COMBAT_BALANCE.enemyRecoveryDuration);
      }
      return;
    }
    if (this.enemy.action === 'recovery' && this.enemy.actionElapsed >= this.enemy.actionDuration) {
      this.setEnemyAction('approach');
    }
  }

  private advancePlayerAttack(): void {
    this.playerActionElapsed = 0;
    if (this.playerAction === 'attack-windup') {
      this.playerAttackApplied = false;
      this.setPlayerAction('attack-active');
    } else if (this.playerAction === 'attack-active') {
      this.setPlayerAction('attack-recovery');
    } else {
      this.setPlayerAction('idle');
    }
  }

  private tryPlayerHit(): void {
    if (!this.hero || this.enemy.hp <= 0 || this.phase !== 'fighting') return;
    if (distanceBetween(this.playerPosition, this.enemy.position) > SOLO_COMBAT_BALANCE.playerAttackRange) return;
    if (facingDot(this.playerPosition, this.playerFacing, this.enemy.position) < SOLO_COMBAT_BALANCE.playerAttackFacingDot) return;

    this.playerAttackApplied = true;
    const crit = rollCritical(this.hero.stats.critChance, this.rng);
    let damage = aldricAttackDamage(this.hero, this.enemy.defense);
    if (crit) damage = applyCritical(damage, SOLO_COMBAT_BALANCE.criticalMultiplier);
    this.enemy.hp = Math.max(0, this.enemy.hp - damage);
    this.enemy.hurtTimer = 0.18;

    const push = normalized({
      x: this.enemy.position.x - this.playerPosition.x,
      y: this.enemy.position.y - this.playerPosition.y,
    }, this.playerFacing);
    this.enemy.position = moveCircleWithWallSlide(
      this.enemy.position,
      { x: push.x * 7, y: push.y * 7 },
      SOLO_COMBAT_BALANCE.enemyRadius,
    );

    this.bus.emit('combat:damage', {
      sourceId: this.hero.id,
      targetId: this.enemy.id,
      amount: damage,
      crit,
      style: 'melee',
    });
    this.emit({ type: 'damage', sourceId: this.hero.id, targetId: this.enemy.id, amount: damage, crit, blocked: false });
    if (this.enemy.hp <= 0) this.finishEnemy();
  }

  private tryEnemyHit(): void {
    if (!this.hero?.alive || this.phase !== 'fighting') return;
    if (distanceBetween(this.enemy.position, this.playerPosition) > SOLO_COMBAT_BALANCE.enemyStrikeRange) return;
    if (facingDot(this.enemy.position, this.enemy.facing, this.playerPosition) < SOLO_COMBAT_BALANCE.enemyStrikeFacingDot) return;

    const frontal = facingDot(this.playerPosition, this.playerFacing, this.enemy.position) >= 0.05;
    const blocked = this.isBlocking() && frontal;
    const baseDamage = ghoulAttackDamage(this.enemy.attack, this.hero);
    const damage = blocked
      ? Math.max(1, Math.floor(baseDamage * (1 - SOLO_COMBAT_BALANCE.blockDamageReduction)))
      : baseDamage;

    if (blocked) {
      this.guard = Math.max(0, this.guard - SOLO_COMBAT_BALANCE.guardDamagePerStrike);
      this.guardRegenDelay = SOLO_COMBAT_BALANCE.guardRegenDelay;
      if (this.guard <= 0) {
        this.guardBreakTimer = SOLO_COMBAT_BALANCE.guardBreakDuration;
        this.emit({ type: 'guard-break' });
      }
    }

    this.hero.receiveDamage(damage);
    this.playerHurtTimer = blocked ? 0.1 : 0.2;
    const away = normalized({
      x: this.playerPosition.x - this.enemy.position.x,
      y: this.playerPosition.y - this.enemy.position.y,
    }, { x: -this.enemy.facing.x, y: -this.enemy.facing.y });
    const knockback = blocked ? SOLO_COMBAT_BALANCE.blockedKnockback : SOLO_COMBAT_BALANCE.unblockedKnockback;
    this.playerPosition = moveCircleWithWallSlide(
      this.playerPosition,
      { x: away.x * knockback, y: away.y * knockback },
      SOLO_COMBAT_BALANCE.playerRadius,
    );

    this.bus.emit('combat:damage', {
      sourceId: this.enemy.id,
      targetId: this.hero.id,
      amount: damage,
      crit: false,
      style: 'enemy',
    });
    this.emit({ type: 'damage', sourceId: this.enemy.id, targetId: this.hero.id, amount: damage, crit: false, blocked });
    if (!this.hero.alive) this.beginDefeat();
  }

  private finishEnemy(): void {
    const defeatedIndex = this.encounterIndex;
    this.enemy.hp = 0;
    this.setEnemyAction('dead', SOLO_COMBAT_BALANCE.enemyDeathDuration);
    this.completedEncounters = Math.max(this.completedEncounters, defeatedIndex + 1);
    this.phase = 'between';
    this.betweenTimer = SOLO_COMBAT_BALANCE.enemyDeathDuration + SOLO_COMBAT_BALANCE.encounterIntermission;
    this.attackQueued = false;
    this.blockHeld = false;
    this.setPlayerAction('idle');

    this.bus.emit('combat:enemy-death', {
      enemyId: this.enemy.id,
      wave: defeatedIndex + 1,
      zoneLevel: this.zoneLevel,
    });
    this.emit({ type: 'enemy-death', enemyId: this.enemy.id, encounter: defeatedIndex + 1 });

    if (!this.rewardedEncounters.has(defeatedIndex)) {
      this.rewardedEncounters.add(defeatedIndex);
      const rewards = encounterRewards(defeatedIndex, this.zoneLevel);
      this.bus.emit('loot:drop', {
        itemName: defeatedIndex === SOLO_COMBAT_BALANCE.totalEncounters - 1 ? 'Ashen Ring' : 'Crypt Spoils',
        rarity: defeatedIndex === SOLO_COMBAT_BALANCE.totalEncounters - 1 ? 'rare' : 'common',
        ...rewards,
      });
    }
    // The zone reward is granted in the same synchronous completion turn as
    // the final-enemy checkpoint. A reload or exit during the death/intermission
    // presentation therefore cannot skip the reward while preserving victory.
    if (this.completedEncounters >= SOLO_COMBAT_BALANCE.totalEncounters) {
      this.grantVictoryRewards();
    }
    this.emit({ type: 'checkpoint', checkpoint: this.checkpoint });
  }

  private completeVictory(): void {
    this.phase = 'victory';
    this.completedEncounters = SOLO_COMBAT_BALANCE.totalEncounters;
    this.resetTransientInput();
    this.grantVictoryRewards();
    this.emit({ type: 'victory', checkpoint: this.checkpoint });
  }

  private grantVictoryRewards(): void {
    if (this.victoryRewarded) return;
    this.victoryRewarded = true;
    const rewards = zoneClearRewards(this.zoneLevel);
    this.bus.emit('progress:zone-complete', { zoneLevel: this.zoneLevel, ...rewards });
    this.bus.emit('progress:zone-ready', { zoneLevel: this.zoneLevel });
  }

  private beginDefeat(): void {
    if (!this.hero || this.phase === 'defeat') return;
    this.phase = 'defeat';
    this.resetTransientInput();
    this.setPlayerAction('down');
    this.bus.emit('combat:hero-down', {
      heroId: this.hero.id,
      zoneLevel: this.zoneLevel,
      wave: this.encounterIndex + 1,
    });
    this.bus.emit('combat:party-defeated', {
      zoneLevel: this.zoneLevel,
      wave: this.encounterIndex + 1,
      recoveryTicks: 0,
    });
    this.emit({ type: 'defeat' });
  }

  private spawnEnemy(): void {
    this.enemy = this.makeEnemy(this.encounterIndex, this.zoneLevel);
    this.setEnemyAction('spawn', SOLO_COMBAT_BALANCE.enemySpawnDuration);
    this.bus.emit('combat:enemy-spawn', {
      enemyId: this.enemy.id,
      name: this.enemy.name,
      level: this.enemy.level,
      wave: this.encounterIndex + 1,
    });
    this.emit({ type: 'enemy-spawn', enemyId: this.enemy.id, encounter: this.encounterIndex + 1 });
  }

  private makeEnemy(encounterIndex: number, zoneLevel: number): EnemyRuntime {
    const safeIndex = Math.max(0, Math.min(SOLO_COMBAT_BALANCE.totalEncounters - 1, encounterIndex));
    const stats = soloEnemyStatsFor(safeIndex, zoneLevel);
    const start = ENEMY_STARTS[safeIndex] ?? ENEMY_STARTS[0]!;
    return {
      id: makeId(),
      name: 'Crypt Ghoul',
      level: Math.max(1, zoneLevel),
      hp: stats.hp,
      maxHp: stats.hp,
      defense: stats.defense,
      attack: stats.attack,
      burnTicks: 0,
      frozenTicks: 0,
      threat: new Map(),
      position: { ...start },
      facing: normalized({ x: PLAYER_START.x - start.x, y: PLAYER_START.y - start.y }),
      action: 'spawn',
      actionElapsed: 0,
      actionDuration: SOLO_COMBAT_BALANCE.enemySpawnDuration,
      strikeApplied: false,
      hurtTimer: 0,
    };
  }

  private setPlayerAction(action: PlayerCombatAction): void {
    if (this.playerAction === action) return;
    this.playerAction = action;
    this.playerActionElapsed = 0;
    this.emit({ type: 'player-action', action });
  }

  private setEnemyAction(action: EnemyCombatAction, duration = 0): void {
    this.enemy.action = action;
    this.enemy.actionElapsed = 0;
    this.enemy.actionDuration = duration;
    this.emit({ type: 'enemy-action', action });
  }

  private isAttackAction(action: PlayerCombatAction): boolean {
    return action === 'attack-windup' || action === 'attack-active' || action === 'attack-recovery';
  }

  private isBlocking(): boolean {
    return this.blockHeld
      && this.phase === 'fighting'
      && !this.isAttackAction(this.playerAction)
      && this.guard > 0
      && this.guardBreakTimer <= 0;
  }

  private resetTransientInput(): void {
    this.moveInput = { x: 0, y: 0 };
    this.attackQueued = false;
    this.blockHeld = false;
    this.playerAttackApplied = false;
    this.playerActionElapsed = 0;
  }

  private emit(event: CombatEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
