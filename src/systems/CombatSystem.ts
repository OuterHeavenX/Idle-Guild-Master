import { classById } from '../config/classes.config';
import { applyCritical, mitigateDamage, rollCritical } from '../math/CombatMath';
import type { Hero } from '../models/Hero';
import type { Party } from '../models/Party';
import { EventBus, type CombatStyle } from '../core/EventBus';

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

export class CombatSystem {
  private enemy: Enemy = this.makeEnemy(1);
  private tickCount = 0;
  private defeatedInZone = 0;
  private zoneReady = false;
  constructor(private bus: EventBus) {}
  get currentEnemy(): Readonly<Enemy> { return this.enemy; }
  get wave(): number { return Math.min(10, this.defeatedInZone + 1); }
  get cleared(): number { return this.defeatedInZone; }
  get canAdvanceZone(): boolean { return this.zoneReady; }

  resetEnemy(zoneLevel: number, resetWave = false): void {
    if (resetWave) {
      this.defeatedInZone = 0;
      this.zoneReady = false;
    }
    this.enemy = this.makeEnemy(zoneLevel);
    this.bus.emit('combat:enemy-spawn', { enemyId: this.enemy.id, name: this.enemy.name, level: zoneLevel });
  }

  tick(party: Party, zoneLevel: number): void {
    this.tickCount += 1;
    if (party.livingHeroes.length === 0) {
      for (const hero of party.heroes) {
        const amount = Math.max(1, Math.floor(hero.stats.maxHp * 0.6));
        hero.heal(amount);
        this.bus.emit('combat:heal', { sourceId: 'crypt-grace', targetId: hero.id, amount });
      }
    }
    if (this.enemy.hp <= 0) this.resetEnemy(zoneLevel);

    if (this.enemy.burnTicks > 0) {
      const burn = Math.min(this.enemy.hp, 8 + Math.floor(zoneLevel * 0.5));
      this.enemy.hp = Math.max(0, this.enemy.hp - burn);
      this.enemy.burnTicks -= 1;
      this.bus.emit('combat:damage', { sourceId: 'status-burn', targetId: this.enemy.id, amount: burn, crit: false, style: 'spell' });
      this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'burn', active: this.enemy.burnTicks > 0 });
      if (this.enemy.hp <= 0) { this.finishEnemy(zoneLevel); return; }
    }
    if (this.enemy.frozenTicks > 0) {
      this.enemy.frozenTicks -= 1;
      this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'freeze', active: this.enemy.frozenTicks > 0 });
    }

    for (const hero of party.livingHeroes) {
      const role = classById(hero.jobId).role;
      const crit = rollCritical(hero.stats.critChance);
      let damage = mitigateDamage(hero.stats.attack, this.enemy.defense);
      if (crit) damage = applyCritical(damage);
      const threatMultiplier = role === 'tank' ? 2.5 : role === 'healer' ? 0.7 : 1;
      this.enemy.threat.set(hero.id, (this.enemy.threat.get(hero.id) ?? 0) + damage * threatMultiplier);
      this.enemy.hp = Math.max(0, this.enemy.hp - damage);

      const style: CombatStyle = role === 'tank' ? 'melee' : role === 'healer' ? 'heal' : hero.jobId === 'ranger' ? 'projectile' : 'spell';
      this.bus.emit('combat:damage', { sourceId: hero.id, targetId: this.enemy.id, amount: damage, crit, style });

      if (role === 'healer' && this.tickCount % 2 === 0) {
        const target = [...party.livingHeroes].sort((a, b) => a.currentHp / a.stats.maxHp - b.currentHp / b.stats.maxHp)[0];
        if (target) {
          const before = target.currentHp;
          target.heal(10 + Math.floor(hero.stats.attack * 0.45));
          const amount = target.currentHp - before;
          if (amount > 0) this.bus.emit('combat:heal', { sourceId: hero.id, targetId: target.id, amount });
        }
      }

      if (hero.jobId === 'arcanist' && this.tickCount % 4 === 0) {
        this.enemy.burnTicks = Math.max(this.enemy.burnTicks, 3);
        this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'burn', active: true });
      }
      if (hero.jobId === 'arcanist' && this.tickCount % 7 === 0) {
        this.enemy.frozenTicks = 1;
        this.bus.emit('combat:status', { targetId: this.enemy.id, status: 'freeze', active: true });
      }
      if (this.enemy.hp <= 0) { this.finishEnemy(zoneLevel); return; }
    }

    if (this.enemy.frozenTicks <= 0) {
      const target = this.pickThreatTarget(party.livingHeroes);
      if (target) {
        const damage = mitigateDamage(this.enemy.attack, target.stats.defense);
        target.receiveDamage(damage);
        this.bus.emit('combat:damage', { sourceId: this.enemy.id, targetId: target.id, amount: damage, crit: false, style: 'enemy' });
      }
    }
  }

  private finishEnemy(zoneLevel: number): void {
    this.defeatedInZone = Math.min(10, this.defeatedInZone + 1);
    this.bus.emit('combat:enemy-death', { enemyId: this.enemy.id, wave: this.defeatedInZone, zoneLevel });
    const loot = this.defeatedInZone % 5 === 0 ? { itemName: 'Ashen Ring', rarity: 'rare' } : { itemName: 'Crypt Spoils', rarity: 'common' };
    this.bus.emit('loot:drop', { ...loot, gold: 25, shards: 1 });
    if (this.defeatedInZone >= 10 && !this.zoneReady) {
      this.zoneReady = true;
      this.bus.emit('progress:zone-ready', { zoneLevel });
    }
  }

  private pickThreatTarget(heroes: Hero[]): Hero | undefined {
    return [...heroes].sort((a, b) => (this.enemy.threat.get(b.id) ?? 0) - (this.enemy.threat.get(a.id) ?? 0))[0];
  }

  private makeEnemy(zoneLevel: number): Enemy {
    const hp = 250 + zoneLevel * 80;
    return {
      id: crypto.randomUUID(), name: 'Crypt Ghoul', level: zoneLevel,
      hp, maxHp: hp, defense: 8 + zoneLevel * 2, attack: 10 + zoneLevel * 3,
      burnTicks: 0, frozenTicks: 0, threat: new Map()
    };
  }
}
