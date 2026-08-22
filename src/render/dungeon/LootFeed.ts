import { Container, Graphics, Text, TextStyle } from 'pixi.js';

type FeedLine = { text: Text; life: number; rare: boolean };

export class LootFeed extends Container {
  private lines: FeedLine[] = [];
  private bg = new Graphics();
  private width = 150;

  constructor() {
    super();
    this.addChild(this.bg);
  }

  add(message: string, rare = false): void {
    const text = new Text({
      text: message,
      style: new TextStyle({
        fontFamily: 'system-ui',
        fontSize: 10,
        fill: rare ? 0xe0c5ff : 0xd8d0c6,
        fontWeight: rare ? '700' : '500',
        wordWrap: true,
        wordWrapWidth: this.width - 16,
      }),
    });
    this.lines.unshift({ text, life: 4.2, rare });
    this.addChild(text);
    while (this.lines.length > 4) this.lines.pop()?.text.destroy();
    this.layoutLines();
  }

  resize(width: number): void {
    this.width = width;
    this.lines.forEach((line) => { line.text.style.wordWrapWidth = width - 16; });
    this.drawBackground();
    this.layoutLines();
  }

  update(dt: number): void {
    let changed = false;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i]!;
      line.life -= dt;
      if (line.life <= 0) {
        line.text.destroy();
        this.lines.splice(i, 1);
        changed = true;
      }
    }
    this.lines.forEach((line, i) => {
      const ageFade = Math.min(1, line.life / 0.7);
      line.text.alpha = ageFade * (1 - i * 0.14);
      line.text.x = 8 + (1 - ageFade) * 3;
    });
    if (changed) this.layoutLines();
  }

  private drawBackground(): void {
    this.bg.clear();
    if (!this.lines.length) return;
    const height = 12 + this.lines.length * 15;
    this.bg.roundRect(0, 0, this.width, height, 8).fill({ color: 0x090b12, alpha: 0.58 }).stroke({ color: 0x4c3d51, width: 1, alpha: 0.45 });
  }

  private layoutLines(): void {
    this.lines.forEach((line, i) => line.text.position.set(8, 6 + i * 15));
    this.drawBackground();
  }
}
