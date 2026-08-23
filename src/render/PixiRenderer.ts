import { Application, Assets, Container } from 'pixi.js';
import type { EventBus } from '../core/EventBus';
import type { StateManager, WorldLocation } from '../core/StateManager';
import type { CombatSnapshot, CombatSystem, DungeonCombatCheckpoint } from '../systems/CombatSystem';
import { DungeonScene } from './dungeon/DungeonScene';
import { GuildHallScene } from './interiors/GuildHallScene';
import { BlacksmithScene } from './interiors/BlacksmithScene';
import { TownScene } from './town/TownScene';
import type { InteractionTarget, WalkableWorldScene, WorldPosition } from './world/WalkableScene';

const REQUIRED_ASSETS = [
  'assets/dungeon/ashen-crypt/environment/crypt-stage.svg',
  'assets/dungeon/ashen-crypt/enemies/crypt-ghoul.svg',
  'assets/dungeon/ashen-crypt/heroes/guardian.svg',
  'assets/dungeon/ashen-crypt/heroes/cleric.svg',
  'assets/dungeon/ashen-crypt/heroes/ranger.svg',
  'assets/dungeon/ashen-crypt/heroes/arcanist.svg',
];

const DUNGEON_EXIT = { x: 88, y: 626, radius: 72 };

export class PixiRenderer {
  readonly app = new Application();
  private world = new Container();
  private bus?: EventBus;
  private state?: StateManager;
  private combat?: CombatSystem;
  private dungeon?: DungeonScene;
  private town?: TownScene;
  private guildHall?: GuildHallScene;
  private blacksmith?: BlacksmithScene;
  private location: WorldLocation = 'town';
  private targetListener: (target: InteractionTarget | null) => void = () => undefined;
  private dungeonTarget: InteractionTarget | null = null;

  setEventBus(bus: EventBus): void { this.bus = bus; }

  async init(host: HTMLElement, state: StateManager, combat: CombatSystem): Promise<void> {
    this.state = state;
    this.combat = combat;
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    this.app.canvas.className = 'pixi-layer';
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    if (!this.bus) throw Error('EventBus must be set before PixiRenderer.init');
    await Assets.load(REQUIRED_ASSETS);

    this.dungeon = new DungeonScene(state, combat, this.bus);
    this.town = new TownScene(state);
    this.guildHall = new GuildHallScene(state);
    this.blacksmith = new BlacksmithScene(state);
    this.world.addChild(this.dungeon, this.town, this.guildHall, this.blacksmith);
    this.bindTargets(this.town);
    this.bindTargets(this.guildHall);
    this.bindTargets(this.blacksmith);
    for (const scene of [this.dungeon, this.town, this.guildHall, this.blacksmith]) scene.visible = false;
    this.layout();
  }

  enterLocation(location: WorldLocation, spawn?: WorldPosition | string): void {
    this.leaveVisibleScene();
    this.location = location;
    this.dungeonTarget = null;
    if (location === 'ashenCrypt') {
      if (!this.dungeon || !this.state) return;
      const completed = this.state.dungeon.ashenCrypt.encounterIndex;
      const objectiveComplete = this.state.dungeon.ashenCrypt.objectiveComplete;
      const checkpoint: Partial<DungeonCombatCheckpoint> = {
        zoneLevel: this.state.zoneLevel,
        completedEncounters: objectiveComplete ? 3 : completed,
        rewardedEncounters: Array.from({ length: Math.max(0, completed) }, (_, index) => index),
        completed: objectiveComplete,
        victoryRewarded: objectiveComplete,
      };
      this.dungeon.visible = true;
      this.dungeon.enter(checkpoint);
    } else {
      const scene = this.walkable(location);
      scene.visible = true;
      scene.enter(spawn);
    }
    this.targetListener(this.interactionTarget);
  }

  leaveLocation(): DungeonCombatCheckpoint | null {
    if (this.location === 'ashenCrypt') return this.dungeon?.leave() ?? null;
    this.walkable(this.location).leave();
    return null;
  }

  setInput(x: number, y: number): void {
    if (this.location === 'ashenCrypt') this.dungeon?.setMove(x, y);
    else this.walkable(this.location).setInput(x, y);
  }

  requestAttack(): boolean { return this.location === 'ashenCrypt' && Boolean(this.dungeon?.requestAttack()); }
  setBlock(active: boolean): void { if (this.location === 'ashenCrypt') this.dungeon?.setBlock(active); }
  retryCombat(): boolean { return this.location === 'ashenCrypt' && Boolean(this.dungeon?.retry()); }
  get combatSnapshot(): CombatSnapshot | null { return this.dungeon?.snapshot ?? null; }

  setTargetListener(listener: (target: InteractionTarget | null) => void): void {
    this.targetListener = listener;
    listener(this.interactionTarget);
  }

  get interactionTarget(): InteractionTarget | null {
    if (this.location === 'ashenCrypt') return this.dungeonTarget;
    return this.walkable(this.location).interactionTarget;
  }

  get currentLocation(): WorldLocation { return this.location; }

  layout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.dungeon?.resize(width, height);
    this.town?.resize(width, height);
    this.guildHall?.resize(width, height);
    this.blacksmith?.resize(width, height);
  }

  update(dt: number): void {
    if (this.location === 'ashenCrypt') {
      this.dungeon?.update(dt);
      this.updateDungeonExitTarget();
    } else {
      this.walkable(this.location).update(dt);
    }
  }

  private bindTargets(scene: WalkableWorldScene): void {
    scene.setTargetListener((target) => {
      if (this.location === scene.location) this.targetListener(target);
    });
  }

  private walkable(location: Exclude<WorldLocation, 'ashenCrypt'>): WalkableWorldScene {
    if (location === 'guildHall' && this.guildHall) return this.guildHall;
    if (location === 'blacksmith' && this.blacksmith) return this.blacksmith;
    if (this.town) return this.town;
    throw new Error('World scenes are not initialized.');
  }

  private leaveVisibleScene(): void {
    if (this.location === 'ashenCrypt') this.dungeon?.leave();
    else if (this.town && this.guildHall && this.blacksmith) this.walkable(this.location).leave();
  }

  private updateDungeonExitTarget(): void {
    const snapshot = this.dungeon?.snapshot;
    let next: InteractionTarget | null = null;
    if (snapshot?.active && snapshot.canLeave) {
      const distance = Math.hypot(
        snapshot.player.position.x - DUNGEON_EXIT.x,
        snapshot.player.position.y - DUNGEON_EXIT.y,
      );
      if (distance <= DUNGEON_EXIT.radius) {
        next = { id: 'cryptExit', label: snapshot.victory ? 'RETURN' : 'LEAVE', x: 0, y: 0, radius: 0, priority: 1 };
      }
    }
    if (next?.id === this.dungeonTarget?.id && next?.label === this.dungeonTarget?.label) return;
    this.dungeonTarget = next;
    this.targetListener(next);
  }
}
