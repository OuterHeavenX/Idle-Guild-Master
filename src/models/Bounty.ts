export interface Bounty {
  id: string;
  title: string;
  cadence: 'daily' | 'weekly';
  goal: number;
  progress: number;
  rewardGold: number;
  completed: boolean;
}
