import { Container, Graphics, Sprite } from 'pixi.js';

export type EnemyVisual = { root: Container; sprite: Sprite; aura: Graphics };

export const createCryptGhoulVisual = (): EnemyVisual => {
  const root = new Container();
  const shadow = new Graphics()
    .ellipse(0, 11, 37, 6.5).fill({ color: 0x000000, alpha: 0.34 })
    .ellipse(-3, 10, 27, 4).fill({ color: 0x171320, alpha: 0.2 });
  const aura = new Graphics();
  const sprite = Sprite.from('assets/dungeon/ashen-crypt/enemies/crypt-ghoul.svg');
  sprite.anchor.set(0.5, 0.9);
  sprite.width = 101;
  sprite.height = 127;
  sprite.y = 7;
  root.addChild(shadow, aura, sprite);
  return { root, sprite, aura };
};
