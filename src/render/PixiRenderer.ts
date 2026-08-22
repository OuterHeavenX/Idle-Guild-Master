import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { EventBus } from '../core/EventBus';
import type { StateManager } from '../core/StateManager';
import type { CombatSystem } from '../systems/CombatSystem';
import { ParticleManager } from './ParticleManager';

export class PixiRenderer {
  readonly app = new Application();
  readonly particles = new ParticleManager();
  private world = new Container();
  private state!: StateManager;
  private combat!: CombatSystem;
  private title!: Text;
  private enemyBar = new Graphics();
  private heroNodes: Graphics[] = [];
  private bus?: EventBus;

  setEventBus(bus: EventBus): void { this.bus = bus; }

  async init(host: HTMLElement, state: StateManager, combat: CombatSystem): Promise<void> {
    this.state = state;
    this.combat = combat;
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true
    });
    this.app.canvas.className = 'pixi-layer';
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world, this.particles.container);

    this.title = new Text({
      text: 'IDLE GUILD MASTER',
      style: new TextStyle({
        fill: 0xf5e7c6,
        fontSize: 30,
        fontFamily: 'Georgia, serif',
        fontWeight: '700',
        letterSpacing: 3,
        stroke: { color: 0x1b1020, width: 5 }
      })
    });
    this.title.anchor.set(0.5, 0);
    this.world.addChild(this.title, this.enemyBar);

    this.createHeroNodes();
    this.bindEvents();
    this.layout();
  }

  layout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.title.position.set(width / 2, Math.max(24, height * 0.05));
    const spacing = Math.min(110, width / 5);
    this.heroNodes.forEach((node, index) => node.position.set(width / 2 + (index - 1.5) * spacing, height * 0.68));
    this.drawEnemy(width / 2, height * 0.35);
  }

  update(deltaSeconds: number): void {
    this.particles.update(deltaSeconds);
    this.drawEnemy(this.app.screen.width / 2, this.app.screen.height * 0.35);
  }

  private createHeroNodes(): void {
    this.state.heroes.slice(0, 4).forEach((_hero, index) => {
      const node = new Graphics()
        .circle(0, 0, 28)
        .fill(index === 0 ? 0x7b9aa8 : index === 1 ? 0xd5c1a4 : index === 2 ? 0x637d4f : 0x7560a8)
        .circle(0, 0, 28)
        .stroke({ width: 3, color: 0xf2dfb8 });
      this.world.addChild(node);
      this.heroNodes.push(node);
    });
  }

  private drawEnemy(x: number, y: number): void {
    const enemy = this.combat.currentEnemy;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    this.enemyBar.clear()
      .roundRect(x - 130, y, 260, 22, 8)
      .fill(0x1b1117)
      .roundRect(x - 126, y + 4, 252 * ratio, 14, 6)
      .fill(0xc2463b);
  }

  private bindEvents(): void {
    this.bus?.on('combat:damage', ({ sourceId, amount, crit }) => {
      if (sourceId.startsWith('hero-')) {
        this.particles.spawnDamage(
          this.app.screen.width / 2 + (Math.random() - 0.5) * 100,
          this.app.screen.height * 0.32,
          amount,
          crit
        );
      }
    });
  }
}
