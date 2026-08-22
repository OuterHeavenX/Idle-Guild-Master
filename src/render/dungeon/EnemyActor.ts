import { Container, Graphics } from 'pixi.js';

export class EnemyActor extends Container {
  private body = new Container();
  private time = 0;
  private action = 0;
  private hurt = 0;
  private dying = 0;
  constructor() {
    super();
    this.addChild(this.body);
    this.draw();
  }
  private draw(): void {
    const shadow = new Graphics().ellipse(0, 33, 33, 9).fill({ color: 0x000000, alpha: 0.55 });
    const legs = new Graphics().moveTo(-12, 8).lineTo(-18, 31).stroke({ color: 0x2d3030, width: 9 }).moveTo(9, 8).lineTo(16, 31).stroke({ color: 0x282b2b, width: 9 });
    const torso = new Graphics().roundRect(-24, -18, 48, 43, 16).fill(0x4b5149).stroke({ color: 0x78806f, width: 2 });
    const head = new Graphics().circle(0, -31, 17).fill(0x646b5e).stroke({ color: 0x8d947d, width: 2 });
    const jaw = new Graphics().moveTo(-10, -25).lineTo(0, -17).lineTo(11, -26).stroke({ color: 0x282c26, width: 3 });
    const eyes = new Graphics().circle(-6, -34, 2.5).fill(0xff7a43).circle(7, -34, 2.5).fill(0xff7a43);
    const arms = new Graphics().moveTo(-20, -7).lineTo(-38, 15).stroke({ color: 0x4a5048, width: 10 }).moveTo(20, -7).lineTo(38, 13).stroke({ color: 0x4a5048, width: 10 });
    this.body.addChild(shadow, legs, arms, torso, head, jaw, eyes);
  }
  playAttack(): void { this.action = 0.32; }
  playHurt(): void { this.hurt = 0.18; }
  playDeath(): void { this.dying = 0.75; }
  reset(): void { this.visible = true; this.alpha = 1; this.scale.set(1); this.rotation = 0; this.dying = 0; }
  update(dt: number): void {
    this.time += dt; this.action = Math.max(0, this.action - dt); this.hurt = Math.max(0, this.hurt - dt); this.dying = Math.max(0, this.dying - dt);
    if (this.dying > 0) {
      const t = 1 - this.dying / 0.75; this.rotation = t * 1.15; this.alpha = 1 - t; this.scale.y = 1 - t * 0.45; return;
    }
    this.body.y = Math.sin(this.time * 2.4) * 2;
    this.body.x = this.action > 0 ? -Math.sin((0.32 - this.action) * 9) * 10 : this.hurt > 0 ? Math.sin(this.hurt * 90) * 4 : 0;
  }
}
