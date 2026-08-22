import { classById } from '../config/classes.config';
import { applyCritical, mitigateDamage, rollCritical } from '../math/CombatMath';
import type { Hero } from '../models/Hero';
import type { Party } from '../models/Party';
import { EventBus } from '../core/EventBus';

interface Enemy {
  id: string;
  name: string;
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
  constructor(private bus: EventBus) {}
  get currentEnemy(): Readonly<Enemy> { return this.enemy; }
  resetEnemy(zoneLevel: number): void { this.enemy = this.makeEnemy(zoneLevel); }

  tick(party: Party, zoneLevel: number): void {
    this.tickCount += 1;
    if (this.enemy.hp <= 0) this.resetEnemy(zoneLevel);
    if (this.enemy.burnTicks > 0) {
      this.enemy.hp = Math.max(0, this.enemy.hp - 8);
      this.enemy.burnTicks -= 1;
    }
    if (this.enemy.frozenTicks > 0) this.enemy.frozenTicks -= 1;

    for (const hero of party.livingHeroes) {
      const crit = rollCritical(hero.stats.critChance);
      let damage = mitigateDamage(hero.stats.attack, this.enemy.defense);
      if (crit) damage = applyCritical(damage);
      const role = classById(hero.jobId).role;
      const threatMultiplier = role === 'tank' ? 2.5 : role === 'healer' ? 0.7 : 1;
      this.enemy.threat.set(hero.id, (this.enemy.threat.get(hero.id) ?? 0) + damage * threatMultiplier);
      this.enemy.hp = Math.max(0, this.enemy.hp - damage);
      if (role === 'caster' && this.tickCount % 4 === 0) this.enemy.burnTicks = Math.max(this.enemy.burnTicks, 3);
      if (role === 'caster' && this.tickCount % 7 === 0) this.enemy.frozenTicks = 1;
      this.bus.emit('combat:damage', { sourceId: hero.id, targetId: this.enemy.id, amount: damage, crit });
      if (this.enemy.hp <= 0) {
        this.bus.emit('loot:drop', { itemName: 'Ashen Cache', rarity: 'rare' });
        break;
      }
    }

    if (this.enemy.hp > 0 && this.enemy.frozenTicks <= 0) {
      const target = this.pickThreatTarget(party.livingHeroes);
      if (target) {
        const damage = mitigateDamage(this.enemy.attack, target.stats.defense);
        target.receiveDamage(damage);
        this.bus.emit('combat:damage', { sourceId: this.enemy.id, targetId: target.id, amount: damage, crit: false });
      }
    }
  }

  private pickThreatTarget(heroes: Hero[]): Hero | undefined {
    return [...heroes].sort((a, b) => (this.enemy.threat.get(b.id) ?? 0) - (this.enemy.threat.get(a.id) ?? 0))[0];
  }

  private makeEnemy(zoneLevel: number): Enemy {
    return {
      id: crypto.randomUUID(),
      name: `Dreadling Lv.${zoneLevel}`,
      hp: 250 + zoneLevel * 80,
      maxHp: 250 + zoneLevel * 80,
      defense: 8 + zoneLevel * 2,
      attack: 10 + zoneLevel * 3,
      burnTicks: 0,
      frozenTicks: 0,
      threat: new Map()
    };
  }
}
