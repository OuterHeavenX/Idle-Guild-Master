import './styles.css';
import { PixiRenderer } from './render/PixiRenderer';
import { ThreeRenderer } from './render/ThreeRenderer';
import { Game } from './core/Game';
import { ViewManager } from './render/ViewManager';
import { ClassSystem } from './systems/ClassSystem';
import { CraftingSystem } from './systems/CraftingSystem';

declare global {
  interface Window { __IGM_BOOTED__?: boolean; }
}

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app root.');
window.__IGM_BOOTED__ = true;
document.getElementById('boot-status')?.remove();

appRoot.innerHTML = `
  <main class="shell">
    <section id="game-canvas" class="game-canvas" aria-label="Idle Guild Master combat scene"></section>
    <section class="hud-card resource-strip">
      <span>Gold <strong id="gold"></strong></span>
      <span>Gems <strong id="gems"></strong></span>
      <span>Shards <strong id="shards"></strong></span>
    </section>
    <section class="panel-stack">
      <article class="hud-card panel" data-view="dungeon">
        <h2>Dungeon Expedition</h2>
        <p>Four heroes automatically fight one-second combat ticks. Tanks generate increased threat; casters apply burn and freeze.</p>
        <button id="advance-zone">Advance Zone</button>
      </article>
      <article class="hud-card panel" data-view="town" hidden>
        <h2>Guild Town</h2>
        <div id="facilities" class="grid"></div>
      </article>
      <article class="hud-card panel" data-view="heroes" hidden>
        <h2>Hero & Job Hall</h2>
        <div id="heroes-list" class="grid"></div>
      </article>
      <article class="hud-card panel" data-view="blacksmith" hidden>
        <h2>Blacksmith</h2>
        <p>Forge, salvage and socket refinement are implemented in CraftingSystem.</p>
        <button id="forge-demo">Forge Training Sword</button>
        <pre id="forge-output"></pre>
      </article>
      <article class="hud-card panel" data-view="raid" hidden>
        <h2>Ignis the Flame Sovereign</h2>
        <p>8-hero dual-party raid with phases, add spawns, tank-swap stacks and a 360-second hard enrage.</p>
        <button id="start-raid">Begin Raid</button>
        <pre id="raid-status"></pre>
      </article>
    </section>
    <section class="save-tools">
      <button id="export-save">Export</button>
      <button id="import-save">Import</button>
    </section>
  </main>
`;

const canvasHost = document.querySelector<HTMLElement>('#game-canvas');
if (!canvasHost) throw new Error('Missing game canvas host.');

const pixi = new PixiRenderer();
const three = new ThreeRenderer(canvasHost);
const game = new Game(pixi, three);
pixi.setEventBus(game.bus);
await pixi.init(canvasHost, game.state, game.combat);

const viewManager = new ViewManager(game.state, game.bus, appRoot);
viewManager.mount();

const classSystem = new ClassSystem();
const crafting = new CraftingSystem();

const renderDom = (): void => {
  const { guild } = game.state;
  document.querySelector('#gold')!.textContent = guild.gold.toLocaleString();
  document.querySelector('#gems')!.textContent = guild.gems.toLocaleString();
  document.querySelector('#shards')!.textContent = guild.shards.toLocaleString();

  const facilities = document.querySelector('#facilities')!;
  facilities.innerHTML = Object.entries(guild.facilities)
    .map(([id, level]) => `<button class="tile" data-facility="${id}">${id}<br><strong>Lv.${level}</strong></button>`)
    .join('');

  const heroList = document.querySelector('#heroes-list')!;
  heroList.innerHTML = game.state.heroes.slice(0, 4).map((hero) => `
    <div class="tile">
      <strong>${hero.name}</strong><br>
      Lv.${hero.level} · ${hero.jobId}<br>
      Job Lv.${hero.jobLevel} · JP ${hero.jp}<br>
      HP ${hero.currentHp}/${hero.stats.maxHp}
    </div>
  `).join('');

  document.querySelector('#raid-status')!.textContent =
    `Phase ${game.raid.state.phase} | HP ${Math.floor(game.raid.state.bossHp).toLocaleString()} | Adds ${game.raid.state.addsAlive} | Enraged ${game.raid.state.enraged}`;
};

document.querySelector('#advance-zone')?.addEventListener('click', () => {
  game.state.zoneLevel += 1;
  game.combat.resetEnemy(game.state.zoneLevel);
});

document.querySelector('#start-raid')?.addEventListener('click', () => game.startRaid());

document.querySelector('#forge-demo')?.addEventListener('click', () => {
  try {
    game.state.guild.shards += 20;
    const item = crafting.forge(game.state.guild, 'weapon', Math.max(1, game.state.zoneLevel), 'rare');
    document.querySelector('#forge-output')!.textContent = JSON.stringify(item, null, 2);
  } catch (error) {
    document.querySelector('#forge-output')!.textContent = String(error);
  }
});

document.querySelector('#export-save')?.addEventListener('click', async () => {
  const raw = game.state.exportJson();
  await navigator.clipboard?.writeText(raw);
  window.prompt('Copy your save JSON:', raw);
});

document.querySelector('#import-save')?.addEventListener('click', () => {
  const raw = window.prompt('Paste save JSON:');
  if (!raw) return;
  try {
    game.state.importJson(raw);
    location.reload();
  } catch (error) {
    window.alert(`Import failed: ${String(error)}`);
  }
});

game.bus.on('save:complete', renderDom);
window.setInterval(renderDom, 500);
renderDom();
game.start();
void classSystem;
