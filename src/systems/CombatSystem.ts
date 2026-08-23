import { classById } from '../config/classes.config';
import { applyCritical, mitigateDamage, rollCritical } from '../math/CombatMath';
import type { Hero } from '../models/Hero';
import type { Party } from '../models/Party';
import { EventBus, type CombatStyle } from '../core/EventBus';
import {
  COMBAT_BALANCE,
  burnDamageFor,
  clericHealAmount,
  enemyStatsFor,
  heroDamageMultiplier,
  incomingDamageMultiplier,
  rewardsForEnemy,
  targetWeightFor,
  zoneClearRewards,
} from './combat/CombatBalance';

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

export interface CombatTelemetry {
  ticks: number;
  enemyDeaths: number;
  heroDeaths: number;
  partyWipes: number;
  ghoulAttacks: number;
  guardianTargets: number;
  criticals: number;
  burnDamage: number;
  freezeProcs: number;
  healing: number;
  heroDamage: Record<string, number>;
  damageReceived: Record<string, number>;
}

type CombatMode = 'fighting' | 'recovering';

export class CombatSystem {
  private enemy: Enemy = this.makeEnemy(1, 1);
  private tickCount = 0;
  private defeatedInZone = 0;
  private zoneReady = false;
  private mode: CombatMode = 'fighting';
  private recoveryTicks = 0;
  private readonly telemetry: CombatTelemetry = {
    ticks: 0,
    enemyDeaths: 0,
    heroDeaths: 0,
    partyWipes: 0,
    ghoulAttacks: 0,
    guardianTargets: 0,
    criticals: 0,
    burnDamage: 0,
    freezeProcs: 0,
    healing: 0,
    heroDamage: {},
    damageReceived: {},
  };

  constructor(private bus: EventBus, private rng: () => number = Math.random) {}

  get currentEnemy(): Readonly<Enemy> { return this.enemy; }
  get wave(): number { return Math.min(10, this.defeatedInZone + 1); }
  get cleared(): number { return this.defeatedInZone; }
  get canAdvanceZone(): boolean { return this.zoneReady; }
  get recovering(): boolean { return this.mode === 'recovering'; }
  get telemetrySnapshot(): CombatTelemetry {
    return {
      ...this.telemetry,
      heroDamage: { ...this.telemetry.heroDamage },
      damageReceived: { ...this.telemetry.damageReceived },
    };
  }

  resetEnemy(zoneLevel: number, resetWave = false): void {
    if (resetWave) {
      this.defeatedInZone = 0;
      this.zoneReady = false;
      this.mode = 'fighting';
      this.recoveryTicks = 0;
    }
    this.enemy = this.makeEnemy(zoneLevel, this.wave);
    this.bus.emit('combat:enemy-spawn', {
      enemyId: this.enemy.id,
      name: this.enemy.name,
      level: zoneLevel,
      wave: this.wave,
    });
  }

  tick(party: Party, zoneLevel: number): void {
    this.tickCount += 1;
    this.telemetry.ticks += 1;

    if (this.mode === 'recovering') {
      this.recoveryTicks -= 1;
      if (this.recoveryTicks <= 0) this.completeRecovery(party, zoneLevel);
      return;
    }

    if (this.zoneReady) return;

    if (party.livingHeroes.length === 0) {
      this.beginDefeat(zoneLevel);
      return;
    }

    if (this.enemy.hp <= 0) this.resetEnemy(zoneLevel);

    const frozenAtTickStart = this.enemy.frozenTicks > 0;
    if (this.enemy.burnTicks > 0) {
      const burn = Math.min(this.enemy.hp, burnDamageFor(zoneLevel));
      this.enemy.hp = Math.max(0, this.enemy.hp - burn);
      this.enemy.burnTicks -= 1;
      this.telemetry.burnDamage += burn;
      this.bus.emit('combat:damage', {
        sourceId: 'status-burn',
        targetId: this.enemy.id,
        amount: burn,
        crit: false,
        style: 'spell',
      });
      this.bus.emit('combat:status', {
        targetId: this.enemy.id,
        status: 'burn',
        active: this.enemy.burnTicks > 0,
      });
      if (this.enemy.hp <= 0) {
        this.finishEnemy(party, zoneLevel);
        return;
      }
    }

    if (frozenAtTickStart) {
      this.enemy.frozenTicks -= 1;
      this.bus.emit('combat:status', {
        targetId: this.enemy.id,
        status: 'freeze',
        active: this.enemy.frozenTicks > 0,
      });
    }

    for (const hero of party.livingHeroes) {
      const role = classById(hero.jobId).role;
      const crit = rollCritical(hero.stats.critChance, this.rng);
      const rawDamage = Math.max(1, Math.round(hero.stats.attack * heroDamageMultiplier(hero)));
      let damage = mitigateDamage(rawDamage, this.enemy.defense);
      if (crit) {
        damage = applyCritical(damage, COMBAT_BALANCE.criticalMultiplier);
        this.telemetry.criticals += 1;
      }

      this.enemy.threat.set(hero.id, (this.enemy.threat.get(hero.id) ?? 0) + damage);
      this.enemy.hp = Math.max(0, this.enemy.hp - damage);
      this.telemetry.heroDamage[hero.id] = (this.telemetry.heroDamage[hero.id] ?? 0) + damage;

      const style: CombatStyle = role === 'tank'
        ? 'melee'
        : role === 'healer'
          ? 'heal'
          : hero.jobId === 'ranger'
            ? 'projectile'
            : 'spell';
      this.bus.emit('combat:damage', {
        sourceId: hero.id,
        targetId: this.enemy.id,
        amount: damage,
        crit,
        style,
      });

      if (role === 'healer' && this.tickCount % 2 === 0) {
        const target = this.lowestHealthTarget(party.livingHeroes);
        if (target && target.currentHp < target.stats.maxHp) {
          const before = target.currentHp;
          target.heal(clericHealAmount(hero.stats.attack));
          const amount = target.currentHp - before;
          if (amount > 0) {
            this.telemetry.healing += amount;
            this.bus.emit('combat:heal', { sourceId: hero.id, targetId: target.id, amount });
          }
        }
      }

      if (hero.jobId === 'arcanist' && this.tickCount % 4 === 0) {
        this.enemy.burnTicks = COMBAT_BALANCE.burnTicks;
        this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'burn', active: true });
      }
      if (hero.jobId === 'arcanist' && this.tickCount % 7 === 0) {
        this.enemy.frozenTicks = Math.max(this.enemy.frozenTicks, 1);
        this.telemetry.freezeProcs += 1;
        this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'freeze', active: true });
      }

      if (this.enemy.hp <= 0) {
        this.finishEnemy(party, zoneLevel);
        return;
      }
    }

    if (!frozenAtTickStart) this.enemyAttack(party, zoneLevel);
  }

  private enemyAttack(party: Party, zoneLevel: number): void {
    const target = this.pickWeightedTarget(party.livingHeroes);
    if (!target) return;

    const wasAlive = target.alive;
    const mitigated = mitigateDamage(this.enemy.attack, target.stats.defense);
    const damage = Math.max(1, Math.floor(mitigated * incomingDamageMultiplier(target)));
    target.receiveDamage(damage);
    this.telemetry.ghoulAttacks += 1;
    if (target.jobId === 'guardian') this.telemetry.guardianTargets += 1;
    this.telemetry.damageReceived[target.id] = (this.telemetry.damageReceived[target.id] ?? 0) + damage;
    this.bus.emit('combat:damage', {
      sourceId: this.enemy.id,
      targetId: target.id,
      amount: damage,
      crit: false,
      style: 'enemy',
    });

    if (wasAlive && !target.alive) {
      this.telemetry.heroDeaths += 1;
      this.bus.emit('combat:hero-down', { heroId: target.id, zoneLevel, wave: this.wave });
    }
    if (party.livingHeroes.length === 0) this.beginDefeat(zoneLevel);
  }

  private finishEnemy(party: Party, zoneLevel: number): void {
    const completedWave = Math.min(10, this.defeatedInZone + 1);
    this.defeatedInZone = completedWave;
    this.telemetry.enemyDeaths += 1;
    this.bus.emit('combat:enemy-death', { enemyId: this.enemy.id, wave: completedWave, zoneLevel });

    const rewards = rewardsForEnemy(zoneLevel, completedWave);
    const loot = completedWave % 5 === 0
      ? { itemName: 'Ashen Ring', rarity: 'rare' }
      : { itemName: 'Crypt Spoils', rarity: 'common' };
    this.bus.emit('loot:drop', { ...loot, ...rewards });

    if (completedWave >= 10) {
      this.zoneReady = true;
      this.recoverParty(party, COMBAT_BALANCE.zoneRecoveryFraction, true);
      const completion = zoneClearRewards(zoneLevel);
      this.bus.emit('progress:zone-complete', { zoneLevel, ...completion });
      this.bus.emit('progress:zone-ready', { zoneLevel });
      return;
    }

    this.recoverParty(party, COMBAT_BALANCE.waveRecoveryFraction, false);
  }

  private beginDefeat(zoneLevel: number): void {
    if (this.mode === 'recovering') return;
    this.mode = 'recovering';
    this.recoveryTicks = COMBAT_BALANCE.defeatRecoveryTicks;
    this.telemetry.partyWipes += 1;
    this.bus.emit('combat:party-defeated', {
      zoneLevel,
      wave: this.wave,
      recoveryTicks: this.recoveryTicks,
    });
  }

  private completeRecovery(party: Party, zoneLevel: number): void {
    this.recoverParty(party, 1, true);
    this.defeatedInZone = 0;
    this.zoneReady = false;
    this.mode = 'fighting';
    this.recoveryTicks = 0;
    this.enemy = this.makeEnemy(zoneLevel, 1);
    this.bus.emit('combat:party-recovered', { zoneLevel });
    this.bus.emit('combat:enemy-spawn', {
      enemyId: this.enemy.id,
      name: this.enemy.name,
      level: zoneLevel,
      wave: 1,
    });
  }

  private recoverParty(party: Party, fraction: number, reviveDowned: boolean): void {
    for (const hero of party.heroes) {
      if (!reviveDowned && !hero.alive) continue;
      const before = hero.currentHp;
      const amount = fraction >= 1
        ? hero.stats.maxHp
        : Math.max(1, Math.floor(hero.stats.maxHp * fraction));
      hero.heal(amount);
      const restored = hero.currentHp - before;
      if (restored > 0) {
        this.telemetry.healing += restored;
        this.bus.emit('combat:heal', { sourceId: 'crypt-recovery', targetId: hero.id, amount: restored });
      }
    }
  }

  private lowestHealthTarget(heroes: Hero[]): Hero | undefined {
    return [...heroes].sort(
      (a, b) => a.currentHp / a.stats.maxHp - b.currentHp / b.stats.maxHp,
    )[0];
  }

  private pickWeightedTarget(heroes: Hero[]): Hero | undefined {
    if (!heroes.length) return undefined;
    const totalWeight = heroes.reduce((sum, hero) => sum + targetWeightFor(hero), 0);
    let roll = this.rng() * totalWeight;
    for (const hero of heroes) {
      roll -= targetWeightFor(hero);
      if (roll <= 0) return hero;
    }
    return heroes[heroes.length - 1];
  }

  private makeEnemy(zoneLevel: number, wave: number): Enemy {
    const stats = enemyStatsFor(zoneLevel, wave);
    return {
      id: crypto.randomUUID(),
      name: 'Crypt Ghoul',
      level: zoneLevel,
      hp: stats.hp,
      maxHp: stats.hp,
      defense: stats.defense,
      attack: stats.attack,
      burnTicks: 0,
      frozenTicks: 0,
      threat: new Map(),
    };
  }
}
