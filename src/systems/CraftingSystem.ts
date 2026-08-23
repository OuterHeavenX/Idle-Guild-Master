import { CRAFTING_RECIPES, type Rarity } from '../config/items.config';
import { generateItem, type Item } from '../models/Item';
import type { Guild } from '../models/Guild';
import type { StateManager } from '../core/StateManager';

export class CraftingSystem {
  /** Legacy resource-only primitive. World Forge UI should use forgeIntoInventory. */
  forge(guild: Guild, slot: Item['slot'], itemLevel: number, rarity: Rarity = 'common'): Item {
    const recipe = CRAFTING_RECIPES[slot];
    if (guild.gold < recipe.gold || guild.shards < recipe.shards) throw new Error('Insufficient materials.');
    // Generate before charging so UUID failure cannot consume materials.
    const item = generateItem(`${rarity} ${slot}`, slot, itemLevel, rarity);
    guild.gold -= recipe.gold;
    guild.shards -= recipe.shards;
    return item;
  }

  /** Charges resources and inserts the crafted item in one durable StateManager transaction. */
  forgeIntoInventory(
    state: StateManager,
    slot: Item['slot'],
    itemLevel: number,
    rarity: Rarity = 'common',
  ): Item {
    const recipe = CRAFTING_RECIPES[slot];
    if (state.guild.gold < recipe.gold || state.guild.shards < recipe.shards) {
      throw new Error('Insufficient materials.');
    }
    const item = generateItem(`${rarity} ${slot}`, slot, itemLevel, rarity);
    return state.craftInventoryItem(item, recipe);
  }

  /** Legacy resource-only primitive. Owned inventory should use salvageFromInventory. */
  salvage(guild: Guild, item: Item): void {
    guild.shards += Math.max(1, Math.floor(item.statBudget / 10));
    if (item.rarity === 'epic' || item.rarity === 'legendary') guild.essences += 1;
  }

  salvageFromInventory(state: StateManager, itemId: string): Item {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) throw new Error('Item is not in inventory.');
    return state.salvageInventoryItem(itemId, {
      shards: Math.max(1, Math.floor(item.statBudget / 10)),
      essences: item.rarity === 'epic' || item.rarity === 'legendary' ? 1 : 0,
    });
  }

  /** Legacy resource-only primitive. Owned inventory should use refineInInventory. */
  refine(guild: Guild, item: Item): Item {
    if (guild.essences < 1) throw new Error('An essence is required.');
    guild.essences -= 1;
    return { ...item, sockets: Math.min(3, item.sockets + 1) };
  }

  refineInInventory(state: StateManager, itemId: string): Item {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) throw new Error('Item is not in inventory.');
    if (state.guild.essences < 1) throw new Error('An essence is required.');
    const refined = { ...item, affixes: [...item.affixes], sockets: Math.min(3, item.sockets + 1) };
    return state.refineInventoryItem(itemId, refined, 1);
  }
}
