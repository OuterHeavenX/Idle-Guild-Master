import { IGNIS, RAID_TANK_SWAP_STACKS } from '../config/raids.config';
import { EventBus } from '../core/EventBus';
import type { Party } from '../models/Party';

export interface RaidState {
  active: boolean;
  elapsedSeconds: number;
  bossHp: number;
  phase: number;
  tankDebuffStacks: Record<'A' | 'B', number>;
  addsAlive: number;
  enraged: boolean;
}

export class RaidSystem {
  state: RaidState = this.freshState();
  constructor(private bus: EventBus) {}

  start(partyA: Party, partyB: Party): void {
    if (partyA.heroes.length !== 4 || partyB.heroes.length !== 4) throw new Error('Ignis requires two full 4-hero parties.');
    this.state = this.freshState();
    this.state.active = true;
  }

  tick(partyA: Party, partyB: Party): void {
    if (!this.state.active) return;
    this.state.elapsedSeconds += 1;
    this.state.enraged = this.state.elapsedSeconds >= IGNIS.enrageSeconds;
    const raidDamage = [...partyA.livingHeroes, ...partyB.livingHeroes].reduce((sum, hero) => sum + hero.stats.attack, 0);
    this.state.bossHp = Math.max(0, this.state.bossHp - raidDamage * (this.state.enraged ? 0.5 : 1));
    const hpRatio = this.state.bossHp / IGNIS.maxHp;
    const nextPhase = hpRatio <= 0.3 ? 3 : hpRatio <= 0.65 ? 2 : 1;
    if (nextPhase !== this.state.phase) {
      this.state.phase = nextPhase;
      this.bus.emit('raid:phase', { phase: nextPhase });
      if (nextPhase === 2) this.state.addsAlive = 4;
    }
    const activeTank: 'A' | 'B' = Math.floor(this.state.elapsedSeconds / 12) % 2 === 0 ? 'A' : 'B';
    this.state.tankDebuffStacks[activeTank] += 1;
    if (this.state.tankDebuffStacks[activeTank] >= RAID_TANK_SWAP_STACKS) this.state.tankDebuffStacks[activeTank] = 0;
    if (this.state.phase === 2 && this.state.elapsedSeconds % 8 === 0 && this.state.addsAlive > 0) this.state.addsAlive -= 1;
    if (this.state.bossHp <= 0) this.state.active = false;
  }

  private freshState(): RaidState {
    return { active: false, elapsedSeconds: 0, bossHp: IGNIS.maxHp, phase: 1, tankDebuffStacks: { A: 0, B: 0 }, addsAlive: 0, enraged: false };
  }
}
