import { Container, Graphics, Sprite } from 'pixi.js';

export class EnvironmentRenderer {
  readonly container = new Container();
  readonly ambient = new Container();
  private backdrop = Sprite.from(`${import.meta.env.BASE_URL}assets/dungeon/ashen-crypt/environment/crypt-stage.svg`);
  private fog = new Graphics();
  private ash = new Graphics();
  private time = 0;
  private width = 1;
  private height = 1;

  constructor() {
    this.container.addChild(this.backdrop);
    this.ambient.addChild(this.fog, this.ash);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.backdrop.position.set(0, 0);
    this.backdrop.width = width;
    this.backdrop.height = height;
    this.drawAtmosphere();
  }

  update(dt: number): void {
    this.time += dt;
    this.fog.x = Math.sin(this.time * 0.12) * 12;
    this.fog.y = Math.sin(this.time * 0.17) * 3;
    this.ash.x = Math.sin(this.time * 0.08) * 5;
    this.ash.y = (this.time * -2.5) % 18;
  }

  private drawAtmosphere(): void {
    const w = this.width;
    const h = this.height;
    this.fog.clear();
    for (let i = 0; i < 6; i++) {
      const x = w * (0.04 + i * 0.19);
      const y = h * (0.58 + (i % 3) * 0.075);
      this.fog.ellipse(x, y, w * 0.2, h * 0.025).fill({ color: 0x9c9bc0, alpha: 0.035 });
    }
    this.ash.clear();
    for (let i = 0; i < 22; i++) {
      const x = ((i * 83) % 997) / 997 * w;
      const y = ((i * 137) % 991) / 991 * h;
      const warm = i % 6 === 0;
      this.ash.circle(x, y, 0.6 + (i % 3) * 0.35).fill({ color: warm ? 0xf2a65b : 0xb7b5c8, alpha: warm ? 0.24 : 0.15 });
    }
  }
}
