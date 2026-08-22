export type FacilityId = 'guildHall' | 'forge' | 'alchemy' | 'trainingGrounds' | 'expeditionHQ';

export interface FacilityConfig {
  id: FacilityId;
  name: string;
  baseCost: number;
  growth: number;
}

export const FACILITIES: FacilityConfig[] = [
  { id: 'guildHall', name: 'Guild Hall', baseCost: 100, growth: 1.6 },
  { id: 'forge', name: 'Forge', baseCost: 150, growth: 1.65 },
  { id: 'alchemy', name: 'Alchemy', baseCost: 160, growth: 1.65 },
  { id: 'trainingGrounds', name: 'Training Grounds', baseCost: 180, growth: 1.7 },
  { id: 'expeditionHQ', name: 'Expedition HQ', baseCost: 220, growth: 1.8 }
];

export const expeditionOfflineCapHours = (level: number): number => Math.min(24, 4 + Math.max(0, level - 1) * 2);
