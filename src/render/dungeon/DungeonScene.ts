import { Container, Rectangle } from 'pixi.js';
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
  private controlledHero?: HeroActor;
  private draggingControlledHero = false;

  constructor(private state: StateManager, private combat: CombatSystem, private bus: EventBus) {
    super();
    this.hud = new DungeonHud(state, combat);
    this.eventMode = 'static';
    this.addChild(this.environment.container, this.environment.ambient, this.actors, this.fx.container, this.hud, this.feed);
    state.heroes.slice(0, 4).forEach((h, i) => {
      const actor = new HeroActor(state, h.id, i);
      if (i === 0) {
        this.controlledHero = actor;
        actor.setControlled(true);
        actor.on('pointerdown', (event) => {
          const hero = this.state.heroes.find((entry) => entry.id === actor.heroId);
          if (!hero?.alive || this.combat.recovering || this.combat.canAdvanceZone) return;
          this.draggingControlledHero = true;
          actor.cursor = 'grabbing';
          event.stopPropagation();
        });
      }
      this.heroes.push(actor);
      this.actors.addChild(actor);
    });
    this.actors.addChild(this.enemy);
    this.on('pointermove', (event) => {
      if (!this.draggingControlledHero || !this.controlledHero) return;
      const hero = this.state.heroes.find((entry) => entry.id === this.controlledHero!.heroId);
      if (!hero?.alive) {
        this.stopDragging();
        return;
      }
      const point = event.getLocalPosition(this.actors);
      const x = Math.max(this.sceneWidth * 0.14, Math.min(this.sceneWidth * 0.68, point.x));
      const y = Math.max(this.sceneHeight * 0.49, Math.min(this.sceneHeight * 0.75, point.y));
      this.controlledHero.position.set(x, y);
    });
    this.on('pointerup', () => this.stopDragging());
    this.on('pointerupoutside', () => this.stopDragging());
    this.bind();
  }

  resize(width: number, height: number): void {
    this.sceneWidth = width;
    this.sceneHeight = height;
    this.hitArea = new Rectangle(0, 0, width, height);
    this.environment.resize(width, height);

    const compact = width < 460;
    const formationByJob: Record<string, [number, number]> = {
      guardian: [width * 0.52, height * 0.61],
      cleric: [width * 0.31, height * 0.58],
      ranger: [width * 0.18, height * 0.72],
      arcanist: [width * 0.61, height * 0.72],
    };
    const fallback: Array<[number, number]> = [
      [width * 0.52, height * 0.61],
      [width * 0.31, height * 0.58],
      [width * 0.18, height * 0.72],
      [width * 0.61, height * 0.72],
    ];
    this.heroes.forEach((hero, i) => {
      const point = formationByJob[hero.job] ?? fallback[i]!;
      hero.position.set(point[0], point[1]);
      hero.scale.set(compact ? 0.94 : 1.06);
    });

    this.enemy.position.set(width * 0.72, height * 0.43);
    this.feed.position.set(10, height * 0.29);
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

  private stopDragging(): void {
    this.draggingControlledHero = false;
    if (this.controlledHero) this.controlledHero.cursor = 'grab';
  }

  private resetControlledHero(): void {
    if (!this.controlledHero) return;
    this.stopDragging();
    this.controlledHero.position.set(this.sceneWidth * 0.52, this.sceneHeight * 0.61);
  }

  private heroPos(id: string): [number, number] {
    const hero = this.heroes.find((x) => x.heroId === id);
    return hero ? [hero.x, hero.y - 38] : [this.sceneWidth * 0.35, this.sceneHeight * 0.65];
  }

  private projectileOrigin(hero: HeroActor): [number, number] {
    if (hero.job === 'ranger') return [hero.x + 28, hero.y - 50];
    if (hero.job === 'cleric') return [hero.x + 20, hero.y - 59];
    if (hero.job === 'arcanist') return [hero.x + 22, hero.y - 60];
    return [hero.x + 18, hero.y - 42];
  }

  private bind(): void {
    this.bus.on('combat:damage', ({ sourceId, targetId, amount, crit, style }) => {
      if (sourceId.startsWith('hero-')) {
        const hero = this.heroes.find((x) => x.heroId === sourceId);
        hero?.playAttack();
        if (hero && (style === 'projectile' || style === 'spell')) {
          const [sx, sy] = this.projectileOrigin(hero);
          this.fx.projectile(sx, sy, this.enemy.x - 16, this.enemy.y - 48, style === 'spell');
        }
        this.enemy.playHurt();
        this.fx.damage(this.enemy.x, this.enemy.y - 88, amount, crit);
        this.fx.impact(this.enemy.x - 8, this.enemy.y - 44, style === 'spell' ? 0x789cff : 0xffb56b);
      } else if (sourceId === 'status-burn') {
        this.fx.damage(this.enemy.x, this.enemy.y - 88, amount, false);
      } else {
        this.enemy.playAttack();
        const hero = this.heroes.find((x) => x.heroId === targetId);
        hero?.playHit();
        const [x, y] = this.heroPos(targetId);
        this.fx.damage(x, y - 34, amount, false);
      }
    });

    this.bus.on('combat:heal', ({ sourceId, targetId, amount }) => {
      if (sourceId.startsWith('hero-')) this.heroes.find((hero) => hero.job === 'cleric')?.playHeal();
      const [x, y] = this.heroPos(targetId);
      this.fx.heal(x, y - 34, amount);
      this.fx.healPulse(x, y + 10);
    });

    this.bus.on('combat:status', ({ status, active }) => {
      if (active) this.fx.status(this.enemy.x, this.enemy.y - 42, status);
    });

    this.bus.on('combat:enemy-death', () => {
      this.enemy.playDeath();
      this.fx.loot(this.enemy.x, this.enemy.y - 10);
    });

    this.bus.on('combat:enemy-spawn', () => {
      this.enemy.reset();
      this.fx.spawn(this.enemy.x, this.enemy.y - 12);
    });

    this.bus.on('combat:hero-down', ({ heroId }) => {
      const hero = this.state.heroes.find((entry) => entry.id === heroId);
      if (hero) this.feed.add(`${hero.name} is DOWN`, true);
      if (heroId === this.controlledHero?.heroId) this.stopDragging();
    });

    this.bus.on('combat:party-defeated', ({ recoveryTicks }) => {
      this.stopDragging();
      this.feed.add(`PARTY DEFEATED · Retreating ${recoveryTicks}s`, true);
    });

    this.bus.on('combat:party-recovered', () => {
      this.resetControlledHero();
      this.feed.add('Party recovered · Wave 1 retry', true);
    });

    this.bus.on('loot:drop', ({ itemName, rarity, gold, shards }) => {
      const rewards = [gold ? `+${gold} Gold` : '', shards ? `+${shards} Shard` : ''].filter(Boolean).join(' · ');
      this.feed.add(rewards ? `${rewards} · ${itemName}` : itemName, rarity !== 'common');
    });

    this.bus.on('progress:zone-complete', ({ gold, shards }) => {
      this.feed.add(`Zone bonus · +${gold} Gold · +${shards} Shard`, true);
    });

    this.bus.on('progress:zone-ready', () => this.feed.add('Zone cleared · Next zone ready', true));
  }
}
