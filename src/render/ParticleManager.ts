import { Container, Text, TextStyle } from 'pixi.js';

export class ParticleManager {
  readonly container = new Container();
  private floaters: Array<{ node: Text; life: number }> = [];

  spawnDamage(x: number, y: number, amount: number, crit = false): void {
    const node = new Text({
      text: crit ? `CRIT ${amount}` : `${amount}`,
      style: new TextStyle({
        fill: crit ? 0xffd36a : 0xffffff,
        fontSize: crit ? 24 : 18,
        fontWeight: '700',
        stroke: { color: 0x000000, width: 4 }
      })
    });
    node.anchor.set(0.5);
    node.position.set(x, y);
    this.container.addChild(node);
    this.floaters.push({ node, life: 1 });
  }

  update(deltaSeconds: number): void {
    for (const floater of this.floaters) {
      floater.life -= deltaSeconds;
      floater.node.y -= 40 * deltaSeconds;
      floater.node.alpha = Math.max(0, floater.life);
    }
    this.floaters = this.floaters.filter((floater) => {
      if (floater.life > 0) return true;
      floater.node.destroy();
      return false;
    });
  }
}
