import { EventBus } from './EventBus';
import { StateManager } from './StateManager';
import { OfflineEngine } from './OfflineEngine';
import { Party } from '../models/Party';
import { CombatSystem } from '../systems/CombatSystem';
import { RaidSystem } from '../systems/RaidSystem';
import { BountySystem } from '../systems/BountySystem';
import type { PixiRenderer } from '../render/PixiRenderer';
import type { ThreeRenderer } from '../render/ThreeRenderer';

export class Game {
  readonly bus = new EventBus();
  readonly state = new StateManager(this.bus);
  readonly combat = new CombatSystem(this.bus);
  readonly raid = new RaidSystem(this.bus);
  readonly bounties = new BountySystem();

  private offline = new OfflineEngine();
  private partyA!: Party;
  private partyB!: Party;
  private lastFrame = performance.now();
  private accumulated = 0;
  private animationFrame = 0;

  constructor(private pixi: PixiRenderer, private three: ThreeRenderer) {}

  start(): void {
    const loaded = this.state.load();
    this.partyA = new Party('A', this.state.heroes.slice(0, 4));
    this.partyB = new Party('B', this.state.heroes.slice(4, 8));

    if (loaded) {
      const result = this.offline.calculate(
        loaded.savedAt,
        Date.now(),
        60,
        this.partyA.averageLevel,
        this.state.zoneLevel,
        1,
        this.state.guild.facilities.expeditionHQ
      );
      this.state.guild.gold += result.gold;
    }

    window.setInterval(() => this.state.save(), 10_000);
    window.addEventListener('beforeunload', () => this.state.save());
    window.addEventListener('resize', () => this.resize());

    this.bus.on('loot:drop', () => {
      this.state.guild.gold += 25;
      this.state.guild.shards += 1;
      this.bounties.progress('daily-kills', 1, this.state.guild);
    });

    this.resize();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.animationFrame);
    this.state.save();
  }

  startRaid(): void {
    this.raid.start(this.partyA, this.partyB);
    this.bounties.progress('weekly-raids', 1, this.state.guild);
  }

  private frame = (now: number): void => {
    const deltaSeconds = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.accumulated += deltaSeconds;

    while (this.accumulated >= 1) {
      this.combat.tick(this.partyA, this.state.zoneLevel);
      this.raid.tick(this.partyA, this.partyB);
      this.accumulated -= 1;
    }

    this.pixi.update(deltaSeconds);
    this.three.render(deltaSeconds);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private resize(): void {
    const host = document.getElementById('game-canvas');
    if (!host) return;
    this.three.resize(host.clientWidth, host.clientHeight);
    this.pixi.layout();
  }
}
