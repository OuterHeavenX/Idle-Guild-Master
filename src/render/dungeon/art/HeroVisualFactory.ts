import { Container, Graphics, Sprite } from 'pixi.js';

export type HeroVisual = {
  root: Container;
  sprite: Sprite;
  accent: Graphics;
  job: string;
};

const assetFor = (job: string): string => {
  const safe = ['guardian', 'cleric', 'ranger', 'arcanist'].includes(job) ? job : 'guardian';
  return `assets/dungeon/ashen-crypt/heroes/${safe}.svg`;
};

export const createHeroVisual = (job: string): HeroVisual => {
  const root = new Container();
  const shadowW = job === 'guardian' ? 26 : 23;
  const shadow = new Graphics()
    .ellipse(0, 8, shadowW, 5.5)
    .fill({ color: 0x000000, alpha: 0.31 })
    .ellipse(-3, 7, shadowW * 0.66, 3.2)
    .fill({ color: 0x0b0c12, alpha: 0.22 });
  const sprite = Sprite.from(assetFor(job));
  sprite.anchor.set(0.5, 0.9);
  sprite.width = job === 'guardian' ? 70 : job === 'ranger' ? 65 : 64;
  sprite.height = job === 'guardian' ? 93 : 88;
  sprite.y = 5;
  const accent = new Graphics();
  root.addChild(shadow, sprite, accent);
  return { root, sprite, accent, job };
};
