import { Container, Graphics, Text, TextStyle } from 'pixi.js';

type Effect = { node: Container; life: number; max: number; vx: number; vy: number; kind: 'float' | 'projectile' | 'burst' };

export class CombatEffects {
  readonly container = new Container();
  private effects: Effect[] = [];
  private readonly numberStyle = new TextStyle({ fontFamily: 'system-ui', fontSize: 18, fontWeight: '800', fill: 0xffe3b0, stroke: { color: 0x251119, width: 4 } });
  damage(x: number, y: number, amount: number, crit: boolean): void {
    const text = new Text({ text: crit ? `CRIT ${amount}` : `${amount}`, style: this.numberStyle }); text.anchor.set(0.5); text.scale.set(crit ? 1.2 : 1);
    this.add(text, x, y, 0.8, (Math.random() - 0.5) * 12, -34, 'float');
  }
  heal(x: number, y: number, amount: number): void {
    const text = new Text({ text: `+${amount}`, style: new TextStyle({ fontFamily: 'system-ui', fontSize: 17, fontWeight: '800', fill: 0x9ff7b4, stroke: { color: 0x12351f, width: 4 } }) }); text.anchor.set(0.5);
    this.add(text, x, y, 0.85, 0, -30, 'float');
  }
  projectile(x1: number, y1: number, x2: number, y2: number, magic = false): void {
    const node = new Container();
    const dot = new Graphics().circle(0, 0, magic ? 5 : 3).fill(magic ? 0x7ac7ff : 0xe8d39a);
    node.addChild(dot); const life = 0.22; this.add(node, x1, y1, life, (x2 - x1) / life, (y2 - y1) / life, 'projectile');
  }
  impact(x: number, y: number, color = 0xffa04d): void {
    for (let i = 0; i < 7; i++) {
      const g = new Graphics().circle(0, 0, 2 + (i % 2)).fill(color); const a = (i / 7) * Math.PI * 2; this.add(g, x, y, 0.35, Math.cos(a) * (28 + i * 3), Math.sin(a) * (28 + i * 3), 'burst');
    }
  }
  status(x: number, y: number, status: 'burn' | 'freeze'): void { this.impact(x, y, status === 'burn' ? 0xff6b35 : 0x74cfff); }
  loot(x: number, y: number): void { for (let i = 0; i < 9; i++) { const g = new Graphics().star(0, 0, 4, 2 + i % 2, 1).fill(i % 2 ? 0xffd36b : 0xb9a2ff); const a = Math.random() * Math.PI * 2; this.add(g, x, y, 0.7, Math.cos(a) * (20 + Math.random() * 45), -20 + Math.sin(a) * 30, 'burst'); } }
  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.life -= dt; e.node.x += e.vx * dt; e.node.y += e.vy * dt;
      if (e.kind !== 'projectile') e.vy += 34 * dt;
      e.node.alpha = Math.max(0, e.life / e.max);
      if (e.life <= 0) { e.node.destroy({ children: true }); this.effects.splice(i, 1); }
    }
  }
  private add(node: Container, x: number, y: number, life: number, vx: number, vy: number, kind: Effect['kind']): void { node.position.set(x, y); this.container.addChild(node); this.effects.push({ node, life, max: life, vx, vy, kind }); if (this.effects.length > 80) { const old = this.effects.shift(); old?.node.destroy({ children: true }); } }
}
