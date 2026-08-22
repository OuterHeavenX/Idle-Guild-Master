import { Container, Graphics, Sprite } from 'pixi.js';

export type EnemyVisual = { root: Container; sprite: Sprite; aura: Graphics };

export const createCryptGhoulVisual = (): EnemyVisual => {
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 10, 38, 9).fill({ color: 0x000000, alpha: 0.5 });
  const aura = new Graphics();
  const sprite = Sprite.from(`${import.meta.env.BASE_URL}assets/dungeon/ashen-crypt/enemies/crypt-ghoul.svg`);
  sprite.anchor.set(0.5, 0.9);
  sprite.width = 92;
  sprite.height = 116;
  sprite.y = 7;
  root.addChild(shadow, aura, sprite);
  return { root, sprite, aura };
};
