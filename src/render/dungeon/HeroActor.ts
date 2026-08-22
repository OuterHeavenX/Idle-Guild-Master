import { Container, Graphics } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';

export class HeroActor extends Container {
  private body = new Container();
  private time = Math.random() * 10;
  private action = 0;
  private hit = 0;
  constructor(private state: StateManager, readonly heroId: string, private index: number) {
    super();
    this.addChild(this.body);
    this.draw();
  }

  private draw(): void {
    const hero = this.state.heroes.find((h) => h.id === this.heroId);
    const job = hero?.jobId ?? 'guardian';
    const shadow = new Graphics().ellipse(0, 24, 23, 7).fill({ color: 0x000000, alpha: 0.45 });
    const legs = new Graphics().rect(-9, 6, 7, 20).fill(0x1b1821).rect(3, 6, 7, 20).fill(0x211c27);
    const torso = new Graphics();
    const head = new Graphics().circle(0, -21, 8).fill(0xc9a987);
    const weapon = new Graphics();
    if (job === 'guardian') {
      torso.roundRect(-14, -14, 27, 28, 8).fill(0x586574).stroke({ color: 0xa7b4bc, width: 2 });
      weapon.roundRect(-28, -8, 16, 24, 5).fill(0x39444f).stroke({ color: 0xb7c1c7, width: 2 });
      weapon.moveTo(14, -10).lineTo(30, 8).stroke({ color: 0xc9c3ae, width: 4 });
    } else if (job === 'cleric') {
      torso.roundRect(-12, -14, 24, 29, 8).fill(0xd8cda9).stroke({ color: 0xffefbd, width: 2 });
      weapon.moveTo(18, -27).lineTo(18, 21).stroke({ color: 0x9a7a52, width: 4 }).circle(18, -30, 6).fill(0xffdf83);
    } else if (job === 'ranger') {
      torso.roundRect(-11, -14, 22, 28, 7).fill(0x42543d).stroke({ color: 0x79916d, width: 2 });
      weapon.arc(20, -2, 17, -1.15, 1.15).stroke({ color: 0xb18a58, width: 3 }).moveTo(26, -17).lineTo(26, 13).stroke({ color: 0xe4d8bd, width: 1 });
    } else {
      torso.roundRect(-12, -14, 24, 30, 9).fill(0x504675).stroke({ color: 0x8f7bd3, width: 2 });
      weapon.moveTo(18, -25).lineTo(18, 21).stroke({ color: 0x7761a6, width: 4 }).circle(18, -29, 7).fill({ color: 0x7ac7ff, alpha: 0.9 });
    }
    const hair = new Graphics().arc(0, -22, 8, Math.PI, Math.PI * 2).stroke({ color: 0x33271f, width: 5 });
    this.body.addChild(shadow, legs, torso, head, hair, weapon);
  }

  playAttack(): void { this.action = 0.28; }
  playHit(): void { this.hit = 0.16; }
  update(dt: number): void {
    this.time += dt;
    this.action = Math.max(0, this.action - dt);
    this.hit = Math.max(0, this.hit - dt);
    const breathe = Math.sin(this.time * 2.1 + this.index) * 1.2;
    this.body.y = breathe + (this.hit > 0 ? Math.sin(this.hit * 80) * 2 : 0);
    this.body.rotation = this.action > 0 ? Math.sin((0.28 - this.action) * 11) * 0.13 : Math.sin(this.time * 1.4) * 0.012;
    this.body.x = this.action > 0 ? Math.sin((0.28 - this.action) * 11) * 5 : 0;
  }
}
