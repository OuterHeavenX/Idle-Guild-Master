import { Container, Graphics, Sprite } from 'pixi.js';

export class EnvironmentRenderer {
  readonly container = new Container();
  readonly ambient = new Container();
  private backdrop = Sprite.from('assets/dungeon/ashen-crypt/environment/crypt-stage.svg');
  private ruins = new Graphics();
  private torchLight = new Graphics();
  private fog = new Graphics();
  private ash = new Graphics();
  private time = 0;
  private sceneWidth = 1;
  private sceneHeight = 1;

  constructor() {
    this.container.addChild(this.backdrop, this.ruins, this.torchLight);
    this.ambient.addChild(this.fog, this.ash);
  }

  resize(width: number, height: number): void {
    this.sceneWidth = width;
    this.sceneHeight = height;
    this.backdrop.position.set(0, 0);
    this.backdrop.width = width;
    this.backdrop.height = height;
    this.drawRuins();
    this.drawAtmosphere();
    this.drawTorchLight();
  }

  update(dt: number): void {
    this.time += dt;
    this.fog.x = Math.sin(this.time * 0.12) * 12;
    this.fog.y = Math.sin(this.time * 0.17) * 3;
    this.ash.x = Math.sin(this.time * 0.08) * 5;
    this.ash.y = (this.time * -2.5) % 18;
    this.drawTorchLight();
  }

  private drawRuins(): void {
    const w = this.sceneWidth;
    const h = this.sceneHeight;
    this.ruins.clear();
    this.ruins
      .moveTo(w * 0.11, h * 0.23).lineTo(w * 0.145, h * 0.255).lineTo(w * 0.125, h * 0.29)
      .stroke({ color: 0x151722, width: 2, alpha: 0.58 })
      .moveTo(w * 0.83, h * 0.18).lineTo(w * 0.80, h * 0.22).lineTo(w * 0.845, h * 0.245)
      .stroke({ color: 0x11131c, width: 3, alpha: 0.7 })
      .rect(w * 0.79, h * 0.50, w * 0.055, h * 0.018).fill({ color: 0x24232d, alpha: 0.75 })
      .rect(w * 0.855, h * 0.515, w * 0.035, h * 0.013).fill({ color: 0x1b1b24, alpha: 0.7 })
      .rect(w * 0.07, h * 0.66, w * 0.045, h * 0.014).fill({ color: 0x24232b, alpha: 0.62 })
      .moveTo(w * 0.73, h * 0.59).lineTo(w * 0.70, h * 0.62).lineTo(w * 0.735, h * 0.65)
      .stroke({ color: 0x0c0d12, width: 2, alpha: 0.58 });
  }

  private drawTorchLight(): void {
    const w = this.sceneWidth;
    const h = this.sceneHeight;
    const flickerA = 0.035 + (Math.sin(this.time * 7.3) + Math.sin(this.time * 11.1)) * 0.004;
    const flickerB = 0.032 + (Math.sin(this.time * 8.7 + 1.8) + Math.sin(this.time * 12.4)) * 0.004;
    this.torchLight.clear()
      .circle(w * 0.205, h * 0.32, Math.max(26, w * 0.13)).fill({ color: 0xff9a4c, alpha: flickerA })
      .circle(w * 0.795, h * 0.32, Math.max(26, w * 0.13)).fill({ color: 0xff9a4c, alpha: flickerB });
  }

  private drawAtmosphere(): void {
    const w = this.sceneWidth;
    const h = this.sceneHeight;
    this.fog.clear();
    for (let i = 0; i < 6; i++) {
      const x = w * (0.04 + i * 0.19);
      const y = h * (0.60 + (i % 3) * 0.07);
      this.fog.ellipse(x, y, w * 0.19, h * 0.021).fill({ color: 0x9c9bc0, alpha: 0.03 });
    }
    this.ash.clear();
    for (let i = 0; i < 20; i++) {
      const x = ((i * 83) % 997) / 997 * w;
      const y = ((i * 137) % 991) / 991 * h;
      const warm = i % 6 === 0;
      this.ash.circle(x, y, 0.6 + (i % 3) * 0.35).fill({ color: warm ? 0xf2a65b : 0xb7b5c8, alpha: warm ? 0.22 : 0.13 });
    }
  }
}
