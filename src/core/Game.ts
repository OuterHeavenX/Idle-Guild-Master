import { EventBus } from './EventBus';
import { StateManager, type GameSave } from './StateManager';
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
  private animationFrame = 0;
  private autosaveTimer = 0;
  private started = false;
  private paused = false;
  private disposers: Array<() => void> = [];

  constructor(private pixi: PixiRenderer, private three: ThreeRenderer) {}

  /** Must run before renderer construction or any view is mounted. Never saves defaults before reading. */
  hydrate(): GameSave | null {
    const loaded = this.state.load();
    this.createParties();
    if (loaded) {
      const result = this.offline.calculate(
        loaded.savedAt,
        Date.now(),
        60,
        this.partyA.averageLevel,
        this.state.zoneLevel,
        1,
        this.state.guild.facilities.expeditionHQ,
      );
      if (result.gold > 0) {
        this.state.guild.gold += result.gold;
        // Advance the offline watermark immediately so a rapid reload cannot award it twice.
        this.state.save();
      }
    }
    return loaded;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (!this.partyA || !this.partyB) this.createParties();

    this.disposers.push(
      this.bus.on('loot:drop', ({ gold = 0, shards = 0 }) => {
        this.state.guild.gold += gold;
        this.state.guild.shards += shards;
        this.bounties.progress('daily-kills', 1, this.state.guild);
        this.state.save();
      }),
      this.bus.on('progress:zone-complete', ({ gold, shards }) => {
        this.state.guild.gold += gold;
        this.state.guild.shards += shards;
        this.state.save();
      }),
    );

    const resize = () => this.resize();
    const beforeUnload = () => this.state.save();
    addEventListener('resize', resize);
    addEventListener('beforeunload', beforeUnload);
    this.disposers.push(
      () => removeEventListener('resize', resize),
      () => removeEventListener('beforeunload', beforeUnload),
    );

    this.autosaveTimer = window.setInterval(() => this.state.save(), 10_000);
    this.resize();
    this.lastFrame = performance.now();
    this.animationFrame = requestAnimationFrame(this.frame);
    // First-time players receive a durable V2 save only after hydration and UI composition.
    let hasCurrentSave = false;
    try { hasCurrentSave = Boolean(localStorage.getItem('idle-guild-master-save')); }
    catch { /* StateManager reports unavailable storage without aborting boot. */ }
    if (!hasCurrentSave) this.state.save();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    cancelAnimationFrame(this.animationFrame);
    window.clearInterval(this.autosaveTimer);
    this.combat.leave();
    for (const dispose of this.disposers.splice(0)) dispose();
    this.state.save();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.combat.setMove(0, 0);
  }

  startRaid(): void {
    this.raid.start(this.partyA, this.partyB);
    this.bounties.progress('weekly-raids', 1, this.state.guild);
  }

  private createParties(): void {
    this.partyA = new Party('A', this.state.heroes.slice(0, 4));
    this.partyB = new Party('B', this.state.heroes.slice(4, 8));
  }

  private frame = (now: number): void => {
    if (!this.started) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (!this.paused && this.state.world.location === 'ashenCrypt') this.combat.update(dt);
    if (!this.paused) this.pixi.update(dt);
    if (!this.paused && this.state.world.location === 'ashenCrypt') this.three.render(dt);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private resize(): void {
    const host = document.getElementById('game-canvas');
    if (!host) return;
    this.three.resize(host.clientWidth, host.clientHeight);
    this.pixi.layout();
  }
}
