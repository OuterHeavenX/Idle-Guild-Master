import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const town = await readFile(new URL('../src/render/town/TownScene.ts', import.meta.url), 'utf8');
const walkable = await readFile(new URL('../src/render/world/WalkableScene.ts', import.meta.url), 'utf8');
const worldArt = await readFile(new URL('../src/render/world/WorldArt.ts', import.meta.url), 'utf8');

const checks = [];
const check = (name, run) => checks.push({ name, run });

check('expanded town is at least four times the original logical area', () => {
  const width = Number(town.match(/const TOWN_WIDTH = (\d+);/)?.[1]);
  const height = Number(town.match(/const TOWN_HEIGHT = (\d+);/)?.[1]);
  assert.ok(Number.isFinite(width) && Number.isFinite(height));
  assert.ok(width * height >= 4 * 1000 * 1500, `${width}x${height} is below the 4x target.`);
});

check('all validated town interaction IDs remain stable', () => {
  for (const id of ['guildHallDoor', 'blacksmithDoor', 'party', 'board', 'crypt']) {
    assert.match(town, new RegExp(`id: '${id}'`), `Missing validated interaction id: ${id}`);
  }
});

check('five district implementation hooks remain present', () => {
  for (const method of ['drawGuildQuarter', 'drawResidentialWard', 'drawMarket', 'drawLowtown', 'drawOldWard']) {
    assert.match(town, new RegExp(`private ${method}\\(`), `Missing district hook: ${method}`);
  }
});

check('Long Rain presentation cannot silently disappear', () => {
  assert.match(town, /private drawRain\(\)/);
  assert.match(town, /private drawPuddles\(\)/);
  assert.match(town, /private updatePlayerSplash\(\)/);
  assert.match(town, /Open drainage channels/);
  const puddleMatches = town.match(/\[\d+, \d+, \d+, \d+\]/g) ?? [];
  assert.ok(puddleMatches.length >= 20, 'Expected at least twenty authored puddle placements.');
});

check('ambient dialogue pool meets content scale target', () => {
  const block = town.match(/const AMBIENT_DIALOGUE = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  const lines = [...block.matchAll(/^\s*['"].+['"],?$/gm)];
  assert.ok(lines.length >= 20, `Expected 20+ ambient dialogue lines, found ${lines.length}.`);
});

check('ambient population supports all requested lightweight roles', () => {
  for (const role of ['resident', 'worker', 'guard', 'child', 'elder', 'traveler']) {
    assert.match(worldArt, new RegExp(`\\| '${role}'`), `Missing NPC role: ${role}`);
  }
});

check('expanded town uses follow camera while legacy walkable scenes retain defaults', () => {
  assert.match(town, /protected override readonly cameraFollowsPlayer = true;/);
  assert.match(walkable, /protected readonly cameraFollowsPlayer = false;/);
  assert.match(walkable, /private applyCamera\(\)/);
});

let failures = 0;
for (const { name, run } of checks) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failures > 0) process.exitCode = 1;
else console.log(`Long Rain validation: ${checks.length}/${checks.length} passed.`);
