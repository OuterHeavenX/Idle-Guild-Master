import { Container, Graphics } from 'pixi.js';
import type { EventBus } from '../../core/EventBus';
import type { StateManager } from '../../core/StateManager';
import type {
  CombatEvent,
  CombatSnapshot,
  CombatSystem,
  DungeonCombatCheckpoint,
  DungeonCombatCheckpointInput,
} from '../../systems/CombatSystem';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  CRYPT_OBSTACLES,
  CRYPT_WALKABLE_BOUNDS,
} from '../../systems/combat/ArenaCollision';
import { SOLO_COMBAT_BALANCE } from '../../systems/combat/CombatBalance';
import { HeroActor } from './HeroActor';
import { EnemyActor } from './EnemyActor';
import { DungeonHud } from './DungeonHud';
import { LootFeed } from './LootFeed';
import { CombatEffects } from '../effects/CombatEffects';
import { EnvironmentRenderer } from './EnvironmentRenderer';

const combatDebug = new URLSearchParams(location.search).get('combatdebug') === '1';

export class DungeonScene extends Container {
  private screenBackdrop = new Graphics();
  private arena = new Container();
  private environment = new EnvironmentRenderer();
  private props = new Graphics();
  private actors = new Container();
  private player: HeroActor;
  private enemy = new EnemyActor();
  private hud: DungeonHud;
  private feed = new LootFeed();
  private fx = new CombatEffects();
  private debugLayer = new Graphics();
  private sceneWidth = 1;
  private sceneHeight = 1;
  private unsubscribeCombat: () => void;

  constructor(private state: StateManager, private combat: CombatSystem, _bus?: EventBus) {
    super();
    const aldric = this.findAldric();
    this.player = new HeroActor(state, aldric.id);
    this.hud = new DungeonHud(state, combat);
    this.eventMode = 'none';

    this.environment.resize(ARENA_WIDTH, ARENA_HEIGHT);
    this.drawArenaProps();
    this.actors.addChild(this.player, this.enemy);
    this.arena.addChild(
      this.environment.container,
      this.props,
      this.actors,
      this.environment.ambient,
      this.fx.container,
      this.debugLayer,
    );
    this.addChild(this.screenBackdrop, this.arena, this.hud, this.feed);
    this.player.visible = false;
    this.enemy.visible = false;
    this.debugLayer.visible = combatDebug;
    this.unsubscribeCombat = this.combat.subscribe((event) => this.onCombatEvent(event));
  }

  enter(checkpoint: DungeonCombatCheckpointInput = {}): CombatSnapshot {
    this.clearVisuals();
    this.player.reset();
    this.enemy.reset();
    this.player.visible = true;
    this.enemy.visible = true;
    return this.combat.enter(this.findAldric(), {
      ...checkpoint,
      zoneLevel: checkpoint.zoneLevel ?? this.state.zoneLevel,
    });
  }

  leave(): DungeonCombatCheckpoint {
    const checkpoint = this.combat.leave();
    this.combat.setMove(0, 0);
    this.combat.setBlock(false);
    this.player.visible = false;
    this.enemy.visible = false;
    this.clearVisuals();
    return checkpoint;
  }

  clear(): void {
    this.combat.clear();
    this.player.reset();
    this.enemy.reset();
    this.player.visible = false;
    this.enemy.visible = false;
    this.clearVisuals();
  }

  setMove(x: number, y: number): void { this.combat.setMove(x, y); }
  requestAttack(): boolean { return this.combat.requestAttack(); }
  setBlock(active: boolean): void { this.combat.setBlock(active); }
  retry(): boolean { return this.combat.retry(); }
  get snapshot(): CombatSnapshot { return this.combat.snapshot; }

  resize(width: number, height: number): void {
    this.sceneWidth = Math.max(1, width);
    this.sceneHeight = Math.max(1, height);
    const scale = Math.min(width / ARENA_WIDTH, height / ARENA_HEIGHT);
    this.arena.scale.set(scale);
    this.arena.position.set(
      Math.round((width - ARENA_WIDTH * scale) / 2),
      Math.round((height - ARENA_HEIGHT * scale) / 2),
    );
    this.screenBackdrop.clear().rect(0, 0, width, height).fill(0x090b13);
    this.feed.position.set(10, Math.max(108, height * 0.2));
    this.feed.resize(Math.min(178, width * 0.44));
    this.hud.update(width, height, this.combat.snapshot);
  }

  /** Rendering only: the outer Game frame must call CombatSystem.update(dt) once. */
  update(dt: number): void {
    if (!this.visible) return;
    const snapshot = this.combat.snapshot;
    this.environment.update(dt);
    this.player.visible = snapshot.active;
    this.enemy.visible = snapshot.active;
    this.player.position.set(snapshot.player.position.x, snapshot.player.position.y);
    this.enemy.position.set(snapshot.enemy.position.x, snapshot.enemy.position.y);
    this.player.setCombatPose(snapshot.player);
    this.enemy.setCombatPose(snapshot.enemy);
    this.player.update(dt);
    this.enemy.update(dt);
    this.fx.update(dt);
    this.feed.update(dt);
    this.hud.update(this.sceneWidth, this.sceneHeight, snapshot);
    if (combatDebug) this.drawDebug(snapshot);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsubscribeCombat();
    this.clearVisuals();
    super.destroy(options);
  }

  private findAldric() {
    return this.state.heroes.find((hero) => hero.id === 'hero-1' || hero.name.toLowerCase() === 'aldric')
      ?? this.state.heroes[0]!;
  }

  private onCombatEvent(event: CombatEvent): void {
    const snapshot = this.combat.snapshot;
    if (event.type === 'damage') {
      if (event.targetId === snapshot.enemy.id) {
        this.player.playAttack();
        this.enemy.playHurt();
        this.fx.damage(snapshot.enemy.position.x, snapshot.enemy.position.y - 88, event.amount, event.crit);
        this.fx.impact(snapshot.enemy.position.x - 7, snapshot.enemy.position.y - 45, 0xffb56b);
      } else if (event.targetId === snapshot.player.id) {
        this.player.playHit();
        this.enemy.playAttack();
        this.fx.damage(snapshot.player.position.x, snapshot.player.position.y - 76, event.amount, false);
        this.fx.impact(
          snapshot.player.position.x + snapshot.player.facing.x * 20,
          snapshot.player.position.y - 45,
          event.blocked ? 0xaed9ea : 0xd45b4d,
        );
        if (event.blocked) this.feed.add(`BLOCKED · ${event.amount} damage`);
      }
      return;
    }

    if (event.type === 'enemy-spawn') {
      this.enemy.reset();
      this.enemy.visible = true;
      this.fx.spawn(snapshot.enemy.position.x, snapshot.enemy.position.y - 10);
      this.feed.add(`Ghoul ${event.encounter} stirs`);
    } else if (event.type === 'enemy-death') {
      this.enemy.playDeath();
      this.fx.loot(snapshot.enemy.position.x, snapshot.enemy.position.y - 8);
    } else if (event.type === 'guard-break') {
      this.feed.add('GUARD BROKEN · Reposition', true);
    } else if (event.type === 'defeat') {
      this.feed.add('ALDRIC FALLS · Retry or return to Town', true);
    } else if (event.type === 'retry') {
      this.player.reset();
      this.enemy.reset();
      this.feed.clear();
      this.feed.add(`Encounter ${snapshot.encounter} retry`, true);
    } else if (event.type === 'victory') {
      this.feed.add('UPPER CRYPT CLEARED · Return to the Guild', true);
    }
  }

  private clearVisuals(): void {
    this.fx.clear();
    this.feed.clear();
    this.debugLayer.clear();
  }

  private drawArenaProps(): void {
    this.props.clear();
    for (const [index, obstacle] of CRYPT_OBSTACLES.entries()) {
      const color = index === 0 ? 0x34323a : 0x2c2c34;
      this.props
        .roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 12)
        .fill({ color, alpha: 0.78 })
        .stroke({ color: 0x55515c, width: 2, alpha: 0.52 })
        .moveTo(obstacle.x + 8, obstacle.y + obstacle.height * 0.58)
        .lineTo(obstacle.x + obstacle.width * 0.48, obstacle.y + 7)
        .lineTo(obstacle.x + obstacle.width - 9, obstacle.y + obstacle.height * 0.66)
        .stroke({ color: 0x1b1b22, width: 2, alpha: 0.58 });
    }
  }

  private drawDebug(snapshot: CombatSnapshot): void {
    const bounds = CRYPT_WALKABLE_BOUNDS;
    this.debugLayer.clear()
      .rect(bounds.x, bounds.y, bounds.width, bounds.height)
      .stroke({ color: 0x65d9ff, width: 1, alpha: 0.72 });
    for (const obstacle of CRYPT_OBSTACLES) {
      this.debugLayer
        .rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
        .stroke({ color: 0xff765f, width: 2, alpha: 0.8 });
    }
    this.debugLayer
      .circle(snapshot.player.position.x, snapshot.player.position.y, SOLO_COMBAT_BALANCE.playerRadius)
      .stroke({ color: 0x6fd7ff, width: 1, alpha: 0.85 })
      .circle(snapshot.enemy.position.x, snapshot.enemy.position.y, SOLO_COMBAT_BALANCE.enemyRadius)
      .stroke({ color: 0xff7069, width: 1, alpha: 0.85 });
    if (snapshot.player.action === 'attack-active') {
      this.debugLayer
        .circle(snapshot.player.position.x, snapshot.player.position.y, SOLO_COMBAT_BALANCE.playerAttackRange)
        .stroke({ color: 0xffdc7a, width: 1, alpha: 0.55 });
    }
    this.debugLayer
      .moveTo(snapshot.player.position.x, snapshot.player.position.y)
      .lineTo(
        snapshot.player.position.x + snapshot.player.facing.x * 48,
        snapshot.player.position.y + snapshot.player.facing.y * 48,
      )
      .stroke({ color: 0xe8f5ff, width: 2, alpha: 0.72 });
  }
}
