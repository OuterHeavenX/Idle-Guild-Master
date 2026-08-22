import { Container, Graphics, Rectangle } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import { createHeroVisual, type HeroVisual } from './art/HeroVisualFactory';

export class HeroActor extends Container {
  private visual: HeroVisual;
  private controlRing = new Graphics();
  private time = Math.random() * 10;
  private action = 0;
  private hit = 0;
  private castPulse = 0;
  private controlled = false;
  readonly job: string;

  constructor(private state: StateManager, readonly heroId: string, private index: number) {
    super();
    const hero = this.state.heroes.find((h) => h.id === this.heroId);
    this.job = hero?.jobId ?? 'guardian';
    this.visual = createHeroVisual(this.job);
    this.hitArea = new Rectangle(-46, -104, 92, 128);
    this.addChild(this.controlRing, this.visual.root);
  }

  setControlled(value: boolean): void {
    this.controlled = value;
    this.eventMode = value ? 'static' : 'none';
    this.cursor = value ? 'grab' : 'default';
  }

  playAttack(): void {
    this.action = this.job === 'guardian' ? 0.3 : 0.38;
    if (this.job === 'cleric' || this.job === 'arcanist') this.castPulse = 0.4;
  }

  playHeal(): void {
    this.action = 0.42;
    this.castPulse = 0.55;
  }

  playHit(): void { this.hit = 0.18; }

  update(dt: number): void {
    this.time += dt;
    this.action = Math.max(0, this.action - dt);
    this.hit = Math.max(0, this.hit - dt);
    this.castPulse = Math.max(0, this.castPulse - dt);

    const breathe = Math.sin(this.time * 2.15 + this.index * 0.8) * 1.2;
    const hurtKick = this.hit > 0 ? Math.sin(this.hit * 85) * 2.6 : 0;
    const attackT = this.action > 0 ? 1 - this.action / (this.job === 'guardian' ? 0.3 : 0.38) : 0;
    const lunge = this.action > 0 ? Math.sin(Math.min(1, attackT) * Math.PI) : 0;

    this.visual.root.y = breathe + hurtKick;
    this.visual.root.x = this.job === 'guardian' ? lunge * 7 : lunge * 2;
    this.visual.sprite.rotation = this.job === 'guardian' && this.action > 0 ? Math.sin(attackT * Math.PI) * 0.07 : Math.sin(this.time * 1.1 + this.index) * 0.008;
    this.visual.sprite.scale.x = 1 + lunge * 0.025;
    this.visual.sprite.scale.y = 1 - lunge * 0.018;
    this.visual.sprite.alpha = this.hit > 0 && Math.floor(this.hit * 45) % 2 === 0 ? 0.68 : 1;

    this.controlRing.clear();
    if (this.controlled) {
      const pulse = 0.42 + Math.sin(this.time * 3.2) * 0.12;
      this.controlRing.ellipse(0, 7, 38, 13).stroke({ color: 0x9cc8df, width: 2, alpha: pulse });
      this.controlRing.ellipse(0, 7, 30, 9).stroke({ color: 0xd8edf7, width: 1, alpha: pulse * 0.55 });
    }

    this.visual.accent.clear();
    if (this.job === 'cleric') {
      const pulse = 0.35 + Math.sin(this.time * 2.7) * 0.08 + (this.castPulse > 0 ? 0.28 : 0);
      this.visual.accent.circle(22, -66, 4).fill({ color: 0xffdfa0, alpha: pulse });
      this.visual.accent.circle(22, -66, 11).stroke({ color: 0xffd56f, width: 1, alpha: pulse * 0.45 });
    } else if (this.job === 'arcanist') {
      const pulse = 0.28 + Math.sin(this.time * 3.1) * 0.08 + (this.castPulse > 0 ? 0.32 : 0);
      this.visual.accent.circle(23, -67, 5).fill({ color: 0x8edcff, alpha: pulse });
      this.visual.accent.circle(-19, -41 + Math.sin(this.time * 2) * 3, 1.5).fill({ color: 0x9b82ff, alpha: 0.55 });
    }
  }
}
