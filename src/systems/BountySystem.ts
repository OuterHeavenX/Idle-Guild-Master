import type { Bounty } from '../models/Bounty';
import type { Guild } from '../models/Guild';

export class BountySystem {
  readonly bounties: Bounty[] = [
    { id: 'daily-kills', title: 'Defeat 20 enemies', cadence: 'daily', goal: 20, progress: 0, rewardGold: 300, completed: false },
    { id: 'weekly-raids', title: 'Enter 3 raids', cadence: 'weekly', goal: 3, progress: 0, rewardGold: 1500, completed: false }
  ];

  progress(id: string, amount: number, guild: Guild): void {
    const bounty = this.bounties.find((entry) => entry.id === id);
    if (!bounty || bounty.completed) return;
    bounty.progress = Math.min(bounty.goal, bounty.progress + amount);
    if (bounty.progress >= bounty.goal) {
      bounty.completed = true;
      guild.gold += bounty.rewardGold;
    }
  }
}
