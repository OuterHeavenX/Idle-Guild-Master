import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

class MemoryStorage {
  #values = new Map();

  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.get(String(key)) ?? null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(String(key)); }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { EventBus } = await server.ssrLoadModule('/src/core/EventBus.ts');
  const {
    EMBERS_REWARD_ID,
    LEGACY_SAVE_KEY,
    SAVE_KEY,
    StateManager,
  } = await server.ssrLoadModule('/src/core/StateManager.ts');
  const { QuestSystem } = await server.ssrLoadModule('/src/systems/QuestSystem.ts');
  const { CraftingSystem } = await server.ssrLoadModule('/src/systems/CraftingSystem.ts');
  const { CRAFTING_RECIPES } = await server.ssrLoadModule('/src/config/items.config.ts');
  const { CombatSystem } = await server.ssrLoadModule('/src/systems/CombatSystem.ts');
  const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');

  const tests = [];
  const test = (name, run) => tests.push({ name, run });
  const installStorage = () => {
    const storage = new MemoryStorage();
    globalThis.localStorage = storage;
    return storage;
  };
  const withoutExpectedWarnings = (run) => {
    const warn = console.warn;
    console.warn = () => undefined;
    try { return run(); } finally { console.warn = warn; }
  };
  const advanceQuestToCrypt = (quests) => {
    assert.equal(quests.acceptQuest(), true);
    assert.equal(quests.meetParty(), true);
    assert.equal(quests.prepareAtForge(), true);
    assert.equal(quests.enterCrypt(), true);
    assert.equal(quests.stage, 'ENTERED_CRYPT');
  };
  const driveCombat = (combat, stop, maximumSeconds = 120) => {
    let elapsed = 0;
    while (!stop(combat.snapshot) && elapsed < maximumSeconds) {
      const snapshot = combat.snapshot;
      const dx = snapshot.enemy.position.x - snapshot.player.position.x;
      const dy = snapshot.enemy.position.y - snapshot.player.position.y;
      const distance = Math.hypot(dx, dy);
      const danger = snapshot.enemy.action === 'telegraph' || snapshot.enemy.action === 'strike';

      combat.setBlock(danger);
      if (distance > 70) combat.setMove(dx / (distance || 1), dy / (distance || 1));
      else combat.setMove(0, 0);
      if (!danger && (snapshot.player.action === 'idle' || snapshot.player.action === 'move')) {
        combat.requestAttack();
      }
      combat.update(1 / 60);
      elapsed += 1 / 60;
    }
    assert.ok(elapsed < maximumSeconds, `Combat timed out after ${maximumSeconds}s.`);
    return elapsed;
  };

  test('V1 migration preserves data and corrupt V2 falls back safely', () => {
    const storage = installStorage();
    const seed = new StateManager(new EventBus());
    const snapshot = seed.snapshot();
    snapshot.heroes[0].currentHp = 37;
    snapshot.guild.gold = 777;
    snapshot.guild.gems = 9;
    snapshot.guild.shards = 14;
    const legacy = {
      version: 1,
      savedAt: 1_700_000_000_000,
      heroes: snapshot.heroes,
      guild: snapshot.guild,
      activeView: 'dungeon',
      zoneLevel: 4,
      story: {
        quest: 'PARTY_MET',
        cryptObjectiveComplete: false,
        rewardGranted: false,
        playerX: 0.31,
        playerY: 0.47,
      },
    };
    const rawLegacy = JSON.stringify(legacy);
    storage.setItem(LEGACY_SAVE_KEY, rawLegacy);

    const migrated = new StateManager(new EventBus());
    const loaded = migrated.load();
    assert.equal(loaded?.version, 2);
    assert.equal(migrated.heroes[0].currentHp, 37);
    assert.equal(migrated.guild.gold, 777);
    assert.equal(migrated.guild.gems, 9);
    assert.equal(migrated.guild.shards, 14);
    assert.equal(migrated.zoneLevel, 4);
    assert.equal(migrated.story.quest, 'PARTY_MET');
    assert.deepEqual(migrated.worldPosition('town'), { x: 0.31, y: 0.47 });
    assert.equal(migrated.world.location, 'town');
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), rawLegacy, 'V1 key must remain untouched.');
    assert.equal(storage.getItem(SAVE_KEY), null, 'load() must not write before the app is ready.');

    storage.setItem(SAVE_KEY, '{not valid JSON');
    const fallback = new StateManager(new EventBus());
    const fallbackLoaded = withoutExpectedWarnings(() => fallback.load());
    assert.equal(fallbackLoaded?.version, 2);
    assert.equal(fallback.guild.gold, 777);
    assert.match(fallback.loadError ?? '', new RegExp(SAVE_KEY));

    storage.clear();
    storage.setItem(SAVE_KEY, '{still corrupt');
    const defaults = new StateManager(new EventBus());
    assert.equal(withoutExpectedWarnings(() => defaults.load()), null);
    assert.equal(defaults.guild.gold, 500);
    assert.equal(defaults.world.location, 'town');
  });

  test('all four locations persist and reload at deterministic positions', () => {
    const cases = [
      ['town', 'town:start', { x: 0.33, y: 0.44 }, { x: 0.33, y: 0.44 }],
      ['guildHall', 'guildHall:entrance', { x: 0.42, y: 0.73 }, { x: 0.42, y: 0.73 }],
      ['blacksmith', 'blacksmith:entrance', { x: 0.61, y: 0.67 }, { x: 0.61, y: 0.67 }],
      // Crypt reloads intentionally normalize to its safe entrance checkpoint.
      ['ashenCrypt', 'ashenCrypt:entrance', { x: 0.74, y: 0.61 }, { x: 0.5, y: 0.82 }],
    ];

    for (const [location, spawnId, position, expected] of cases) {
      installStorage();
      const state = new StateManager(new EventBus());
      state.setLocation(location, spawnId);
      state.setWorldPosition(location, position.x, position.y);
      state.save();

      const reloaded = new StateManager(new EventBus());
      assert.ok(reloaded.load());
      assert.equal(reloaded.world.location, location);
      assert.deepEqual(reloaded.worldPosition(location), expected);
    }

    assert.match(
      mainSource,
      /pixi\.enterLocation\(game\.state\.world\.location\);/,
      'Boot must resume the saved position instead of replaying the last transition spawn.',
    );
  });

  test('Embers quest reward is durable and idempotent', () => {
    installStorage();
    const state = new StateManager(new EventBus());
    const quests = new QuestSystem(state);
    advanceQuestToCrypt(quests);
    assert.equal(quests.recordCryptVictory(3), true);
    assert.equal(quests.recordReturnToGuild(), true);

    const before = { gold: state.guild.gold, shards: state.guild.shards };
    const first = quests.completeQuest();
    const afterFirst = { gold: state.guild.gold, shards: state.guild.shards };
    const second = quests.completeQuest();

    assert.deepEqual(first, { completed: true, rewardGranted: true });
    assert.deepEqual(second, { completed: true, rewardGranted: false });
    assert.deepEqual(afterFirst, { gold: before.gold + 150, shards: before.shards + 5 });
    assert.deepEqual({ gold: state.guild.gold, shards: state.guild.shards }, afterFirst);
    assert.equal(state.hasClaimedReward(EMBERS_REWARD_ID), true);

    const reloaded = new StateManager(new EventBus());
    assert.ok(reloaded.load());
    const reloadedQuests = new QuestSystem(reloaded);
    assert.equal(reloaded.story.quest, 'COMPLETE');
    assert.deepEqual(reloadedQuests.completeQuest(), { completed: true, rewardGranted: false });
    assert.deepEqual({ gold: reloaded.guild.gold, shards: reloaded.guild.shards }, afterFirst);
  });

  test('Forge transactions and equipped inventory survive reloads', () => {
    installStorage();
    const state = new StateManager(new EventBus());
    const crafting = new CraftingSystem();
    state.guild.gold = CRAFTING_RECIPES.weapon.gold - 1;
    state.guild.shards = CRAFTING_RECIPES.weapon.shards;
    const untouched = { gold: state.guild.gold, shards: state.guild.shards };
    assert.throws(
      () => crafting.forgeIntoInventory(state, 'weapon', 1, 'common'),
      /Insufficient materials/,
    );
    assert.deepEqual({ gold: state.guild.gold, shards: state.guild.shards }, untouched);
    assert.equal(state.inventory.length, 0);

    const funding = { gold: 500, shards: 20 };
    state.guild.gold = funding.gold;
    state.guild.shards = funding.shards;
    state.save();
    const item = crafting.forgeIntoInventory(state, 'weapon', 1, 'common');
    assert.equal(state.guild.gold, funding.gold - CRAFTING_RECIPES.weapon.gold);
    assert.equal(state.guild.shards, funding.shards - CRAFTING_RECIPES.weapon.shards);
    assert.equal(state.inventory.length, 1);
    state.heroes[0].equipment.weapon = item.id;
    state.save();

    const equippedReload = new StateManager(new EventBus());
    assert.ok(equippedReload.load());
    assert.equal(equippedReload.inventory[0]?.id, item.id);
    assert.equal(equippedReload.heroes[0].equipment.weapon, item.id);
    assert.throws(
      () => new CraftingSystem().salvageFromInventory(equippedReload, item.id),
      /Unequip the item/,
    );

    equippedReload.heroes[0].equipment.weapon = null;
    equippedReload.save();
    const expectedSalvage = Math.max(1, Math.floor(item.statBudget / 10));
    new CraftingSystem().salvageFromInventory(equippedReload, item.id);
    assert.equal(equippedReload.inventory.length, 0);
    const expectedShards = funding.shards - CRAFTING_RECIPES.weapon.shards + expectedSalvage;
    assert.equal(equippedReload.guild.shards, expectedShards);

    const salvagedReload = new StateManager(new EventBus());
    assert.ok(salvagedReload.load());
    assert.equal(salvagedReload.inventory.length, 0);
    assert.equal(salvagedReload.heroes[0].equipment.weapon, null);
    assert.equal(salvagedReload.guild.shards, expectedShards);
  });

  test('solo combat clears three encounters with meaningful block use', () => {
    installStorage();
    const bus = new EventBus();
    const state = new StateManager(bus);
    const combat = new CombatSystem(bus, () => 0.99);
    let blockedHits = 0;
    let lootDrops = 0;
    let zoneRewards = 0;
    let checkpoints = 0;
    combat.subscribe((event) => {
      if (event.type === 'damage' && event.blocked) blockedHits += 1;
      if (event.type === 'checkpoint') checkpoints += 1;
    });
    bus.on('loot:drop', () => { lootDrops += 1; });
    bus.on('progress:zone-complete', () => { zoneRewards += 1; });

    combat.enter(state.heroes[0], {
      completedEncounters: 0,
      rewardedEncounters: [],
      completed: false,
      victoryRewarded: false,
    });
    const elapsed = driveCombat(combat, (snapshot) => snapshot.victory || snapshot.canRetry);
    const result = combat.snapshot;

    assert.equal(result.phase, 'victory');
    assert.equal(result.completedEncounters, 3);
    assert.equal(result.player.hp > 0, true);
    assert.equal(result.checkpoint.victoryRewarded, true);
    assert.equal(checkpoints, 3);
    assert.equal(lootDrops, 3);
    assert.equal(zoneRewards, 1);
    assert.ok(blockedHits > 0, 'The deterministic strategy must exercise frontal blocking.');
    assert.ok(elapsed < 75, `Three encounters took too long: ${elapsed.toFixed(2)}s.`);
  });

  test('final-kill checkpoint survives immediate leave/re-entry without reward duplication', () => {
    installStorage();
    const bus = new EventBus();
    const state = new StateManager(bus);
    const combat = new CombatSystem(bus, () => 0.99);
    let lootDrops = 0;
    let zoneRewards = 0;
    bus.on('loot:drop', () => { lootDrops += 1; });
    bus.on('progress:zone-complete', () => { zoneRewards += 1; });

    combat.enter(state.heroes[0], {
      completedEncounters: 0,
      rewardedEncounters: [],
      completed: false,
      victoryRewarded: false,
    });
    driveCombat(combat, (snapshot) => snapshot.completedEncounters === 3 || snapshot.canRetry);
    assert.equal(combat.snapshot.phase, 'between', 'Harness must stop during final death presentation.');
    const checkpoint = combat.checkpoint;
    assert.equal(checkpoint.completed, true);
    assert.equal(checkpoint.victoryRewarded, true, 'Victory reward must precede the durable checkpoint.');
    assert.equal(lootDrops, 3);
    assert.equal(zoneRewards, 1);

    combat.leave();
    combat.enter(state.heroes[0], checkpoint);
    for (let frame = 0; frame < 300; frame += 1) combat.update(1 / 60);
    assert.equal(combat.snapshot.phase, 'victory');
    assert.equal(lootDrops, 3);
    assert.equal(zoneRewards, 1, 'Completed re-entry must not duplicate the zone reward.');
  });

  test('repeated defeat remains durable after retry without a second quest transition', () => {
    const storage = installStorage();
    const bus = new EventBus();
    const state = new StateManager(bus);
    const quests = new QuestSystem(state);
    advanceQuestToCrypt(quests);
    state.setLocation('ashenCrypt', 'ashenCrypt:entrance');
    state.heroes[0].currentHp = 1;
    state.save();

    let defeats = 0;
    const combat = new CombatSystem(bus, () => 0.99);
    combat.subscribe((event) => {
      if (event.type !== 'defeat') return;
      defeats += 1;
      quests.recordDefeat();
      // Mirrors the integration handler: HP must save even if CRYPT_ATTEMPTED
      // has no further quest-state transition to persist it implicitly.
      state.save();
    });
    combat.enter(state.heroes[0], {
      completedEncounters: 0,
      rewardedEncounters: [],
      completed: false,
      victoryRewarded: false,
    });
    while (!combat.snapshot.canRetry) combat.update(1 / 60);
    assert.equal(defeats, 1);
    assert.equal(quests.stage, 'CRYPT_ATTEMPTED');
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).heroes[0].currentHp, 0);

    assert.equal(combat.retry(), true);
    state.save();
    state.heroes[0].currentHp = 1;
    state.save();
    while (!combat.snapshot.canRetry) combat.update(1 / 60);
    assert.equal(defeats, 2);
    assert.equal(quests.stage, 'CRYPT_ATTEMPTED');
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).heroes[0].currentHp, 0);

    const reloaded = new StateManager(new EventBus());
    assert.ok(reloaded.load());
    assert.equal(reloaded.world.location, 'ashenCrypt');
    assert.equal(reloaded.story.quest, 'CRYPT_ATTEMPTED');
    assert.equal(reloaded.heroes[0].currentHp, 0);
    const reloadedCombat = new CombatSystem(new EventBus(), () => 0.99);
    assert.equal(reloadedCombat.enter(reloaded.heroes[0]).canRetry, true);

    const defeatHandlerStart = mainSource.indexOf("else if (event.type === 'defeat')");
    const defeatHandlerEnd = mainSource.indexOf('else if', defeatHandlerStart + 8);
    assert.ok(defeatHandlerStart >= 0, 'Could not locate the integration defeat handler.');
    assert.match(
      mainSource.slice(defeatHandlerStart, defeatHandlerEnd),
      /game\.state\.save\(\)/,
      'The integration defeat handler must save even when the quest stage is unchanged.',
    );
  });

  let passed = 0;
  const failures = [];
  for (const { name, run } of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS  ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.error(`FAIL  ${name}`);
      console.error(error);
    }
  }

  console.log(`\n${passed}/${tests.length} deterministic integration checks passed.`);
  if (failures.length) process.exitCode = 1;
} finally {
  await server.close();
}
