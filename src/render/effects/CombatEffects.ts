import { Container, Graphics, Text, TextStyle } from 'pixi.js';

type Effect = { node: Container; life: number; max: number; vx: number; vy: number; kind: 'float' | 'projectile' | 'burst' | 'ring' };

export class CombatEffects {
  readonly container = new Container();
  private effects: Effect[] = [];
  private readonly numberStyle = new TextStyle({ fontFamily: 'system-ui', fontSize: 17, fontWeight: '800', fill: 0xffe3b0, stroke: { color: 0x251119, width: 4 } });

  damage(x: number, y: number, amount: number, crit: boolean): void {
    const text = new Text({ text: crit ? `CRIT ${amount}` : `${amount}`, style: this.numberStyle });
    text.anchor.set(0.5);
    text.scale.set(crit ? 1.16 : 0.92);
    this.add(text, x, y, crit ? 0.9 : 0.72, (Math.random() - 0.5) * 9, -31, 'float');
  }

  heal(x: number, y: number, amount: number): void {
    const text = new Text({ text: `+${amount}`, style: new TextStyle({ fontFamily: 'system-ui', fontSize: 16, fontWeight: '800', fill: 0xb7f6b5, stroke: { color: 0x12351f, width: 4 } }) });
    text.anchor.set(0.5);
    this.add(text, x, y, 0.82, 0, -28, 'float');
  }

  healPulse(x: number, y: number): void {
    const ring = new Graphics().ellipse(0, 0, 24, 8).stroke({ color: 0xffdc7a, width: 2, alpha: 0.8 }).ellipse(0, 0, 15, 5).stroke({ color: 0xb8f4b5, width: 1, alpha: 0.7 });
    this.add(ring, x, y, 0.5, 0, -3, 'ring');
  }

  projectile(x1: number, y1: number, x2: number, y2: number, magic = false): void {
    const node = new Container();
    if (magic) {
      node.addChild(new Graphics().circle(0, 0, 8).fill({ color: 0x705bff, alpha: 0.12 }).circle(0, 0, 4).fill(0x88d8ff));
    } else {
      node.addChild(new Graphics().moveTo(-7, 0).lineTo(7, 0).stroke({ color: 0xead6a4, width: 2 }).moveTo(7, 0).lineTo(3, -3).lineTo(3, 3).fill(0xb99055));
    }
    const life = magic ? 0.26 : 0.22;
    node.rotation = Math.atan2(y2 - y1, x2 - x1);
    this.add(node, x1, y1, life, (x2 - x1) / life, (y2 - y1) / life, 'projectile');
  }

  impact(x: number, y: number, color = 0xffa04d): void {
    for (let i = 0; i < 6; i++) {
      const g = new Graphics().circle(0, 0, 1.5 + (i % 2)).fill(color);
      const a = (i / 6) * Math.PI * 2;
      this.add(g, x, y, 0.3, Math.cos(a) * (24 + i * 3), Math.sin(a) * (24 + i * 3), 'burst');
    }
  }

  status(x: number, y: number, status: 'burn' | 'freeze'): void {
    this.impact(x, y, status === 'burn' ? 0xff6b35 : 0x74cfff);
    const mark = status === 'burn'
      ? new Graphics().moveTo(0, 8).bezierCurveTo(-8, 0, 3, -14, 0, -20).bezierCurveTo(11, -9, 9, 3, 0, 8).fill({ color: 0xff7638, alpha: 0.68 })
      : new Graphics().star(0, 0, 6, 11, 4).stroke({ color: 0x9be9ff, width: 2, alpha: 0.85 });
    this.add(mark, x, y - 16, 0.5, 0, -4, 'ring');
  }

  loot(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics().star(0, 0, 4, 2 + i % 2, 1).fill(i % 2 ? 0xffd36b : 0xb9a2ff);
      const a = (i / 8) * Math.PI * 2;
      this.add(g, x, y, 0.65, Math.cos(a) * (22 + i * 4), -25 + Math.sin(a) * 25, 'burst');
    }
  }

  spawn(x: number, y: number): void {
    const ring = new Graphics().ellipse(0, 0, 38, 12).fill({ color: 0x594b78, alpha: 0.16 }).stroke({ color: 0x8b78b4, width: 1, alpha: 0.4 });
    this.add(ring, x, y + 18, 0.55, 0, 0, 'ring');
    for (let i = 0; i < 5; i++) {
      const mote = new Graphics().circle(0, 0, 2).fill({ color: 0x8c82a4, alpha: 0.6 });
      this.add(mote, x - 18 + i * 9, y + 20, 0.5 + i * 0.04, 0, -18 - i * 3, 'burst');
    }
  }

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      e.life -= dt;
      e.node.x += e.vx * dt;
      e.node.y += e.vy * dt;
      if (e.kind === 'burst') e.vy += 30 * dt;
      if (e.kind === 'ring') e.node.scale.set(1 + (1 - e.life / e.max) * 0.28);
      e.node.alpha = Math.max(0, e.life / e.max);
      if (e.life <= 0) {
        e.node.destroy({ children: true });
        this.effects.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const effect of this.effects) effect.node.destroy({ children: true });
    this.effects = [];
  }

  private add(node: Container, x: number, y: number, life: number, vx: number, vy: number, kind: Effect['kind']): void {
    node.position.set(x, y);
    this.container.addChild(node);
    this.effects.push({ node, life, max: life, vx, vy, kind });
    if (this.effects.length > 64) {
      const old = this.effects.shift();
      old?.node.destroy({ children: true });
    }
  }
}
