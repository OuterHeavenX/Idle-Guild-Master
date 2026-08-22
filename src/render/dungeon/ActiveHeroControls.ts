import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export class ActiveHeroControls extends Container {
  private plate = new Graphics();
  private hint = new Text({
    text: 'DRAG ALDRIC TO MOVE',
    style: new TextStyle({ fontFamily: 'system-ui', fontSize: 8, fontWeight: '800', fill: 0xd8e8ef, letterSpacing: 0.45 }),
  });

  constructor() {
    super();
    this.hint.anchor.set(0.5);
    this.addChild(this.plate, this.hint);
  }

  layout(width: number, height: number): void {
    this.position.set(width - 79, height - 105);
    this.plate.clear()
      .roundRect(-69, -13, 138, 26, 9)
      .fill({ color: 0x121820, alpha: 0.72 })
      .stroke({ color: 0x8fb8ca, width: 1, alpha: 0.55 });
    this.hint.position.set(0, 0);
  }
}
