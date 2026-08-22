import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export class LootFeed extends Container {
  private lines: Text[] = [];
  private bg = new Graphics();
  constructor() { super(); this.addChild(this.bg); }
  add(message: string, rare = false): void {
    const text = new Text({ text: message, style: new TextStyle({ fontFamily: 'system-ui', fontSize: 11, fill: rare ? 0xd6b7ff : 0xd8d0c6, fontWeight: rare ? '700' : '500' }) });
    this.lines.unshift(text); this.addChild(text); if (this.lines.length > 4) this.lines.pop()?.destroy(); this.layoutLines();
  }
  resize(width: number): void { this.bg.clear().roundRect(0, 0, width, 72, 10).fill({ color: 0x090b12, alpha: 0.72 }).stroke({ color: 0x4c3d51, width: 1, alpha: 0.7 }); this.layoutLines(); }
  private layoutLines(): void { this.lines.forEach((line, i) => { line.position.set(9, 7 + i * 15); line.alpha = 1 - i * 0.16; }); }
}
