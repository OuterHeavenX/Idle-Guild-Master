import { Container, Graphics, Rectangle } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import type { CombatSnapshot, PlayerCombatAction } from '../../systems/CombatSystem';
import { createHeroVisual, type HeroVisual } from './art/HeroVisualFactory';

type PlayerPose = CombatSnapshot['player'];

export class HeroActor extends Container {
  private visual: HeroVisual;
  private controlRing = new Graphics();
  private guardCue = new Graphics();
  private time = 0;
  private hitTimer = 0;
  private attackPulse = 0;
  private controlled = true;
  private action: PlayerCombatAction = 'idle';
  private actionProgress = 0;
  private facingX = 1;
  private moving = false;
  private blocking = false;
  private guardBroken = false;
  readonly job: string;

  constructor(private state: StateManager, readonly heroId: string, _index = 0) {
    super();
    const hero = this.state.heroes.find((entry) => entry.id === this.heroId);
    this.job = hero?.jobId ?? 'guardian';
    this.visual = createHeroVisual('guardian');
    this.hitArea = new Rectangle(-46, -104, 92, 128);
    this.addChild(this.controlRing, this.guardCue, this.visual.root);
  }

  setControlled(value: boolean): void {
    this.controlled = value;
    this.eventMode = 'none';
    this.cursor = 'default';
  }

  setCombatPose(pose: PlayerPose): void {
    this.action = pose.action;
    this.actionProgress = Math.max(0, Math.min(1, pose.actionProgress));
    if (Math.abs(pose.facing.x) > 0.08) this.facingX = pose.facing.x < 0 ? -1 : 1;
    this.moving = pose.moving;
    this.blocking = pose.blocking;
    this.guardBroken = pose.guardBroken;
    if (pose.hurt) this.hitTimer = Math.max(this.hitTimer, 0.08);
  }

  playAttack(): void { this.attackPulse = 0.16; }
  playHit(): void { this.hitTimer = Math.max(this.hitTimer, 0.2); }

  reset(): void {
    this.visible = true;
    this.alpha = 1;
    this.rotation = 0;
    this.action = 'idle';
    this.actionProgress = 0;
    this.hitTimer = 0;
    this.attackPulse = 0;
    this.blocking = false;
    this.guardBroken = false;
    this.visual.root.position.set(0, 0);
    this.visual.root.rotation = 0;
    this.visual.root.scale.set(1);
  }

  update(dt: number): void {
    this.time += dt;
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.attackPulse = Math.max(0, this.attackPulse - dt);

    const walk = this.moving && this.action !== 'down' ? Math.sin(this.time * 11) : 0;
    const breathe = Math.sin(this.time * 2.15) * 1.15;
    const hurtKick = this.hitTimer > 0 ? Math.sin(this.hitTimer * 90) * 2.8 : 0;
    let lunge = 0;
    let lean = 0;

    if (this.action === 'attack-windup') {
      lunge = -5 * this.actionProgress;
      lean = -0.07 * this.actionProgress;
    } else if (this.action === 'attack-active') {
      lunge = 19 * Math.sin(this.actionProgress * Math.PI * 0.78);
      lean = 0.13 * Math.sin(this.actionProgress * Math.PI);
    } else if (this.action === 'attack-recovery') {
      lunge = 9 * (1 - this.actionProgress);
      lean = 0.06 * (1 - this.actionProgress);
    } else if (this.blocking) {
      lunge = -4;
      lean = -0.055;
    }

    this.visual.root.x = this.facingX * lunge + hurtKick;
    this.visual.root.y = breathe + Math.abs(walk) * -1.8;
    this.visual.root.rotation = lean * this.facingX;
    this.visual.root.scale.x = this.facingX;
    this.visual.root.scale.y = this.action === 'down' ? 0.72 : 1;
    this.visual.sprite.rotation = walk * 0.012 + (this.blocking ? -0.035 * this.facingX : 0);
    this.visual.sprite.alpha = this.hitTimer > 0 && Math.floor(this.hitTimer * 52) % 2 === 0 ? 0.58 : 1;

    if (this.action === 'down') {
      this.rotation += (-1.15 - this.rotation) * Math.min(1, dt * 8);
      this.alpha = 0.68;
    } else {
      this.rotation += (0 - this.rotation) * Math.min(1, dt * 12);
      this.alpha = 1;
    }

    this.controlRing.clear();
    if (this.controlled && this.action !== 'down') {
      const pulse = 0.36 + Math.sin(this.time * 3.2) * 0.1;
      this.controlRing.ellipse(0, 7, 35, 11).stroke({ color: 0x9cc8df, width: 2, alpha: pulse });
    }

    this.guardCue.clear();
    if (this.blocking || this.guardBroken) {
      const color = this.guardBroken ? 0xd35b55 : 0xb9d7e5;
      const alpha = this.guardBroken ? 0.36 + Math.sin(this.time * 15) * 0.2 : 0.72;
      const side = this.facingX;
      this.guardCue
        .moveTo(side * 29, -69)
        .lineTo(side * 42, -53)
        .lineTo(side * 38, -25)
        .stroke({ color, width: this.guardBroken ? 2 : 4, alpha });
      if (this.blocking) this.guardCue.ellipse(side * 31, -47, 13, 29).stroke({ color: 0xe7f1f5, width: 1, alpha: 0.42 });
    }
  }
}
