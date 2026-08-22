export interface RaidBossConfig {
  id: string;
  name: string;
  maxHp: number;
  enrageSeconds: number;
  phases: Array<{ threshold: number; skills: string[] }>;
}

export const IGNIS: RaidBossConfig = {
  id: 'ignis',
  name: 'Ignis the Flame Sovereign',
  maxHp: 2_000_000,
  enrageSeconds: 360,
  phases: [
    { threshold: 1, skills: ['Scorching Brand', 'Flame Cleave'] },
    { threshold: 0.65, skills: ['Summon Cinderlings', 'Wildfire'] },
    { threshold: 0.3, skills: ['Cataclysm', 'Sovereign Fury'] }
  ]
};

export const RAID_TANK_SWAP_STACKS = 3;
