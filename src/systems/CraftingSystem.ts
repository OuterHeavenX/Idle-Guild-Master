import { CRAFTING_RECIPES, type Rarity } from '../config/items.config';
import { generateItem, type Item } from '../models/Item';
import type { Guild } from '../models/Guild';

export class CraftingSystem {
  forge(guild: Guild, slot: Item['slot'], itemLevel: number, rarity: Rarity = 'common'): Item {
    const recipe = CRAFTING_RECIPES[slot];
    if (guild.gold < recipe.gold || guild.shards < recipe.shards) throw new Error('Insufficient materials.');
    guild.gold -= recipe.gold;
    guild.shards -= recipe.shards;
    return generateItem(`${rarity} ${slot}`, slot, itemLevel, rarity);
  }
  salvage(guild: Guild, item: Item): void {
    guild.shards += Math.max(1, Math.floor(item.statBudget / 10));
    if (item.rarity === 'epic' || item.rarity === 'legendary') guild.essences += 1;
  }
  refine(guild: Guild, item: Item): Item {
    if (guild.essences < 1) throw new Error('An essence is required.');
    guild.essences -= 1;
    return { ...item, sockets: Math.min(3, item.sockets + 1) };
  }
}
