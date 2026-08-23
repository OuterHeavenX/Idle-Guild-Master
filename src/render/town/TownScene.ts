import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import {
  type InteractionTarget,
  type RectCollider,
  type WorldPosition,
  WalkableWorldScene,
} from '../world/WalkableScene';
import {
  createLantern,
  createNpcSilhouette,
  createTree,
  loadOptionalSprite,
} from '../world/WorldArt';

/** Backward-compatible name used by the current PixiRenderer while it is integrated. */
export type TownTarget = InteractionTarget;
export type { InteractionTarget } from '../world/WalkableScene';

const GUILD_HALL_ASSET = 'assets/town/buildings/guild-hall.svg';
const BLACKSMITH_ASSET = 'assets/town/buildings/blacksmith.svg';

const TOWN_TARGETS: readonly InteractionTarget[] = [
  { id: 'guildHallDoor', label: 'ENTER', x: 248, y: 414, radius: 104, priority: 1 },
  { id: 'blacksmithDoor', label: 'ENTER', x: 775, y: 682, radius: 104, priority: 1 },
  { id: 'party', label: 'TALK', x: 270, y: 806, radius: 126, priority: 2 },
  { id: 'board', label: 'READ', x: 365, y: 620, radius: 90, priority: 3 },
  { id: 'crypt', label: 'ENTER', x: 500, y: 148, radius: 108, priority: 1 },
];

const TOWN_COLLIDERS: readonly RectCollider[] = [
  // Authored buildings.
  { x: 72, y: 150, width: 350, height: 230 },
  { x: 616, y: 405, width: 310, height: 244 },
  // Notice board and fountain.
  { x: 326, y: 510, width: 78, height: 82 },
  { x: 408, y: 750, width: 184, height: 198 },
  // Cemetery wall with an open central gate.
  { x: 48, y: 54, width: 354, height: 54 },
  { x: 598, y: 54, width: 354, height: 54 },
  // Dense edge vegetation and non-enterable silhouettes.
  { x: 48, y: 1050, width: 128, height: 330 },
  { x: 824, y: 1010, width: 128, height: 370 },
  { x: 55, y: 470, width: 104, height: 250 },
  { x: 850, y: 725, width: 102, height: 230 },
];

const SPAWNS: Readonly<Record<string, WorldPosition>> = {
  default: { x: 0.5, y: 0.86 },
  'town:start': { x: 0.5, y: 0.86 },
  guildHallExit: { x: 0.248, y: 0.303 },
  'town:guildHallExit': { x: 0.248, y: 0.303 },
  blacksmithExit: { x: 0.775, y: 0.474 },
  'town:blacksmithExit': { x: 0.775, y: 0.474 },
  cryptExit: { x: 0.5, y: 0.132 },
  'town:cryptExit': { x: 0.5, y: 0.132 },
};

export class TownScene extends WalkableWorldScene {
  protected readonly colliders = TOWN_COLLIDERS;
  protected readonly targets = TOWN_TARGETS;
  protected readonly spawnPoints = SPAWNS;
  protected readonly defaultSpawn = SPAWNS.default!;

  private readonly guildGlow = new Graphics();
  private readonly forgeGlow = new Graphics();
  private hallStatus: 'REQUESTED' | 'LOADED' | 'FALLBACK' = 'REQUESTED';
  private hallUrl = new URL(GUILD_HALL_ASSET, document.baseURI).href;
  private elapsed = 0;

  constructor(state: StateManager) {
    super(state, 'town');
    this.drawGround();
    this.drawCemeteryApproach();
    this.drawNoticeBoard();
    this.drawFountainAndPlaza();
    this.drawTownEdges();
    this.drawParty();
    this.drawLight();
    this.finishScene();
    void this.loadBuildings();
  }

  override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    if (!this.visible) return;
    this.elapsed += Math.max(0, deltaSeconds);
    this.guildGlow.alpha = 0.72 + Math.sin(this.elapsed * 2.15) * 0.12;
    this.forgeGlow.alpha = 0.76 + Math.sin(this.elapsed * 3.8 + 0.8) * 0.14;
  }

  private drawGround(): void {
    const ground = new Graphics();
    ground.rect(0, 0, 1000, 1500).fill(0x536047);

    // Weathered roads: a central north/south route with compact building branches.
    ground
      .roundRect(408, 90, 184, 1370, 72).fill(0x89785c)
      .roundRect(180, 350, 420, 122, 46).fill(0x837257)
      .roundRect(390, 586, 405, 126, 48).fill(0x89765a)
      .roundRect(245, 720, 510, 350, 132).fill(0x8e8067)
      .roundRect(350, 1020, 300, 390, 78).fill(0x837158);

    const stones: Array<[number, number, number, number]> = [
      [460, 118, 82, 25], [438, 176, 58, 21], [510, 214, 62, 23],
      [236, 393, 70, 22], [322, 408, 74, 20], [446, 472, 76, 24],
      [627, 628, 72, 21], [527, 1102, 68, 22], [425, 1228, 75, 20],
      [514, 1341, 66, 22],
    ];
    for (const [x, y, width, height] of stones) {
      ground.roundRect(x, y, width, height, 8).fill({ color: 0x665f52, alpha: 0.74 });
    }
    for (const [x, y, radius] of [
      [194, 462, 10], [305, 342, 8], [602, 539, 9], [706, 720, 12],
      [374, 1034, 9], [652, 1175, 8], [335, 1320, 11],
    ] as Array<[number, number, number]>) {
      ground.circle(x, y, radius).fill(0x41543d);
    }
    this.backgroundLayer.addChild(ground);
  }

  private drawCemeteryApproach(): void {
    const cemetery = new Graphics();
    cemetery
      .rect(48, 54, 354, 54).fill(0x3d3d39).stroke({ color: 0x222421, width: 4 })
      .rect(598, 54, 354, 54).fill(0x3d3d39).stroke({ color: 0x222421, width: 4 })
      .rect(395, 36, 18, 105).fill(0x272a28)
      .rect(587, 36, 18, 105).fill(0x272a28)
      .moveTo(413, 58).lineTo(492, 88).lineTo(492, 143).stroke({ color: 0x202322, width: 7 })
      .moveTo(587, 58).lineTo(508, 88).lineTo(508, 143).stroke({ color: 0x202322, width: 7 });

    for (const [x, y, width, height] of [
      [646, 132, 42, 68], [718, 158, 34, 56], [790, 120, 44, 74], [865, 171, 32, 52],
    ] as Array<[number, number, number, number]>) {
      cemetery
        .roundRect(x, y, width, height, 12).fill(0x55544f).stroke({ color: 0x343632, width: 3 })
        .rect(x - 7, y + height - 5, width + 14, 10).fill(0x42443f);
    }
    cemetery
      .ellipse(500, 149, 96, 30).fill({ color: 0xb7c0b4, alpha: 0.055 })
      .ellipse(525, 190, 135, 24).fill({ color: 0xc5c7bf, alpha: 0.035 });
    this.worldLayer.addChild(cemetery);
  }

  private drawNoticeBoard(): void {
    const board = new Graphics();
    board
      .rect(333, 525, 64, 59).fill(0x493523).stroke({ color: 0x241a13, width: 5 })
      .rect(322, 511, 86, 17).fill(0x34251a)
      .rect(337, 584, 9, 50).fill(0x34271d)
      .rect(386, 584, 9, 50).fill(0x34271d)
      .roundRect(341, 536, 23, 31, 2).fill(0xd0bb88)
      .roundRect(369, 533, 20, 35, 2).fill(0xbca779)
      .circle(354, 539, 2).fill(0x8f3932)
      .circle(381, 536, 2).fill(0x8f3932);
    this.worldLayer.addChild(board);
  }

  private drawFountainAndPlaza(): void {
    const plaza = new Graphics();
    plaza.ellipse(500, 850, 235, 188).fill({ color: 0x706a5d, alpha: 0.64 });
    for (let ring = 0; ring < 3; ring += 1) {
      plaza.ellipse(500, 850, 205 - ring * 26, 158 - ring * 22)
        .stroke({ color: 0x9b927d, width: 4, alpha: 0.38 });
    }
    plaza
      .ellipse(500, 876, 92, 72).fill(0x4b4e4a).stroke({ color: 0x2d312f, width: 6 })
      .ellipse(500, 866, 78, 55).fill(0x315565)
      .ellipse(500, 858, 70, 43).fill({ color: 0x6ca1aa, alpha: 0.56 })
      .rect(478, 784, 44, 77).fill(0x5c5d56).stroke({ color: 0x393b38, width: 4 })
      .ellipse(500, 789, 34, 17).fill(0x686963)
      .circle(500, 775, 9).fill({ color: 0xa9d9dc, alpha: 0.65 })
      .moveTo(500, 777).bezierCurveTo(472, 806, 468, 833, 458, 851)
      .moveTo(500, 777).bezierCurveTo(528, 806, 532, 833, 542, 851)
      .stroke({ color: 0x8fc8ce, width: 5, alpha: 0.62 });
    this.worldLayer.addChild(plaza);
  }

  private drawTownEdges(): void {
    const facades = new Graphics();
    facades
      .roundRect(32, 1035, 144, 352, 14).fill(0x3c352b).stroke({ color: 0x27231e, width: 5 })
      .moveTo(20, 1060).lineTo(104, 970).lineTo(190, 1060).closePath().fill(0x2b2825)
      .roundRect(824, 1000, 144, 390, 14).fill(0x40362b).stroke({ color: 0x29231d, width: 5 })
      .moveTo(808, 1026).lineTo(892, 930).lineTo(982, 1026).closePath().fill(0x2c2824);
    this.worldLayer.addChild(facades);

    const treePositions: Array<[number, number, number]> = [
      [70, 440, 1.15], [116, 760, 1], [72, 980, 1.2], [930, 350, 1.08],
      [934, 725, 1.16], [890, 930, 0.94], [235, 1385, 1.2], [760, 1390, 1.18],
    ];
    for (const [x, y, scale] of treePositions) {
      const tree = createTree(scale);
      this.positionActor(tree, x, y);
    }

    const props = new Graphics();
    props
      .roundRect(612, 690, 32, 36, 6).fill(0x57402c).stroke({ color: 0x2e2219, width: 3 })
      .roundRect(652, 704, 28, 32, 6).fill(0x4e3828).stroke({ color: 0x2e2219, width: 3 })
      .ellipse(622, 724, 22, 7).stroke({ color: 0x8c7050, width: 3 })
      .moveTo(180, 1110).lineTo(320, 1110).stroke({ color: 0x4a3828, width: 12 })
      .moveTo(195, 1085).lineTo(195, 1140).moveTo(302, 1085).lineTo(302, 1140)
      .stroke({ color: 0x35281e, width: 8 });
    this.worldLayer.addChild(props);
  }

  private drawParty(): void {
    this.positionActor(createNpcSilhouette('cleric'), 215, 795);
    this.positionActor(createNpcSilhouette('ranger'), 278, 816);
    this.positionActor(createNpcSilhouette('arcanist'), 337, 790);
  }

  private drawLight(): void {
    this.guildGlow.ellipse(248, 377, 106, 38).fill({ color: 0xd98b42, alpha: 0.09 });
    this.guildGlow.blendMode = 'add';
    this.forgeGlow.ellipse(770, 625, 84, 44).fill({ color: 0xff7a32, alpha: 0.12 });
    this.forgeGlow.blendMode = 'add';
    this.worldLayer.addChild(this.guildGlow, this.forgeGlow);

    for (const [x, y] of [[437, 470], [596, 675], [382, 1075], [618, 1190]] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }
  }

  private async loadBuildings(): Promise<void> {
    await Promise.all([this.loadGuildHall(), this.loadBlacksmith()]);
  }

  private async loadGuildHall(): Promise<void> {
    const url = new URL(GUILD_HALL_ASSET, document.baseURI).href;
    this.reportHall('REQUESTED', url);
    try {
      await Assets.load(url);
      const hall = Sprite.from(url);
      hall.position.set(45, 82);
      hall.width = 396;
      hall.height = 332;
      this.worldLayer.addChild(hall);
      this.reportHall('LOADED', url);
    } catch (error) {
      this.worldLayer.addChild(this.createGuildHallFallback());
      this.reportHall('FALLBACK', url, error);
    }
  }

  private async loadBlacksmith(): Promise<void> {
    const smithy = await loadOptionalSprite(
      BLACKSMITH_ASSET,
      (sprite) => {
        sprite.position.set(590, 350);
        sprite.width = 365;
        sprite.height = 330;
      },
      () => this.createBlacksmithFallback(),
    );
    this.worldLayer.addChild(smithy);
  }

  private createGuildHallFallback(): Container {
    return new Graphics()
      .roundRect(72, 190, 350, 190, 12).fill(0x493e33).stroke({ color: 0x74614c, width: 6 })
      .moveTo(52, 210).lineTo(248, 92).lineTo(442, 210).closePath().fill(0x292527)
      .roundRect(214, 292, 72, 88, 8).fill(0x261b16).stroke({ color: 0x8a603d, width: 5 })
      .circle(248, 210, 31).fill(0x30353a).stroke({ color: 0xc09755, width: 5 })
      .moveTo(248, 186).lineTo(248, 235).moveTo(226, 210).lineTo(270, 210)
      .stroke({ color: 0xc09755, width: 5 });
  }

  private createBlacksmithFallback(): Container {
    return new Graphics()
      .roundRect(616, 435, 310, 214, 10).fill(0x49382c).stroke({ color: 0x725640, width: 6 })
      .moveTo(594, 465).lineTo(760, 350).lineTo(950, 465).closePath().fill(0x292526)
      .rect(852, 338, 46, 118).fill(0x504941).stroke({ color: 0x2c2926, width: 5 })
      .roundRect(742, 557, 70, 92, 7).fill(0x211814).stroke({ color: 0x8a5c38, width: 5 })
      .roundRect(630, 515, 78, 62, 7).fill({ color: 0xf08b43, alpha: 0.56 })
      .moveTo(651, 575).lineTo(690, 575).lineTo(681, 595).lineTo(642, 595).closePath().fill(0x303033);
  }

  private reportHall(status: 'REQUESTED' | 'LOADED' | 'FALLBACK', url: string, error?: unknown): void {
    this.hallStatus = status;
    this.hallUrl = url;
    const publish = () => window.dispatchEvent(new CustomEvent('town:guild-hall-status', {
      detail: { status: this.hallStatus, url: this.hallUrl },
    }));
    publish();
    // ViewManager is mounted immediately after Pixi initialization. Re-publishing on
    // the next task prevents a warm browser cache from making the debug status race it.
    window.setTimeout(publish, 0);
    if (!this.isStoryDebug()) return;
    console.info(`[Town] Guild Hall asset ${status.toLowerCase()}: ${url}`);
    if (error) console.error('[Town] Guild Hall asset error:', error);
  }
}
