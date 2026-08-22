import { RARITY_MULTIPLIERS, type Rarity } from '../config/items.config';

export const statBudget = (baseValue: number, itemLevel: number, rarity: Rarity): number =>
  baseValue * (1 + itemLevel * 0.1) * RARITY_MULTIPLIERS[rarity];

export const mitigateDamage = (rawDamage: number, defense: number): number => {
  const reduction = defense / (defense + 100);
  return Math.max(1, Math.floor(rawDamage * (1 - reduction)));
};

export const rollCritical = (critChance: number, rng = Math.random): boolean =>
  rng() < Math.max(0, Math.min(0.95, critChance));

export const applyCritical = (damage: number, critMultiplier = 1.5): number =>
  Math.floor(damage * critMultiplier);

export const rollBlock = (blockChance: number, rng = Math.random): boolean =>
  rng() < Math.max(0, Math.min(0.8, blockChance));
