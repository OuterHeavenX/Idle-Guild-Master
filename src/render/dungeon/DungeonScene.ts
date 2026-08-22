import { Container } from 'pixi.js';
import type { EventBus } from '../../core/EventBus';
import type { StateManager } from '../../core/StateManager';
import type { CombatSystem } from '../../systems/CombatSystem';
import { HeroActor } from './HeroActor';
import { EnemyActor } from './EnemyActor';
import { DungeonHud } from './DungeonHud';
import { LootFeed } from './LootFeed';
import { CombatEffects } from '../effects/CombatEffects';
import { EnvironmentRenderer } from './EnvironmentRenderer';

export class DungeonScene extends Container {
  private environment = new EnvironmentRenderer();
  private actors = new Container();
  private heroes: HeroActor[] = [];
  private enemy = new EnemyActor();
  private hud: DungeonHud;
  private feed = new LootFeed();
  private fx = new CombatEffects();
  private sceneWidth = 1;
  private sceneHeight = 1;

  constructor(private state: StateManager, private combat: CombatSystem, private bus: EventBus) {
    super();
    this.hud = new DungeonHud(state, combat);
    this.addChild(this.environment.container, this.environment.ambient, this.actors, this.fx.container, this.hud, this.feed);
    state.heroes.slice(0, 4).forEach((h, i) => {
      const actor = new HeroActor(state, h.id, i);
      this.heroes.push(actor);
      this.actors.addChild(actor);
    });
    this.actors.addChild(this.enemy);
    this.bind();
  }

  resize(width: number, height: number): void {
    this.sceneWidth = width;
    this.sceneHeight = height;
    this.environment.resize(width, height);

    const compact = width < 460;
    const formation: Array<[number, number]> = [
      [width * 0.47, height * 0.61],
      [width * 0.30, height * 0.66],
      [width * 0.17, height * 0.73],
      [width * 0.55, height * 0.73],
    ];
    this.heroes.forEach((hero, i) => {
      const point = formation[i]!;
      hero.position.set(point[0], point[1]);
      hero.scale.set(compact ? 0.96 : 1.08);
    });

    this.enemy.position.set(width * 0.69, height * 0.46);
    this.enemy.scale.set(compact ? 1 : 1.08);

    this.feed.position.set(10, height * 0.31);
    this.feed.resize(Math.min(154, width * 0.39));
    this.hud.update(width, height);
  }

  update(dt: number): void {
    this.environment.update(dt);
    this.heroes.forEach((hero) => hero.update(dt));
    this.enemy.update(dt);
    this.fx.update(dt);
    this.feed.update(dt);
    this.hud.update(this.sceneWidth, this.sceneHeight);
  }

  private heroPos(id: string): [number, number] {
    const hero = this.heroes.find((x) => x.heroId === id);
    return hero ? [hero.x, hero.y - 38] : [this.sceneWidth * 0.35, this.sceneHeight * 0.65];
  }

  private bind(): void {
    this.bus.on('combat:damage', ({ sourceId, targetId, amount, crit, style }) => {
      if (sourceId.startsWith('hero-')) {
        const hero = this.heroes.find((x) => x.heroId === sourceId);
        hero?.playAttack();
        const [sx, sy] = this.heroPos(sourceId);
        if (style === 'projectile' || style === 'spell') {
          this.fx.projectile(sx + 18, sy, this.enemy.x - 16, this.enemy.y - 44, style === 'spell');
        }
        this.enemy.playHurt();
        this.fx.damage(this.enemy.x, this.enemy.y - 82, amount, crit);
        this.fx.impact(this.enemy.x - 8, this.enemy.y - 40, style === 'spell' ? 0x789cff : 0xffb56b);
      } else if (sourceId === 'status-burn') {
        this.fx.damage(this.enemy.x, this.enemy.y - 82, amount, false);
      } else {
        this.enemy.playAttack();
        const hero = this.heroes.find((x) => x.heroId === targetId);
        hero?.playHit();
        const [x, y] = this.heroPos(targetId);
        this.fx.damage(x, y - 34, amount, false);
      }
    });

    this.bus.on('combat:heal', ({ targetId, amount }) => {
      this.heroes.find((hero) => hero.job === 'cleric')?.playHeal();
      const [x, y] = this.heroPos(targetId);
      this.fx.heal(x, y - 34, amount);
      this.fx.healPulse(x, y + 10);
    });

    this.bus.on('combat:status', ({ status, active }) => {
      if (active) this.fx.status(this.enemy.x, this.enemy.y - 38, status);
    });

    this.bus.on('combat:enemy-death', () => {
      this.enemy.playDeath();
      this.fx.loot(this.enemy.x, this.enemy.y - 10);
    });

    this.bus.on('combat:enemy-spawn', () => {
      this.enemy.reset();
      this.fx.spawn(this.enemy.x, this.enemy.y - 12);
    });

    this.bus.on('loot:drop', ({ itemName, rarity, gold }) => {
      this.feed.add(gold ? `+${gold} Gold · ${itemName}` : itemName, rarity !== 'common');
    });

    this.bus.on('progress:zone-ready', () => this.feed.add('Zone cleared · Next zone ready', true));
  }
}
