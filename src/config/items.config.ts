export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  epic: 2.1,
  legendary: 3
};

export interface LootTableEntry { rarity: Rarity; weight: number; }

export const DEFAULT_LOOT_TABLE: LootTableEntry[] = [
  { rarity: 'common', weight: 55 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 12 },
  { rarity: 'epic', weight: 6 },
  { rarity: 'legendary', weight: 2 }
];

export const CRAFTING_RECIPES = {
  weapon: { gold: 100, shards: 10 },
  armor: { gold: 90, shards: 8 },
  accessory: { gold: 120, shards: 12 }
} as const;
