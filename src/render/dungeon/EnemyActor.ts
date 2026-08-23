import { Container } from 'pixi.js';
import { createCryptGhoulVisual } from './art/EnemyVisualFactory';

export class EnemyActor extends Container {
  private visual = createCryptGhoulVisual();
  private time = 0;
  private action = 0;
  private hurt = 0;
  private dying = 0;
  private spawning = 0.5;

  constructor() {
    super();
    this.addChild(this.visual.root);
  }

  playAttack(): void { this.action = 0.34; }
  playHurt(): void { this.hurt = 0.2; }
  playDeath(): void { this.dying = 0.72; }

  reset(): void {
    this.visible = true;
    this.alpha = 1;
    this.scale.set(1);
    this.rotation = 0;
    this.dying = 0;
    this.spawning = 0.5;
    this.visual.root.y = 14;
  }

  update(dt: number): void {
    this.time += dt;
    this.action = Math.max(0, this.action - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.dying = Math.max(0, this.dying - dt);
    this.spawning = Math.max(0, this.spawning - dt);

    this.visual.aura.clear();
    this.visual.aura.ellipse(0, 7, 45, 14).fill({ color: 0x322c49, alpha: 0.08 + Math.sin(this.time * 1.9) * 0.018 });

    if (this.dying > 0) {
      const t = 1 - this.dying / 0.72;
      this.rotation = t * 0.72;
      this.alpha = Math.max(0, 1 - t * 1.2);
      this.scale.y = 1 - t * 0.36;
      this.visual.root.y = t * 22;
      return;
    }

    if (this.spawning > 0) {
      const t = 1 - this.spawning / 0.5;
      this.alpha = Math.min(1, t * 1.35);
      this.visual.root.y = 14 * (1 - t);
      this.scale.set(0.9 + t * 0.1);
    } else {
      this.alpha = 1;
      this.scale.set(1);
      this.visual.root.y = Math.sin(this.time * 2.2) * 1.8;
    }

    const attackT = this.action > 0 ? 1 - this.action / 0.34 : 0;
    this.visual.root.x = this.action > 0 ? -Math.sin(attackT * Math.PI) * 14 : this.hurt > 0 ? Math.sin(this.hurt * 95) * 4 : 0;
    this.visual.sprite.rotation = this.action > 0 ? -Math.sin(attackT * Math.PI) * 0.08 : Math.sin(this.time * 1.6) * 0.012;
    this.visual.sprite.alpha = this.hurt > 0 && Math.floor(this.hurt * 50) % 2 === 0 ? 0.6 : 1;
  }
}
