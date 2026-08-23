import { Assets, Container, Graphics, Sprite } from 'pixi.js';

export type NpcRole =
  | 'steward'
  | 'smith'
  | 'cleric'
  | 'ranger'
  | 'arcanist'
  | 'resident'
  | 'worker'
  | 'guard'
  | 'child'
  | 'elder'
  | 'traveler';

const DEBUG = new URLSearchParams(location.search).get('storydebug') === '1';

export async function loadOptionalSprite(
  assetPath: string,
  configure: (sprite: Sprite) => void,
  fallback: () => Container,
): Promise<Container> {
  const url = new URL(assetPath, document.baseURI).href;
  try {
    await Assets.load(url);
    const sprite = Sprite.from(url);
    configure(sprite);
    return sprite;
  } catch (error) {
    if (DEBUG) console.warn(`[World] Optional asset failed: ${url}`, error);
    return fallback();
  }
}

export function createNpcSilhouette(role: NpcRole): Container {
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 10, 29, 9).fill({ color: 0x11100f, alpha: 0.34 });
  const body = new Graphics();
  const accent = new Graphics();

  if (role === 'steward') {
    body
      .moveTo(-24, 3).lineTo(-17, -64).lineTo(0, -83).lineTo(19, -62).lineTo(27, 4).closePath()
      .fill(0x3f4658).stroke({ color: 0x20232d, width: 3 })
      .circle(0, -82, 15).fill(0xc59a78).stroke({ color: 0x4e3328, width: 2 })
      .moveTo(-12, -89).lineTo(0, -105).lineTo(14, -88).lineTo(10, -70).lineTo(-10, -70).closePath()
      .fill(0x2c303d);
    accent.moveTo(-16, -48).lineTo(16, -48).stroke({ color: 0xb38a4f, width: 5 }).circle(0, -47, 4).fill(0xe0bf74);
  } else if (role === 'smith') {
    body
      .moveTo(-30, 5).lineTo(-24, -57).lineTo(-8, -72).lineTo(18, -64).lineTo(31, 4).closePath()
      .fill(0x5b3527).stroke({ color: 0x281b17, width: 3 })
      .circle(0, -78, 16).fill(0xb77d5e).stroke({ color: 0x4a2e24, width: 2 })
      .moveTo(-15, -75).lineTo(0, -56).lineTo(16, -76).lineTo(13, -45).lineTo(-9, -45).closePath()
      .fill(0x3b2721);
    accent
      .moveTo(-24, -48).lineTo(-39, -15).stroke({ color: 0x9a6b48, width: 8 })
      .roundRect(-48, -21, 22, 14, 3).fill(0x858386).stroke({ color: 0x343437, width: 2 });
  } else if (role === 'cleric') {
    body
      .moveTo(-28, 7).lineTo(-20, -58).lineTo(0, -91).lineTo(22, -58).lineTo(30, 7).closePath()
      .fill(0x685c62).stroke({ color: 0x302a31, width: 3 })
      .circle(0, -76, 14).fill(0xc99d7c)
      .moveTo(-20, -79).quadraticCurveTo(0, -112, 21, -78).lineTo(14, -57).lineTo(-14, -57).closePath()
      .fill(0x443d48);
    accent.moveTo(0, -55).lineTo(0, -34).moveTo(-10, -44).lineTo(10, -44).stroke({ color: 0xe4c679, width: 4 });
  } else if (role === 'ranger') {
    body
      .moveTo(-26, 6).lineTo(-18, -61).lineTo(0, -89).lineTo(22, -59).lineTo(28, 6).closePath()
      .fill(0x35483e).stroke({ color: 0x1e2a23, width: 3 })
      .circle(0, -75, 14).fill(0xb88768)
      .moveTo(-19, -79).lineTo(0, -103).lineTo(20, -78).lineTo(12, -57).lineTo(-12, -57).closePath()
      .fill(0x283a31);
    accent
      .moveTo(31, -85).bezierCurveTo(51, -68, 50, -26, 28, -8).stroke({ color: 0xa78355, width: 5 })
      .moveTo(31, -84).lineTo(29, -8).stroke({ color: 0xd9c7a1, width: 1 });
  } else if (role === 'arcanist') {
    body
      .moveTo(-29, 6).lineTo(-18, -58).lineTo(0, -94).lineTo(22, -57).lineTo(31, 6).closePath()
      .fill(0x35384f).stroke({ color: 0x202235, width: 3 })
      .circle(0, -75, 14).fill(0xb98b6c)
      .moveTo(-20, -80).lineTo(0, -106).lineTo(21, -80).lineTo(12, -57).lineTo(-12, -57).closePath()
      .fill(0x292c43);
    accent
      .moveTo(-31, 2).lineTo(-37, -87).stroke({ color: 0x775a43, width: 6 })
      .circle(-37, -93, 9).fill({ color: 0x7dd3df, alpha: 0.82 })
      .circle(-37, -93, 17).stroke({ color: 0x8c7be1, width: 2, alpha: 0.42 });
  } else {
    const palettes: Record<Exclude<NpcRole, 'steward' | 'smith' | 'cleric' | 'ranger' | 'arcanist'>, [number, number, number]> = {
      resident: [0x4e4a43, 0x34312e, 0xc29673],
      worker: [0x594333, 0x33291f, 0xb9805f],
      guard: [0x3f4852, 0x272d34, 0xb98767],
      child: [0x5a4f48, 0x39312e, 0xc89c7b],
      elder: [0x554f53, 0x39353b, 0xb98e74],
      traveler: [0x3f4b47, 0x2b3431, 0xb77f61],
    };
    const [cloth, dark, skin] = palettes[role];
    const childScale = role === 'child' ? 0.72 : 1;
    body
      .moveTo(-25, 6).lineTo(-19, -57).lineTo(0, -81).lineTo(20, -57).lineTo(27, 6).closePath()
      .fill(cloth).stroke({ color: dark, width: 3 })
      .circle(0, -76, 14).fill(skin).stroke({ color: 0x4b3329, width: 2 })
      .moveTo(-15, -82).quadraticCurveTo(0, -94, 16, -81).lineTo(12, -68).lineTo(-12, -68).closePath()
      .fill(dark);

    if (role === 'worker') {
      accent.moveTo(-27, -47).lineTo(25, -47).stroke({ color: 0x8a6745, width: 6 });
    } else if (role === 'guard') {
      accent
        .moveTo(-22, -54).lineTo(22, -54).stroke({ color: 0x76808a, width: 6 })
        .moveTo(27, 4).lineTo(27, -83).stroke({ color: 0x6a543d, width: 5 })
        .moveTo(27, -83).lineTo(20, -67).lineTo(34, -67).closePath().fill(0x9a9da1);
    } else if (role === 'elder') {
      accent
        .moveTo(20, -28).lineTo(31, 7).stroke({ color: 0x775c42, width: 5 })
        .moveTo(-9, -64).quadraticCurveTo(0, -48, 10, -64).stroke({ color: 0xd0c2ad, width: 5 });
    } else if (role === 'traveler') {
      accent
        .moveTo(-24, -38).lineTo(20, -38).stroke({ color: 0x7d674d, width: 5 })
        .roundRect(15, -34, 20, 28, 5).fill(0x4f3e2e).stroke({ color: 0x2f251d, width: 2 });
    } else if (role === 'resident') {
      accent.roundRect(-17, -43, 34, 9, 4).fill(0x75624d);
    }
    root.scale.set(childScale);
  }

  root.addChild(shadow, body, accent);
  return root;
}

export function createTree(scale = 1): Container {
  const root = new Container();
  const g = new Graphics();
  g.roundRect(-9, -32, 18, 43, 5).fill(0x403426);
  g.circle(-14, -54, 29).fill(0x354734);
  g.circle(14, -58, 32).fill(0x40513b);
  g.circle(0, -83, 35).fill(0x2e4232);
  g.circle(8, -76, 18).fill({ color: 0x71805b, alpha: 0.22 });
  root.addChild(g);
  root.scale.set(scale);
  return root;
}

export function createLantern(): Container {
  const root = new Container();
  const glow = new Graphics().circle(0, -38, 27).fill({ color: 0xf2a54e, alpha: 0.09 });
  glow.blendMode = 'add';
  const lamp = new Graphics()
    .rect(-3, -42, 6, 52).fill(0x34302a)
    .roundRect(-9, -55, 18, 22, 3).fill(0x6b4a2f).stroke({ color: 0x2a211c, width: 2 })
    .roundRect(-5, -51, 10, 13, 2).fill({ color: 0xffca72, alpha: 0.82 });
  root.addChild(glow, lamp);
  return root;
}
