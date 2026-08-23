import { Hero, createStarterHero, type HeroSave, type HeroStats } from '../models/Hero';
import { Guild, type GuildSave } from '../models/Guild';
import type { Item } from '../models/Item';
import type { QuestState } from '../content/story/ashenCryptIntro';
import { EventBus } from './EventBus';

export type WorldLocation = 'town' | 'guildHall' | 'blacksmith' | 'ashenCrypt';
export type CryptCheckpoint = 'entrance' | 'firstZoneCleared';

export interface WorldPosition { x: number; y: number }
export interface WorldSave {
  location: WorldLocation;
  positions: Record<WorldLocation, WorldPosition>;
  spawnId: string;
}
export interface StorySave {
  quest: QuestState;
  cryptObjectiveComplete: boolean;
  rewardGranted: boolean;
  playerX: number;
  playerY: number;
}
export interface CryptSave {
  checkpoint: CryptCheckpoint;
  encounterIndex: number;
  objectiveComplete: boolean;
}
export interface DungeonSave { ashenCrypt: CryptSave }
export interface ResourceGrant { gold?: number; gems?: number; shards?: number; essences?: number }

export interface LegacyGameSave {
  version: 1;
  savedAt: number;
  heroes: HeroSave[];
  guild: GuildSave;
  activeView: string;
  zoneLevel: number;
  story?: StorySave;
}

export interface GameSaveV2 {
  version: 2;
  revision: number;
  savedAt: number;
  heroes: HeroSave[];
  guild: GuildSave;
  /** Compatibility projection only. Physical location is world.location. */
  activeView: string;
  zoneLevel: number;
  story: StorySave;
  world: WorldSave;
  inventory: Item[];
  claimedRewards: Record<string, number>;
  dungeon: DungeonSave;
}

export type GameSave = GameSaveV2;
export const SAVE_KEY = 'idle-guild-master-save';
export const LEGACY_SAVE_KEY = 'idle-guild-master-save-v1';
export const EMBERS_REWARD_ID = 'quest:embers-beneath-the-crypt:completion:v1';

const QUEST_ORDER: QuestState[] = [
  'NOT_STARTED', 'INTRODUCED', 'ACCEPTED', 'PARTY_MET', 'PREPARED',
  'ENTERED_CRYPT', 'CRYPT_ATTEMPTED', 'CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE',
];
const WORLD_LOCATIONS: WorldLocation[] = ['town', 'guildHall', 'blacksmith', 'ashenCrypt'];
const ITEM_SLOTS: Item['slot'][] = ['weapon', 'armor', 'accessory'];
const RARITIES: Item['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const WORLD_DEFAULTS: Record<WorldLocation, WorldPosition> = {
  town: { x: 0.5, y: 0.76 },
  guildHall: { x: 0.5, y: 0.82 },
  blacksmith: { x: 0.5, y: 0.82 },
  ashenCrypt: { x: 0.5, y: 0.82 },
};
const SPAWN_DEFAULTS: Record<WorldLocation, string> = {
  town: 'town:start',
  guildHall: 'guildHall:entrance',
  blacksmith: 'blacksmith:entrance',
  ashenCrypt: 'ashenCrypt:entrance',
};
const FACILITY_DEFAULTS: GuildSave['facilities'] = {
  guildHall: 1, forge: 1, alchemy: 1, trainingGrounds: 1, expeditionHQ: 1,
};

const defaultStory = (): StorySave => ({
  quest: 'NOT_STARTED', cryptObjectiveComplete: false, rewardGranted: false,
  playerX: WORLD_DEFAULTS.town.x, playerY: WORLD_DEFAULTS.town.y,
});
const defaultWorld = (): WorldSave => ({
  location: 'town',
  positions: {
    town: { ...WORLD_DEFAULTS.town }, guildHall: { ...WORLD_DEFAULTS.guildHall },
    blacksmith: { ...WORLD_DEFAULTS.blacksmith }, ashenCrypt: { ...WORLD_DEFAULTS.ashenCrypt },
  },
  spawnId: SPAWN_DEFAULTS.town,
});
const defaultDungeon = (): DungeonSave => ({
  ashenCrypt: { checkpoint: 'entrance', encounterIndex: 0, objectiveComplete: false },
});
const starterHeroes = (): Hero[] => [
  createStarterHero('hero-1', 'Aldric', 'guardian'), createStarterHero('hero-2', 'Mira', 'cleric'),
  createStarterHero('hero-3', 'Nyx', 'ranger'), createStarterHero('hero-4', 'Orin', 'arcanist'),
  createStarterHero('hero-5', 'Bran', 'guardian'), createStarterHero('hero-6', 'Elowen', 'cleric'),
  createStarterHero('hero-7', 'Kael', 'ranger'), createStarterHero('hero-8', 'Veyra', 'arcanist'),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const finiteInt = (value: unknown, fallback: number, min = 0): number =>
  Math.max(min, Math.floor(finite(value, fallback)));
const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.max(min, Math.min(max, finite(value, fallback)));
const stringValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;
const normalizePosition = (value: unknown, fallback: WorldPosition): WorldPosition => {
  const raw = isRecord(value) ? value : {};
  return { x: clamp(raw.x, 0.02, 0.98, fallback.x), y: clamp(raw.y, 0.02, 0.98, fallback.y) };
};
const normalizeTownPosition = (value: unknown, fallback: WorldPosition): WorldPosition => {
  const raw = isRecord(value) ? value : {};
  return { x: clamp(raw.x, 0.08, 0.92, fallback.x), y: clamp(raw.y, 0.12, 0.88, fallback.y) };
};

const normalizeStory = (value: unknown): StorySave => {
  const raw = isRecord(value) ? value : {};
  const story: StorySave = {
    quest: QUEST_ORDER.includes(raw.quest as QuestState) ? raw.quest as QuestState : 'NOT_STARTED',
    cryptObjectiveComplete: raw.cryptObjectiveComplete === true,
    rewardGranted: raw.rewardGranted === true,
    playerX: clamp(raw.playerX, 0.08, 0.92, WORLD_DEFAULTS.town.x),
    playerY: clamp(raw.playerY, 0.12, 0.88, WORLD_DEFAULTS.town.y),
  };
  if (story.rewardGranted) {
    story.cryptObjectiveComplete = true;
    story.quest = 'COMPLETE';
  } else if (story.cryptObjectiveComplete
    && QUEST_ORDER.indexOf(story.quest) < QUEST_ORDER.indexOf('CRYPT_CLEARED')) {
    story.quest = 'CRYPT_CLEARED';
  }
  return story;
};

const normalizeHeroStats = (value: unknown, fallback: HeroStats): HeroStats => {
  const raw = isRecord(value) ? value : {};
  return {
    maxHp: finiteInt(raw.maxHp, fallback.maxHp, 1), attack: finiteInt(raw.attack, fallback.attack),
    defense: finiteInt(raw.defense, fallback.defense),
    critChance: clamp(raw.critChance, 0, 0.95, fallback.critChance),
    blockChance: clamp(raw.blockChance, 0, 0.8, fallback.blockChance),
    haste: Math.max(0, finite(raw.haste, fallback.haste)),
  };
};
const normalizeEquipment = (value: unknown): Record<string, string | null> => {
  const result: Record<string, string | null> = {};
  if (isRecord(value)) Object.entries(value).forEach(([slot, itemId]) => {
    if (typeof itemId === 'string' || itemId === null) result[slot] = itemId;
  });
  ITEM_SLOTS.forEach((slot) => { if (!(slot in result)) result[slot] = null; });
  return result;
};
const normalizeHero = (value: unknown, index: number): HeroSave | null => {
  if (!isRecord(value)) return null;
  const fallback = starterHeroes()[index] ?? createStarterHero(`hero-${index + 1}`, `Hero ${index + 1}`);
  const stats = normalizeHeroStats(value.stats, fallback.stats);
  return {
    id: stringValue(value.id, fallback.id), name: stringValue(value.name, fallback.name),
    level: finiteInt(value.level, fallback.level, 1), xp: finiteInt(value.xp, fallback.xp),
    jobId: stringValue(value.jobId, fallback.jobId), jobLevel: finiteInt(value.jobLevel, fallback.jobLevel, 1),
    jp: finiteInt(value.jp, fallback.jp),
    masteryPassives: Array.isArray(value.masteryPassives)
      ? value.masteryPassives.filter((entry): entry is string => typeof entry === 'string') : [],
    stats, currentHp: clamp(value.currentHp, 0, stats.maxHp, stats.maxHp),
    equipment: normalizeEquipment(value.equipment),
  };
};
const normalizeHeroes = (value: unknown): HeroSave[] => {
  if (!Array.isArray(value)) return starterHeroes().map((hero) => ({ ...hero }));
  const heroes = value.map(normalizeHero).filter((entry): entry is HeroSave => entry !== null);
  return heroes.length ? heroes : starterHeroes().map((hero) => ({ ...hero }));
};
const normalizeGuild = (value: unknown): GuildSave => {
  const raw = isRecord(value) ? value : {};
  const facilities = isRecord(raw.facilities) ? raw.facilities : {};
  return {
    gold: finiteInt(raw.gold, 500), gems: finiteInt(raw.gems, 0),
    shards: finiteInt(raw.shards, 0), essences: finiteInt(raw.essences, 0),
    facilities: {
      guildHall: finiteInt(facilities.guildHall, FACILITY_DEFAULTS.guildHall, 1),
      forge: finiteInt(facilities.forge, FACILITY_DEFAULTS.forge, 1),
      alchemy: finiteInt(facilities.alchemy, FACILITY_DEFAULTS.alchemy, 1),
      trainingGrounds: finiteInt(facilities.trainingGrounds, FACILITY_DEFAULTS.trainingGrounds, 1),
      expeditionHQ: finiteInt(facilities.expeditionHQ, FACILITY_DEFAULTS.expeditionHQ, 1),
    },
  };
};
const normalizeItem = (value: unknown): Item | null => {
  if (!isRecord(value) || !ITEM_SLOTS.includes(value.slot as Item['slot'])
    || !RARITIES.includes(value.rarity as Item['rarity'])) return null;
  const id = stringValue(value.id, '');
  if (!id) return null;
  return {
    id, name: stringValue(value.name, 'Unknown item'), slot: value.slot as Item['slot'],
    itemLevel: finiteInt(value.itemLevel, 1, 1), rarity: value.rarity as Item['rarity'],
    statBudget: finiteInt(value.statBudget, 0), sockets: Math.min(3, finiteInt(value.sockets, 0)),
    affixes: Array.isArray(value.affixes)
      ? value.affixes.filter((entry): entry is string => typeof entry === 'string') : [],
  };
};
const normalizeInventory = (value: unknown): Item[] => {
  const rawItems = Array.isArray(value) ? value
    : isRecord(value) && Array.isArray(value.items) ? value.items : [];
  const seen = new Set<string>();
  return rawItems.map(normalizeItem).filter((item): item is Item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
const normalizeClaims = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {};
  const claims: Record<string, number> = {};
  Object.entries(value).forEach(([id, claimedAt]) => {
    if (id) claims[id] = Math.max(0, finite(claimedAt, 0));
  });
  return claims;
};
const normalizeDungeon = (value: unknown, story: StorySave): DungeonSave => {
  const raw = isRecord(value) && isRecord(value.ashenCrypt) ? value.ashenCrypt : {};
  const objectiveComplete = raw.objectiveComplete === true || story.cryptObjectiveComplete;
  return { ashenCrypt: {
    checkpoint: objectiveComplete || raw.checkpoint === 'firstZoneCleared' ? 'firstZoneCleared' : 'entrance',
    encounterIndex: finiteInt(raw.encounterIndex, 0), objectiveComplete,
  } };
};
const normalizeWorld = (value: unknown, story: StorySave, dungeon: DungeonSave): WorldSave => {
  const raw = isRecord(value) ? value : {};
  const rawPositions = isRecord(raw.positions) ? raw.positions : {};
  const location = WORLD_LOCATIONS.includes(raw.location as WorldLocation)
    ? raw.location as WorldLocation : 'town';
  const positions: WorldSave['positions'] = {
    town: normalizeTownPosition(rawPositions.town, { x: story.playerX, y: story.playerY }),
    guildHall: normalizePosition(rawPositions.guildHall, WORLD_DEFAULTS.guildHall),
    blacksmith: normalizePosition(rawPositions.blacksmith, WORLD_DEFAULTS.blacksmith),
    ashenCrypt: normalizePosition(rawPositions.ashenCrypt, WORLD_DEFAULTS.ashenCrypt),
  };
  let spawnId = stringValue(raw.spawnId, SPAWN_DEFAULTS[location]);
  if (location === 'ashenCrypt') {
    positions.ashenCrypt = { ...WORLD_DEFAULTS.ashenCrypt };
    spawnId = dungeon.ashenCrypt.checkpoint === 'firstZoneCleared'
      ? 'ashenCrypt:firstZoneCleared' : SPAWN_DEFAULTS.ashenCrypt;
  }
  return { location, positions, spawnId };
};

const cloneItem = (item: Item): Item => ({ ...item, affixes: [...item.affixes] });
const cloneHeroSave = (hero: HeroSave): HeroSave => ({
  ...hero, masteryPassives: [...hero.masteryPassives], stats: { ...hero.stats }, equipment: { ...hero.equipment },
});
const cloneGuildSave = (guild: GuildSave): GuildSave => ({ ...guild, facilities: { ...guild.facilities } });

const normalizeV2 = (value: unknown): GameSaveV2 => {
  if (!isRecord(value) || value.version !== 2) throw new Error('Unsupported save version.');
  if (!Array.isArray(value.heroes)) throw new Error('Save data does not contain a hero roster.');
  const story = normalizeStory(value.story);
  const claimedRewards = normalizeClaims(value.claimedRewards);
  if (story.rewardGranted || story.quest === 'COMPLETE') {
    claimedRewards[EMBERS_REWARD_ID] ??= finite(value.savedAt, 0);
  }
  if (EMBERS_REWARD_ID in claimedRewards) {
    story.rewardGranted = true;
    story.cryptObjectiveComplete = true;
    story.quest = 'COMPLETE';
  }
  const dungeon = normalizeDungeon(value.dungeon, story);
  if (dungeon.ashenCrypt.objectiveComplete) {
    story.cryptObjectiveComplete = true;
    if (QUEST_ORDER.indexOf(story.quest) < QUEST_ORDER.indexOf('CRYPT_CLEARED')) {
      story.quest = 'CRYPT_CLEARED';
    }
  }
  const world = normalizeWorld(value.world, story, dungeon);
  story.playerX = world.positions.town.x;
  story.playerY = world.positions.town.y;
  return {
    version: 2, revision: finiteInt(value.revision, 0), savedAt: finite(value.savedAt, Date.now()),
    heroes: normalizeHeroes(value.heroes), guild: normalizeGuild(value.guild),
    activeView: world.location === 'ashenCrypt' ? 'dungeon' : 'town',
    zoneLevel: finiteInt(value.zoneLevel, 1, 1), story, world,
    inventory: normalizeInventory(value.inventory), claimedRewards, dungeon,
  };
};
const migrateV1 = (value: unknown): GameSaveV2 => {
  if (!isRecord(value) || value.version !== 1) throw new Error('Unsupported save version.');
  if (!Array.isArray(value.heroes)) throw new Error('Legacy save data does not contain a hero roster.');
  const story = normalizeStory(value.story);
  const claimedRewards: Record<string, number> = {};
  if (story.rewardGranted || story.quest === 'COMPLETE') {
    claimedRewards[EMBERS_REWARD_ID] = Math.max(0, finite(value.savedAt, 0));
    story.rewardGranted = true;
    story.cryptObjectiveComplete = true;
    story.quest = 'COMPLETE';
  }
  const dungeon = normalizeDungeon(undefined, story);
  const world = defaultWorld();
  world.positions.town = normalizeTownPosition({ x: story.playerX, y: story.playerY }, WORLD_DEFAULTS.town);
  story.playerX = world.positions.town.x;
  story.playerY = world.positions.town.y;
  return {
    version: 2, revision: 0, savedAt: finite(value.savedAt, Date.now()),
    heroes: normalizeHeroes(value.heroes), guild: normalizeGuild(value.guild), activeView: 'town',
    zoneLevel: finiteInt(value.zoneLevel, 1, 1), story, world, inventory: [], claimedRewards, dungeon,
  };
};
const decodeSave = (value: unknown): GameSaveV2 => {
  if (!isRecord(value)) throw new Error('Save data must be an object.');
  if (value.version === 2) return normalizeV2(value);
  if (value.version === 1) return migrateV1(value);
  throw new Error('Unsupported save version.');
};
const normalizeGrant = (grant: ResourceGrant): Required<ResourceGrant> => ({
  gold: finiteInt(grant.gold, 0), gems: finiteInt(grant.gems, 0),
  shards: finiteInt(grant.shards, 0), essences: finiteInt(grant.essences, 0),
});

export class StateManager {
  heroes: Hero[];
  guild: Guild;
  activeView = 'town';
  zoneLevel = 1;
  story: StorySave = defaultStory();
  world: WorldSave = defaultWorld();
  inventory: Item[] = [];
  claimedRewards: Record<string, number> = {};
  dungeon: DungeonSave = defaultDungeon();
  loadError: string | null = null;
  saveError: string | null = null;
  private revision = 0;
  private savedAt = Date.now();

  constructor(private bus: EventBus) {
    this.heroes = starterHeroes();
    this.guild = new Guild();
  }

  snapshot(): GameSaveV2 {
    this.syncLegacyStoryPosition();
    return {
      version: 2, revision: this.revision, savedAt: Date.now(),
      heroes: this.heroes.map(cloneHeroSave), guild: cloneGuildSave(this.guild),
      activeView: this.activeView, zoneLevel: this.zoneLevel, story: { ...this.story },
      world: { location: this.world.location, positions: {
        town: { ...this.world.positions.town }, guildHall: { ...this.world.positions.guildHall },
        blacksmith: { ...this.world.positions.blacksmith }, ashenCrypt: { ...this.world.positions.ashenCrypt },
      }, spawnId: this.world.spawnId },
      inventory: this.inventory.map(cloneItem), claimedRewards: { ...this.claimedRewards },
      dungeon: { ashenCrypt: { ...this.dungeon.ashenCrypt } },
    };
  }

  save(): void {
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    try {
      this.persistCandidate(candidate, () => undefined);
      this.saveError = null;
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : String(error);
      console.warn('[save] Progress could not be persisted:', error);
    }
  }

  /** Hydrates state without writing either the V2 or untouched V1 key. */
  load(): GameSaveV2 | null {
    this.loadError = null;
    const candidates: Array<[string, string | null]> = [];
    try { candidates.push([SAVE_KEY, this.readStorage(SAVE_KEY)]); }
    catch (error) { this.recordLoadError(SAVE_KEY, error); }
    try { candidates.push([LEGACY_SAVE_KEY, this.readStorage(LEGACY_SAVE_KEY)]); }
    catch (error) { this.recordLoadError(LEGACY_SAVE_KEY, error); }
    for (const [key, raw] of candidates) {
      if (!raw) continue;
      try {
        const save = decodeSave(JSON.parse(raw) as unknown);
        this.applyCanonical(save);
        return save;
      } catch (error) { this.recordLoadError(key, error); }
    }
    return null;
  }

  /** Applies V1 or V2 data in memory only. */
  apply(save: GameSaveV2 | LegacyGameSave): void { this.applyCanonical(decodeSave(save)); }

  setQuest(quest: QuestState): void {
    if (!QUEST_ORDER.includes(quest) || this.story.quest === quest) return;
    this.story.quest = quest;
    if (QUEST_ORDER.indexOf(quest) >= QUEST_ORDER.indexOf('CRYPT_CLEARED')) {
      this.story.cryptObjectiveComplete = true;
    }
    this.save();
  }

  setLocation(location: WorldLocation, spawnId = SPAWN_DEFAULTS[location]): void {
    if (!WORLD_LOCATIONS.includes(location)) return;
    this.world.location = location;
    this.world.spawnId = spawnId;
    this.activeView = location === 'ashenCrypt' ? 'dungeon' : 'town';
    if (location === 'ashenCrypt') {
      this.world.positions.ashenCrypt = { ...WORLD_DEFAULTS.ashenCrypt };
      if (spawnId === SPAWN_DEFAULTS.ashenCrypt && this.dungeon.ashenCrypt.checkpoint === 'firstZoneCleared') {
        this.world.spawnId = 'ashenCrypt:firstZoneCleared';
      }
    }
    this.save();
  }

  setWorldPosition(location: WorldLocation, x: number, y: number): void {
    if (!WORLD_LOCATIONS.includes(location)) return;
    const fallback = WORLD_DEFAULTS[location];
    this.world.positions[location] = location === 'town'
      ? normalizeTownPosition({ x, y }, fallback) : normalizePosition({ x, y }, fallback);
    if (location === 'town') this.syncLegacyStoryPosition();
  }

  worldPosition(location: WorldLocation = this.world.location): WorldPosition {
    return { ...this.world.positions[location] };
  }

  setTownPosition(x: number, y: number): void { this.setWorldPosition('town', x, y); }

  markCryptVictory(encounterIndex = this.dungeon.ashenCrypt.encounterIndex): void {
    this.dungeon.ashenCrypt.objectiveComplete = true;
    this.dungeon.ashenCrypt.checkpoint = 'firstZoneCleared';
    this.dungeon.ashenCrypt.encounterIndex = Math.max(0, Math.floor(finite(encounterIndex, 0)));
    this.story.cryptObjectiveComplete = true;
    if (this.story.quest === 'ENTERED_CRYPT' || this.story.quest === 'CRYPT_ATTEMPTED') {
      this.story.quest = 'CRYPT_CLEARED';
    }
    this.save();
  }

  setCryptEncounter(encounterIndex: number): void {
    this.dungeon.ashenCrypt.encounterIndex = Math.max(0, Math.floor(finite(encounterIndex, 0)));
  }

  resetCryptEncounter(): void {
    this.dungeon.ashenCrypt.encounterIndex = 0;
    this.dungeon.ashenCrypt.checkpoint = this.dungeon.ashenCrypt.objectiveComplete
      ? 'firstZoneCleared' : 'entrance';
    this.world.positions.ashenCrypt = { ...WORLD_DEFAULTS.ashenCrypt };
    if (this.world.location === 'ashenCrypt') {
      this.world.spawnId = this.dungeon.ashenCrypt.checkpoint === 'firstZoneCleared'
        ? 'ashenCrypt:firstZoneCleared' : SPAWN_DEFAULTS.ashenCrypt;
    }
    this.save();
  }

  hasClaimedReward(rewardId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.claimedRewards, rewardId);
  }

  /** Persists ledger and currencies as one snapshot before changing runtime values. */
  claimReward(rewardId: string, grant: ResourceGrant): boolean {
    if (!rewardId || this.hasClaimedReward(rewardId)) return false;
    const normalized = normalizeGrant(grant);
    const claimedAt = Date.now();
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    candidate.guild.gold += normalized.gold;
    candidate.guild.gems += normalized.gems;
    candidate.guild.shards += normalized.shards;
    candidate.guild.essences += normalized.essences;
    candidate.claimedRewards[rewardId] = claimedAt;
    if (rewardId === EMBERS_REWARD_ID) {
      candidate.story.rewardGranted = true;
      candidate.story.cryptObjectiveComplete = true;
      candidate.story.quest = 'COMPLETE';
      candidate.dungeon.ashenCrypt.objectiveComplete = true;
      candidate.dungeon.ashenCrypt.checkpoint = 'firstZoneCleared';
    }
    this.persistCandidate(candidate, () => {
      this.guild.gold += normalized.gold;
      this.guild.gems += normalized.gems;
      this.guild.shards += normalized.shards;
      this.guild.essences += normalized.essences;
      this.claimedRewards[rewardId] = claimedAt;
      if (rewardId === EMBERS_REWARD_ID) {
        this.story.rewardGranted = true;
        this.story.cryptObjectiveComplete = true;
        this.story.quest = 'COMPLETE';
        this.dungeon.ashenCrypt.objectiveComplete = true;
        this.dungeon.ashenCrypt.checkpoint = 'firstZoneCleared';
      }
    });
    return true;
  }

  addInventory(item: Item): Item {
    const normalized = normalizeItem(item);
    if (!normalized) throw new Error('Invalid item.');
    if (this.inventory.some((entry) => entry.id === normalized.id)) {
      throw new Error(`Inventory already contains item ${normalized.id}.`);
    }
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    candidate.inventory.push(cloneItem(normalized));
    this.persistCandidate(candidate, () => this.inventory.push(cloneItem(normalized)));
    return cloneItem(normalized);
  }

  craftInventoryItem(item: Item, cost: ResourceGrant): Item {
    const normalized = normalizeItem(item);
    if (!normalized) throw new Error('Invalid crafted item.');
    if (this.inventory.some((entry) => entry.id === normalized.id)) {
      throw new Error(`Inventory already contains item ${normalized.id}.`);
    }
    const normalizedCost = normalizeGrant(cost);
    this.assertCanSpend(normalizedCost);
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    candidate.guild.gold -= normalizedCost.gold;
    candidate.guild.gems -= normalizedCost.gems;
    candidate.guild.shards -= normalizedCost.shards;
    candidate.guild.essences -= normalizedCost.essences;
    candidate.inventory.push(cloneItem(normalized));
    this.persistCandidate(candidate, () => {
      this.spendInMemory(normalizedCost);
      this.inventory.push(cloneItem(normalized));
    });
    return cloneItem(normalized);
  }

  salvageInventoryItem(itemId: string, grant: ResourceGrant): Item {
    const index = this.inventory.findIndex((item) => item.id === itemId);
    if (index < 0) throw new Error('Item is not in inventory.');
    if (this.heroes.some((hero) => Object.values(hero.equipment).includes(itemId))) {
      throw new Error('Unequip the item before salvaging it.');
    }
    const item = this.inventory[index]!;
    const normalizedGrant = normalizeGrant(grant);
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    candidate.inventory.splice(index, 1);
    candidate.guild.gold += normalizedGrant.gold;
    candidate.guild.gems += normalizedGrant.gems;
    candidate.guild.shards += normalizedGrant.shards;
    candidate.guild.essences += normalizedGrant.essences;
    this.persistCandidate(candidate, () => {
      this.inventory.splice(index, 1);
      this.guild.gold += normalizedGrant.gold;
      this.guild.gems += normalizedGrant.gems;
      this.guild.shards += normalizedGrant.shards;
      this.guild.essences += normalizedGrant.essences;
    });
    return cloneItem(item);
  }

  refineInventoryItem(itemId: string, replacement: Item, essenceCost = 1): Item {
    const index = this.inventory.findIndex((item) => item.id === itemId);
    if (index < 0) throw new Error('Item is not in inventory.');
    const normalized = normalizeItem(replacement);
    if (!normalized || normalized.id !== itemId) throw new Error('Refinement must preserve the item id.');
    const cost = normalizeGrant({ essences: essenceCost });
    this.assertCanSpend(cost);
    const candidate = this.snapshot();
    candidate.revision = this.revision + 1;
    candidate.guild.essences -= cost.essences;
    candidate.inventory[index] = cloneItem(normalized);
    this.persistCandidate(candidate, () => {
      this.guild.essences -= cost.essences;
      this.inventory[index] = cloneItem(normalized);
    });
    return cloneItem(normalized);
  }

  exportJson(): string { return JSON.stringify(this.snapshot()); }

  importJson(raw: string): void {
    let parsed: unknown;
    try { parsed = JSON.parse(raw) as unknown; }
    catch { throw new Error('Save data is not valid JSON.'); }
    const candidate = decodeSave(parsed);
    candidate.revision = Math.max(candidate.revision, this.revision) + 1;
    candidate.savedAt = Date.now();
    this.writeStorage(SAVE_KEY, JSON.stringify(candidate));
    this.applyCanonical(candidate);
    this.bus.emit('save:complete', undefined);
  }

  private applyCanonical(save: GameSaveV2): void {
    this.heroes = save.heroes.map((hero) => new Hero(cloneHeroSave(hero)));
    this.guild = new Guild(cloneGuildSave(save.guild));
    this.zoneLevel = save.zoneLevel;
    this.story = { ...save.story };
    this.world = { location: save.world.location, positions: {
      town: { ...save.world.positions.town }, guildHall: { ...save.world.positions.guildHall },
      blacksmith: { ...save.world.positions.blacksmith }, ashenCrypt: { ...save.world.positions.ashenCrypt },
    }, spawnId: save.world.spawnId };
    this.inventory = save.inventory.map(cloneItem);
    this.claimedRewards = { ...save.claimedRewards };
    this.dungeon = { ashenCrypt: { ...save.dungeon.ashenCrypt } };
    this.activeView = this.world.location === 'ashenCrypt' ? 'dungeon' : 'town';
    this.revision = save.revision;
    this.savedAt = save.savedAt;
    this.syncLegacyStoryPosition();
    const party = this.heroes.slice(0, 4);
    if (party.length > 0 && party.every((hero) => !hero.alive)) {
      party.forEach((hero) => hero.heal(hero.stats.maxHp));
    }
  }

  private syncLegacyStoryPosition(): void {
    this.story.playerX = this.world.positions.town.x;
    this.story.playerY = this.world.positions.town.y;
  }
  private assertCanSpend(cost: Required<ResourceGrant>): void {
    if (this.guild.gold < cost.gold || this.guild.gems < cost.gems
      || this.guild.shards < cost.shards || this.guild.essences < cost.essences) {
      throw new Error('Insufficient materials.');
    }
  }
  private spendInMemory(cost: Required<ResourceGrant>): void {
    this.guild.gold -= cost.gold;
    this.guild.gems -= cost.gems;
    this.guild.shards -= cost.shards;
    this.guild.essences -= cost.essences;
  }
  private persistCandidate(candidate: GameSaveV2, applyRuntime: () => void): void {
    candidate.savedAt = Date.now();
    this.writeStorage(SAVE_KEY, JSON.stringify(candidate));
    applyRuntime();
    this.revision = candidate.revision;
    this.savedAt = candidate.savedAt;
    this.bus.emit('save:complete', undefined);
  }
  private readStorage(key: string): string | null {
    if (typeof localStorage === 'undefined') throw new Error('Local storage is unavailable.');
    return localStorage.getItem(key);
  }
  private writeStorage(key: string, value: string): void {
    if (typeof localStorage === 'undefined') throw new Error('Local storage is unavailable.');
    localStorage.setItem(key, value);
  }
  private recordLoadError(key: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.loadError = `${key}: ${message}`;
    console.warn(`[save] Could not load ${key}:`, error);
  }
}
