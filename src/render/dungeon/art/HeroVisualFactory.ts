import { Container, Graphics, Sprite } from 'pixi.js';

export type HeroVisual = {
  root: Container;
  sprite: Sprite;
  accent: Graphics;
  job: string;
};

const assetFor = (job: string): string => {
  const safe = ['guardian', 'cleric', 'ranger', 'arcanist'].includes(job) ? job : 'guardian';
  return `${import.meta.env.BASE_URL}assets/dungeon/ashen-crypt/heroes/${safe}.svg`;
};

export const createHeroVisual = (job: string): HeroVisual => {
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 7, 27, 7).fill({ color: 0x000000, alpha: 0.42 });
  const sprite = Sprite.from(assetFor(job));
  sprite.anchor.set(0.5, 0.9);
  sprite.width = job === 'guardian' ? 69 : 64;
  sprite.height = job === 'guardian' ? 92 : 88;
  sprite.y = 5;
  const accent = new Graphics();
  root.addChild(shadow, sprite, accent);
  return { root, sprite, accent, job };
};
