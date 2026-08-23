import { Container } from 'pixi.js';
import type { CombatSnapshot, EnemyCombatAction } from '../../systems/CombatSystem';
import { createCryptGhoulVisual } from './art/EnemyVisualFactory';

type EnemyPose = CombatSnapshot['enemy'];

export class EnemyActor extends Container {
  private visual = createCryptGhoulVisual();
  private time = 0;
  private action: EnemyCombatAction = 'spawn';
  private actionProgress = 0;
  private facingX = -1;
  private hurtTimer = 0;
  private deathStarted = false;

  constructor() {
    super();
    this.addChild(this.visual.root);
  }

  setCombatPose(pose: EnemyPose): void {
    if (this.action !== pose.action && pose.action === 'dead') this.deathStarted = true;
    this.action = pose.action;
    this.actionProgress = Math.max(0, Math.min(1, pose.actionProgress));
    if (Math.abs(pose.facing.x) > 0.08) this.facingX = pose.facing.x < 0 ? -1 : 1;
    if (pose.hurt) this.hurtTimer = Math.max(this.hurtTimer, 0.08);
  }

  playAttack(): void {
    this.action = 'strike';
    this.actionProgress = 0;
  }

  playHurt(): void { this.hurtTimer = Math.max(this.hurtTimer, 0.2); }

  playDeath(): void {
    this.action = 'dead';
    this.actionProgress = 0;
    this.deathStarted = true;
  }

  reset(): void {
    this.visible = true;
    this.alpha = 1;
    this.scale.set(1);
    this.rotation = 0;
    this.action = 'spawn';
    this.actionProgress = 0;
    this.hurtTimer = 0;
    this.deathStarted = false;
    this.visual.root.position.set(0, 0);
    this.visual.root.rotation = 0;
    this.visual.root.scale.set(1);
  }

  update(dt: number): void {
    this.time += dt;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    const approachStep = this.action === 'approach' ? Math.sin(this.time * 9.2) : 0;
    let lunge = 0;
    let lean = 0;
    if (this.action === 'telegraph') {
      lunge = -5 * this.actionProgress;
      lean = -0.06 * this.actionProgress;
    } else if (this.action === 'strike') {
      lunge = 24 * Math.sin(this.actionProgress * Math.PI);
      lean = 0.14 * Math.sin(this.actionProgress * Math.PI);
    } else if (this.action === 'recovery') {
      lunge = 8 * (1 - this.actionProgress);
      lean = 0.05 * (1 - this.actionProgress);
    }

    this.visual.aura.clear();
    if (this.action === 'telegraph') {
      const pulse = 0.2 + this.actionProgress * 0.5 + Math.sin(this.time * 18) * 0.08;
      this.visual.aura
        .ellipse(0, 9, 43 + this.actionProgress * 9, 13 + this.actionProgress * 3)
        .fill({ color: 0x8e2629, alpha: pulse * 0.24 })
        .stroke({ color: 0xe46d56, width: 2, alpha: pulse });
    } else if (this.action !== 'dead') {
      this.visual.aura.ellipse(0, 7, 45, 14).fill({ color: 0x322c49, alpha: 0.08 + Math.sin(this.time * 1.9) * 0.018 });
    }

    if (this.action === 'dead' || this.deathStarted) {
      const t = this.actionProgress;
      this.rotation = this.facingX * -0.72 * t;
      this.alpha = Math.max(0, 1 - t * 1.12);
      this.scale.y = 1 - t * 0.36;
      this.visual.root.y = t * 22;
      return;
    }

    this.visible = true;
    this.rotation = 0;
    this.alpha = this.action === 'spawn' ? Math.min(1, this.actionProgress * 1.35) : 1;
    this.scale.set(this.action === 'spawn' ? 0.9 + this.actionProgress * 0.1 : 1);
    this.visual.root.x = this.facingX * lunge + (this.hurtTimer > 0 ? Math.sin(this.hurtTimer * 95) * 4 : 0);
    this.visual.root.y = this.action === 'spawn'
      ? 14 * (1 - this.actionProgress)
      : Math.sin(this.time * 2.2) * 1.5 - Math.abs(approachStep) * 1.5;
    this.visual.root.rotation = lean * this.facingX;
    this.visual.root.scale.x = this.facingX;
    this.visual.sprite.rotation = approachStep * 0.014;
    this.visual.sprite.alpha = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 50) % 2 === 0 ? 0.56 : 1;
  }
}
