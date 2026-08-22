import type { Rarity } from '../config/items.config';
import { statBudget } from '../math/CombatMath';

export interface Item {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'accessory';
  itemLevel: number;
  rarity: Rarity;
  statBudget: number;
  sockets: number;
  affixes: string[];
}

export const generateItem = (name: string, slot: Item['slot'], itemLevel: number, rarity: Rarity): Item => ({
  id: crypto.randomUUID(),
  name,
  slot,
  itemLevel,
  rarity,
  statBudget: Math.round(statBudget(10, itemLevel, rarity)),
  sockets: rarity === 'legendary' ? 2 : rarity === 'epic' ? 1 : 0,
  affixes: []
});
