import './styles.css';
import { PixiRenderer } from './render/PixiRenderer';
import { ThreeRenderer } from './render/ThreeRenderer';
import { Game } from './core/Game';
import { ViewManager, type MenuView } from './render/ViewManager';
import { ClassSystem } from './systems/ClassSystem';
import { CraftingSystem } from './systems/CraftingSystem';
import { QuestSystem } from './systems/QuestSystem';
import { PlayerInputController } from './input/PlayerInputController';
import { classById } from './config/classes.config';
import { CRAFTING_RECIPES } from './config/items.config';
import { xpRequiredForLevel } from './math/XpCalculations';
import type { Item } from './models/Item';
import type { WorldLocation } from './core/StateManager';
import { STORY, QUEST_TITLE, objectiveFor, type DialogueLine } from './content/story/ashenCryptIntro';
import type { CombatEvent, DungeonCombatCheckpoint } from './systems/CombatSystem';
import type { InteractionTarget } from './render/world/WalkableScene';

declare global {
  interface Window {
    __IGM_BOOTED__?: boolean;
    __IGM_DEBUG__?: Record<string, unknown>;
  }
}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw Error('Missing #app root.');

root.innerHTML = `
  <main class="shell">
    <section class="resource-strip" aria-label="Guild resources">
      <span class="resource"><i>◉</i><b id="gold"></b><small>Gold</small></span>
      <span class="resource"><i>◆</i><b id="gems"></b><small>Gems</small></span>
      <span class="resource"><i>✦</i><b id="shards"></b><small>Shards</small></span>
    </section>
    <section id="game-canvas" class="game-canvas" aria-label="Game world"></section>
    <div id="location" class="location-card">GUILD TOWN</div>
    <div id="quest" class="quest-card"></div>
    <div id="joystick" class="joystick" aria-label="Movement joystick"><i></i></div>
    <button id="interact" class="interact" type="button" hidden>INTERACT</button>
    <div class="combat-actions" aria-label="Combat actions">
      <button id="block" class="block-button" type="button">BLOCK</button>
      <button id="attack" class="attack-button" type="button">ATTACK</button>
    </div>
    <section id="defeat" class="encounter-overlay" hidden>
      <article class="encounter-card"><h2>ALDRIC FALLS</h2><p>The upper Crypt remains contested. Regain your footing or retreat to Town.</p><div class="actions"><button id="retry" type="button">RETRY</button><button id="defeat-town" type="button">RETURN TO TOWN</button></div></article>
    </section>
    <section id="victory" class="encounter-overlay" hidden>
      <article class="encounter-card"><h2>UPPER CRYPT CLEARED</h2><p>The Ghouls are down. Something older still warms the sealed stone below.</p><div class="actions"><button id="victory-stay" type="button">REVIEW ARENA</button><button id="victory-town" type="button">RETURN TO TOWN</button></div></article>
    </section>
    <section class="panel-stack">
      <article id="dungeon-info" class="panel" data-menu-panel="dungeonInfo" hidden></article>
      <article id="heroes-panel" class="panel" data-menu-panel="heroes" hidden></article>
      <article id="forge-panel" class="panel" data-menu-panel="forge" hidden></article>
      <article id="raid-panel" class="panel" data-menu-panel="raid" hidden>
        <h2>Guild Raids</h2><p class="panel-intro">Large expeditions remain under preparation. The Ashen Crypt investigation takes priority.</p>
        <div class="locked-card">RAIDS UNAVAILABLE · Complete the current guild investigation first.</div>
      </article>
    </section>
    <div id="dialogue" class="dialogue" hidden><strong id="speaker"></strong><p id="line"></p><button id="continue" type="button">CONTINUE ›</button></div>
    <div id="toast" class="toast" hidden></div>
    <div id="scene-transition" class="scene-transition" hidden><b></b></div>
    <section class="save-tools"><button id="export-save">Export</button><button id="import-save">Import</button></section>
  </main>`;

const host = document.querySelector<HTMLElement>('#game-canvas')!;
const pixi = new PixiRenderer();
let three!: ThreeRenderer;
let game!: Game;
try {
  three = new ThreeRenderer(host);
  game = new Game(pixi, three);
  // Hydration must precede scene construction and navigation mounting.
  game.hydrate();
  pixi.setEventBus(game.bus);
  await pixi.init(host, game.state, game.combat);
} catch (error) {
  console.error('[boot] Renderer initialization failed:', error);
  root.innerHTML = '';
  const status = document.getElementById('boot-status');
  if (status) status.innerHTML = '<div class="card"><h1>IDLE GUILD MASTER</h1><p><strong>Guild systems could not initialize.</strong></p><p>Reload once. If this persists, report the browser and build marker to the Guild owner.</p></div>';
  throw error;
}
window.__IGM_BOOTED__ = true;
document.getElementById('boot-status')?.remove();

const views = new ViewManager(game.state, game.bus, root);
views.mount();
const quests = new QuestSystem(game.state);
const crafting = new CraftingSystem();
new ClassSystem();

const joystick = document.querySelector<HTMLElement>('#joystick')!;
const knob = joystick.querySelector<HTMLElement>('i')!;
const interact = document.querySelector<HTMLButtonElement>('#interact')!;
const attack = document.querySelector<HTMLButtonElement>('#attack')!;
const block = document.querySelector<HTMLButtonElement>('#block')!;
const dialog = document.querySelector<HTMLElement>('#dialogue')!;
const transition = document.querySelector<HTMLElement>('#scene-transition')!;
const defeat = document.querySelector<HTMLElement>('#defeat')!;
const victory = document.querySelector<HTMLElement>('#victory')!;
const forgePanel = document.querySelector<HTMLElement>('#forge-panel')!;

let dialogue: DialogueLine[] = [];
let dialogueIndex = 0;
let dialogueDone: (() => void) | null = null;
let dialogueAdvancing = false;
let transitioning = false;
let toastTimer = 0;
let currentTarget: InteractionTarget | null = null;

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const escapeHtml = (value: unknown): string => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function toast(message: string): void {
  const element = document.querySelector<HTMLElement>('#toast')!;
  element.textContent = message;
  element.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { element.hidden = true; }, 1900);
}

function anyEncounterOverlay(): boolean { return !defeat.hidden || !victory.hidden; }
function gameplaySuspended(): boolean {
  return transitioning || !dialog.hidden || views.currentMenu !== 'none' || anyEncounterOverlay();
}
function syncSuspension(): void {
  const suspended = gameplaySuspended();
  controls.setSuspended(suspended);
  game.setPaused(suspended);
  updateInteractionButton();
}

function openDialogue(lines: DialogueLine[], done?: () => void): void {
  if (!lines.length || !dialog.hidden || transitioning) return;
  dialogue = lines;
  dialogueIndex = 0;
  dialogueDone = done ?? null;
  dialog.hidden = false;
  showLine();
  syncSuspension();
}

function showLine(): void {
  const line = dialogue[dialogueIndex];
  if (!line) return;
  document.querySelector<HTMLElement>('#speaker')!.textContent = line.speaker;
  document.querySelector<HTMLElement>('#line')!.textContent = line.text;
}

function nextLine(): void {
  if (dialogueAdvancing || dialog.hidden) return;
  dialogueAdvancing = true;
  queueMicrotask(() => { dialogueAdvancing = false; });
  dialogueIndex += 1;
  if (dialogueIndex < dialogue.length) { showLine(); return; }
  dialog.hidden = true;
  const done = dialogueDone;
  dialogueDone = null;
  dialogue = [];
  try { done?.(); }
  catch (error) {
    console.error('[story] Dialogue completion failed:', error);
    toast('PROGRESS COULD NOT BE SAVED · TRY AGAIN');
  }
  syncSuspension();
  render();
}

function persistCombatCheckpoint(checkpoint: DungeonCombatCheckpoint = game.combat.checkpoint): void {
  game.state.setCryptEncounter(checkpoint.completedEncounters);
  if (checkpoint.completed && checkpoint.victoryRewarded && !game.state.dungeon.ashenCrypt.objectiveComplete) {
    quests.recordCryptVictory(checkpoint.completedEncounters);
  } else {
    game.state.save();
  }
}

function syncEncounterOutcome(): void {
  if (pixi.currentLocation !== 'ashenCrypt') {
    defeat.hidden = true;
    victory.hidden = true;
    return;
  }
  const snapshot = pixi.combatSnapshot;
  defeat.hidden = !snapshot?.canRetry;
  victory.hidden = !snapshot?.victory;
}

async function transitionToLocation(location: WorldLocation, label: string, spawnId: string): Promise<void> {
  if (transitioning) return;
  transitioning = true;
  controls.reset();
  game.setPaused(true);
  transition.querySelector('b')!.textContent = label;
  transition.hidden = false;
  requestAnimationFrame(() => transition.classList.add('active'));
  try {
    await wait(310);
    if (pixi.currentLocation === 'ashenCrypt') persistCombatCheckpoint();
    game.state.setLocation(location, spawnId);
    views.setLocation(location);
    views.show('none');
    pixi.enterLocation(location, spawnId);
    syncEncounterOutcome();
    game.state.save();
    currentTarget = pixi.interactionTarget;
    render();
    await wait(250);
  } catch (error) {
    console.error('[world] Location transition failed:', error);
    toast('TRAVEL INTERRUPTED · TRY AGAIN');
  } finally {
    transition.classList.remove('active');
    await wait(260);
    transition.hidden = true;
    transitioning = false;
    syncSuspension();
  }
}

async function returnToTown(recover = false): Promise<void> {
  if (recover) {
    const aldric = game.state.heroes[0];
    aldric?.heal(aldric.stats.maxHp);
  }
  await transitionToLocation('town', 'GUILD TOWN', 'town:cryptExit');
}

function partyDialogue(): DialogueLine[] {
  return ['CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE'].includes(quests.stage)
    ? STORY.afterClearParty : STORY.party;
}

function stewardInteraction(): void {
  const stage = quests.stage;
  if (stage === 'NOT_STARTED' || stage === 'INTRODUCED') {
    openDialogue(STORY.stewardIntro, () => {
      if (quests.acceptQuest()) toast(`QUEST ACCEPTED · ${QUEST_TITLE}`);
    });
    return;
  }
  if (stage === 'CRYPT_CLEARED' || stage === 'RETURNED_TO_GUILD') {
    if (stage === 'CRYPT_CLEARED') quests.recordReturnToGuild();
    openDialogue(STORY.return, () => {
      const result = quests.completeQuest();
      toast(result.rewardGranted ? 'QUEST COMPLETE · +150 GOLD · +5 SHARDS' : 'QUEST REPORT ALREADY FILED');
    });
    return;
  }
  if (stage === 'COMPLETE') { openDialogue(STORY.complete); return; }
  openDialogue([{ speaker: 'Steward Elira', text: objectiveFor(stage) }]);
}

function smithInteraction(): void {
  if (['CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE'].includes(quests.stage)) {
    openDialogue(STORY.smithAfterClear);
    return;
  }
  openDialogue(STORY.blacksmith, () => {
    if (quests.prepareAtForge()) toast('QUEST UPDATED · Enter the Ashen Crypt');
  });
}

function interactNow(): void {
  if (transitioning) return;
  if (!dialog.hidden) { nextLine(); return; }
  if (views.currentMenu !== 'none' || anyEncounterOverlay()) return;
  const target = pixi.interactionTarget;
  if (!target) return;

  switch (target.id) {
    case 'guildHallDoor': void transitionToLocation('guildHall', 'GUILD HALL', 'guildHall:entrance'); break;
    case 'guildHallExit': void transitionToLocation('town', 'GUILD TOWN', 'town:guildHallExit'); break;
    case 'blacksmithDoor': void transitionToLocation('blacksmith', 'TORREN’S FORGE', 'blacksmith:entrance'); break;
    case 'blacksmithExit': void transitionToLocation('town', 'GUILD TOWN', 'town:blacksmithExit'); break;
    case 'steward': stewardInteraction(); break;
    case 'party':
      openDialogue(partyDialogue(), () => {
        if (quests.meetParty()) toast('QUEST UPDATED · Visit Torren’s Forge');
      });
      break;
    case 'smith': smithInteraction(); break;
    case 'forge': views.show('forge'); break;
    case 'board':
      openDialogue(['CRYPT_CLEARED', 'RETURNED_TO_GUILD', 'COMPLETE'].includes(quests.stage) ? STORY.boardAfterClear : STORY.board);
      break;
    case 'crypt':
      if (!quests.canEnterCrypt()) openDialogue(STORY.locked);
      else if (quests.enterCrypt()) void transitionToLocation('ashenCrypt', 'ASHEN CRYPT', 'ashenCrypt:entrance');
      break;
    case 'cryptExit': void returnToTown(false); break;
  }
}

function updateInteractionButton(): void {
  const available = currentTarget && views.currentMenu === 'none' && !transitioning && dialog.hidden && !anyEncounterOverlay();
  interact.hidden = !available;
  interact.textContent = currentTarget?.label ?? 'INTERACT';
}

const controls = new PlayerInputController(joystick, knob, {
  onMove: (x, y) => pixi.setInput(x, y),
  onAttack: () => { pixi.requestAttack(); },
  onBlock: (active) => { pixi.setBlock(active); block.classList.toggle('active', active); },
  onInteract: interactNow,
  onMenu: () => { if (views.currentMenu !== 'none') views.show('none'); },
  combatActive: () => pixi.currentLocation === 'ashenCrypt' && views.currentMenu === 'none' && !transitioning && dialog.hidden && !anyEncounterOverlay(),
});

function onCombatEvent(event: CombatEvent): void {
  if (event.type === 'checkpoint') persistCombatCheckpoint(event.checkpoint);
  else if (event.type === 'defeat') {
    quests.recordDefeat();
    // Defeat HP/state must remain durable even when the quest was already in
    // CRYPT_ATTEMPTED and therefore has no stage transition to trigger a save.
    game.state.save();
    defeat.hidden = false;
    syncSuspension();
  } else if (event.type === 'retry') {
    defeat.hidden = true;
    syncSuspension();
  } else if (event.type === 'victory') {
    quests.recordCryptVictory(event.checkpoint.completedEncounters);
    victory.hidden = false;
    syncSuspension();
    toast('QUEST UPDATED · Return to Steward Elira');
  }
  render();
}

game.combat.subscribe(onCombatEvent);
pixi.setTargetListener((target) => { currentTarget = target; updateInteractionButton(); });

interact.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); interactNow(); });
attack.addEventListener('pointerdown', (event) => { event.preventDefault(); pixi.requestAttack(); });
const endBlock = () => { pixi.setBlock(false); block.classList.remove('active'); };
block.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  block.setPointerCapture(event.pointerId);
  pixi.setBlock(true);
  block.classList.add('active');
});
block.addEventListener('pointerup', endBlock);
block.addEventListener('pointercancel', endBlock);
block.addEventListener('lostpointercapture', endBlock);
document.querySelector('#continue')!.addEventListener('pointerdown', (event) => { event.preventDefault(); nextLine(); });
window.addEventListener('keydown', (event) => {
  if (!dialog.hidden && ['Enter', ' ', 'e', 'E'].includes(event.key)) { event.preventDefault(); nextLine(); }
});

document.querySelector('#retry')!.addEventListener('click', () => {
  defeat.hidden = true;
  if (pixi.retryCombat()) {
    game.state.save();
    syncSuspension();
  }
});
document.querySelector('#defeat-town')!.addEventListener('click', () => { defeat.hidden = true; void returnToTown(true); });
document.querySelector('#victory-town')!.addEventListener('click', () => { victory.hidden = true; void returnToTown(false); });
document.querySelector('#victory-stay')!.addEventListener('click', () => { victory.hidden = true; syncSuspension(); });
document.querySelector('#export-save')?.addEventListener('click', () => {
  window.prompt('Copy your save JSON:', game.state.exportJson());
});
document.querySelector('#import-save')?.addEventListener('click', () => {
  const raw = window.prompt('Paste save JSON:');
  if (!raw) return;
  try {
    game.state.importJson(raw);
    location.reload();
  } catch (error) {
    toast(error instanceof Error ? error.message.toUpperCase() : 'SAVE IMPORT FAILED');
  }
});

forgePanel.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  try {
    const forgeSlot = button.dataset.forge as Item['slot'] | undefined;
    if (forgeSlot) {
      const item = crafting.forgeIntoInventory(game.state, forgeSlot, game.state.zoneLevel, 'common');
      toast(`FORGED · ${item.name.toUpperCase()}`);
    }
    const equipId = button.dataset.equip;
    if (equipId) {
      const item = game.state.inventory.find((entry) => entry.id === equipId);
      const aldric = game.state.heroes[0];
      if (item && aldric) {
        const previousId = aldric.equipment[item.slot];
        if (previousId !== item.id) {
          const previous = game.state.inventory.find((entry) => entry.id === previousId);
          if (previous) applyEquipmentModifier(previous, -1);
          applyEquipmentModifier(item, 1);
          aldric.equipment[item.slot] = item.id;
          game.state.save();
          toast(`EQUIPPED · ${item.name.toUpperCase()}`);
        } else {
          toast('ITEM ALREADY EQUIPPED');
        }
      }
    }
    const salvageId = button.dataset.salvage;
    if (salvageId) {
      const item = crafting.salvageFromInventory(game.state, salvageId);
      toast(`SALVAGED · ${item.name.toUpperCase()}`);
    }
    render();
  } catch (error) {
    toast(error instanceof Error ? error.message.toUpperCase() : 'FORGE ACTION FAILED');
  }
});

game.bus.on('save:complete', render);
game.bus.on('menu:change', ({ menu }) => {
  const active = menu as MenuView;
  game.setPaused(active !== 'none' || !dialog.hidden || anyEncounterOverlay());
  render();
  syncSuspension();
});
game.bus.on('location:change', render);

function inventoryName(id: string | null | undefined): string {
  if (!id) return 'Empty';
  return game.state.inventory.find((item) => item.id === id)?.name ?? 'Legacy item';
}

function applyEquipmentModifier(item: Item, direction: 1 | -1): void {
  const hero = game.state.heroes[0];
  if (!hero) return;
  const bonus = Math.max(1, Math.ceil(item.statBudget / 6));
  if (item.slot === 'weapon') hero.stats.attack = Math.max(1, hero.stats.attack + bonus * direction);
  else if (item.slot === 'armor') hero.stats.defense = Math.max(0, hero.stats.defense + bonus * direction);
  else {
    const hpBonus = bonus * 5;
    hero.stats.maxHp = Math.max(1, hero.stats.maxHp + hpBonus * direction);
    hero.currentHp = direction > 0
      ? Math.min(hero.stats.maxHp, hero.currentHp + hpBonus)
      : Math.min(hero.stats.maxHp, hero.currentHp);
  }
}

function renderCharacter(): void {
  const panel = document.querySelector<HTMLElement>('#heroes-panel')!;
  const hero = game.state.heroes[0];
  if (!hero) { panel.innerHTML = '<h2>Aldric</h2><p>Character data unavailable.</p>'; return; }
  const role = classById(hero.jobId);
  const currentFloor = xpRequiredForLevel(hero.level);
  const next = Math.max(currentFloor + 1, xpRequiredForLevel(hero.level + 1));
  const xpRatio = Math.max(0, Math.min(1, (hero.xp - currentFloor) / (next - currentFloor)));
  panel.innerHTML = `
    <h2>Character</h2><p class="panel-intro">Aldric is the controlled Guardian for the current expedition.</p>
    <section class="character-card">
      <div class="character-portrait">◆</div>
      <div><div class="character-name">${escapeHtml(hero.name)}</div><div class="character-role">Level ${hero.level} · ${escapeHtml(role.name)}</div>
        <div class="xp-row"><small><span>Experience</span><span>${hero.xp} / ${next}</span></small><div class="meter guard"><i style="transform:scaleX(${xpRatio})"></i></div></div>
        <div class="stats-grid">
          <div class="stat"><small>Health</small><b>${hero.currentHp} / ${hero.stats.maxHp}</b></div>
          <div class="stat"><small>Attack</small><b>${hero.stats.attack}</b></div>
          <div class="stat"><small>Defense</small><b>${hero.stats.defense}</b></div>
          <div class="stat"><small>Crit</small><b>${Math.round(hero.stats.critChance * 100)}%</b></div>
          <div class="stat"><small>Guard</small><b>100</b></div>
          <div class="stat"><small>Role</small><b>Frontline</b></div>
        </div>
      </div>
    </section>
    <section class="service-card"><h3>Guardian Skills</h3><p><b>Sword Strike</b> — deliberate close-range attack.<br><b>Shield Guard</b> — hold to reduce frontal damage and protect guard strength.</p></section>
    <section class="equipment-grid">
      ${(['weapon', 'armor', 'accessory'] as const).map((slot) => `<div class="equipment-slot"><small>${slot}</small><b>${escapeHtml(inventoryName(hero.equipment[slot]))}</b></div>`).join('')}
    </section>`;
}

function renderForge(): void {
  if (game.state.world.location !== 'blacksmith') {
    forgePanel.innerHTML = '<h2>Torren’s Forge</h2><p class="panel-intro">Forge services are integrated into the world.</p><div class="locked-card">Enter the Blacksmith in Guild Town and use the forge to work equipment.</div>';
    return;
  }
  const inventory = game.state.inventory;
  forgePanel.innerHTML = `
    <h2>Torren’s Forge</h2><p class="panel-intro">Craft a compact set of useful equipment. Materials are consumed only when a durable item is created.</p>
    <section class="service-card"><h3>Craft Equipment</h3><div class="forge-actions">
      ${(['weapon', 'armor', 'accessory'] as const).map((slot) => {
        const cost = CRAFTING_RECIPES[slot];
        return `<button type="button" data-forge="${slot}">${slot.toUpperCase()}<br><small>${cost.gold}G · ${cost.shards}S</small></button>`;
      }).join('')}
    </div></section>
    <section class="service-card"><h3>Inventory · ${inventory.length}</h3>
      <div class="inventory-list">${inventory.length ? inventory.map((item) => `<div class="inventory-item"><div><b>${escapeHtml(item.name)}</b><br><small>${item.rarity} ${item.slot} · Power ${item.statBudget}</small></div><div><button type="button" data-equip="${escapeHtml(item.id)}">Equip</button> <button type="button" data-salvage="${escapeHtml(item.id)}">Salvage</button></div></div>`).join('') : '<div class="locked-card">No stored equipment yet.</div>'}</div>
    </section>`;
}

function renderDungeonInfo(): void {
  const panel = document.querySelector<HTMLElement>('#dungeon-info')!;
  const unlocked = quests.canEnterCrypt();
  const complete = game.state.dungeon.ashenCrypt.objectiveComplete;
  panel.innerHTML = `<h2>Ashen Crypt</h2><p class="panel-intro">${complete ? 'Upper chamber secured. A deeper sealed level remains.' : unlocked ? 'Expedition authorized. Walk to the cemetery gate in Town to enter.' : 'Travel is locked until Steward Elira authorizes the investigation and Torren checks your gear.'}</p>
    <section class="service-card"><h3>Expedition Status</h3><p>Location: ${escapeHtml(game.state.world.location)}<br>Encounters cleared: ${game.state.dungeon.ashenCrypt.encounterIndex} / 3<br>Objective: ${complete ? 'COMPLETE' : unlocked ? 'READY' : 'LOCKED'}</p></section>
    <div class="locked-card">Physical entry through Guild Town remains the primary route. This menu never bypasses story gates.</div>`;
}

function render(): void {
  const { guild } = game.state;
  document.querySelector<HTMLElement>('#gold')!.textContent = guild.gold.toLocaleString();
  document.querySelector<HTMLElement>('#gems')!.textContent = guild.gems.toLocaleString();
  document.querySelector<HTMLElement>('#shards')!.textContent = guild.shards.toLocaleString();
  document.querySelector<HTMLElement>('#quest')!.innerHTML = `<b>${QUEST_TITLE}</b><span>${escapeHtml(objectiveFor(quests.stage))}</span>`;
  renderCharacter();
  renderForge();
  renderDungeonInfo();
  updateInteractionButton();
}

// Reloads resume the saved world position. Transition spawn IDs are consumed only
// by live scene changes so a reload never snaps Aldric back to the last doorway.
pixi.enterLocation(game.state.world.location);
currentTarget = pixi.interactionTarget;
views.setLocation(game.state.world.location, false);
views.show('none', false);
render();
game.start();

syncEncounterOutcome();
syncSuspension();

if (new URLSearchParams(location.search).has('storydebug') || new URLSearchParams(location.search).has('combatdebug')) {
  window.__IGM_DEBUG__ = {
    snapshot: () => game.state.snapshot(),
    combat: () => game.combat.snapshot,
    target: () => pixi.interactionTarget,
    setPosition: (location: WorldLocation, x: number, y: number) => game.state.setWorldPosition(location, x, y),
    go: (location: WorldLocation, spawnId: string) => transitionToLocation(location, location.toUpperCase(), spawnId),
    interact: interactNow,
  };

  // Visible, development-only spawn controls make scene and interaction lifecycle
  // checks reproducible without exposing shortcuts in the normal game.
  const debugSpawns: Array<[string, WorldLocation, number, number]> = [
    ['Hall door', 'town', 0.248, 0.276],
    ['Party', 'town', 0.270, 0.537],
    ['Smith door', 'town', 0.775, 0.455],
    ['Board', 'town', 0.365, 0.413],
    ['Crypt gate', 'town', 0.500, 0.099],
    ['Steward', 'guildHall', 0.500, 0.319],
    ['Hall exit', 'guildHall', 0.500, 0.913],
    ['Smith', 'blacksmith', 0.688, 0.460],
    ['Forge', 'blacksmith', 0.248, 0.413],
    ['Smith exit', 'blacksmith', 0.500, 0.913],
  ];
  const debugControls = document.createElement('details');
  debugControls.className = 'debug-controls';
  debugControls.innerHTML = '<summary>DEBUG TRAVEL</summary><div></div>';
  const debugButtonHost = debugControls.querySelector('div')!;
  for (const [label, targetLocation, x, y] of debugSpawns) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      if (pixi.currentLocation !== targetLocation) {
        toast(`DEBUG · ENTER ${targetLocation.toUpperCase()} FIRST`);
        return;
      }
      game.state.setWorldPosition(targetLocation, x, y);
      game.state.save();
      render();
    });
    debugButtonHost.appendChild(button);
  }
  root.appendChild(debugControls);
}
