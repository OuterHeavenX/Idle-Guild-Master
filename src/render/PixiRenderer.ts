import { Application, Assets, Container } from 'pixi.js';
import type { EventBus } from '../core/EventBus';
import type { StateManager } from '../core/StateManager';
import type { CombatSystem } from '../systems/CombatSystem';
import { DungeonScene } from './dungeon/DungeonScene';

const DUNGEON_ASSETS = [
  'assets/dungeon/ashen-crypt/environment/crypt-stage.svg',
  'assets/dungeon/ashen-crypt/enemies/crypt-ghoul.svg',
  'assets/dungeon/ashen-crypt/heroes/guardian.svg',
  'assets/dungeon/ashen-crypt/heroes/cleric.svg',
  'assets/dungeon/ashen-crypt/heroes/ranger.svg',
  'assets/dungeon/ashen-crypt/heroes/arcanist.svg',
];

export class PixiRenderer {
  readonly app = new Application();
  private world = new Container(); private bus?: EventBus; private dungeon?: DungeonScene;
  setEventBus(bus: EventBus): void { this.bus = bus; }
  async init(host: HTMLElement, state: StateManager, combat: CombatSystem): Promise<void> {
    await this.app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true });
    this.app.canvas.className='pixi-layer'; host.appendChild(this.app.canvas); this.app.stage.addChild(this.world);
    if(!this.bus) throw new Error('EventBus must be set before PixiRenderer.init');

    // Pixi v8 does not implicitly fetch URL-backed textures passed to Sprite.from().
    // Preload authored dungeon art before actors/environment are constructed so the
    // same URLs resolve from the Assets cache on GitHub Pages and on local Vite.
    await Assets.load(DUNGEON_ASSETS);

    this.dungeon=new DungeonScene(state,combat,this.bus); this.world.addChild(this.dungeon); this.layout();
  }
  layout(): void { this.dungeon?.resize(this.app.screen.width,this.app.screen.height); }
  update(deltaSeconds:number):void{ this.dungeon?.update(deltaSeconds); }
}
