import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
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
  type NpcRole,
} from '../world/WorldArt';

/** Backward-compatible name used by the current PixiRenderer while it is integrated. */
export type TownTarget = InteractionTarget;
export type { InteractionTarget } from '../world/WalkableScene';

const GUILD_HALL_ASSET = 'assets/town/buildings/guild-hall.svg';
const BLACKSMITH_ASSET = 'assets/town/buildings/blacksmith.svg';
const TOWN_WIDTH = 2400;
const TOWN_HEIGHT = 2600;

const TOWN_TARGETS: readonly InteractionTarget[] = [
  { id: 'guildHallDoor', label: 'ENTER', x: 595, y: 718, radius: 110, priority: 1 },
  { id: 'blacksmithDoor', label: 'ENTER', x: 1860, y: 1183, radius: 110, priority: 1 },
  { id: 'party', label: 'TALK', x: 648, y: 1397, radius: 132, priority: 2 },
  { id: 'board', label: 'READ', x: 876, y: 1075, radius: 92, priority: 3 },
  { id: 'crypt', label: 'ENTER', x: 1200, y: 257, radius: 116, priority: 1 },
];

const HOUSE_RECTS: readonly RectCollider[] = [
  // Residential Ward — broad south and west neighborhoods with generous traversal lanes.
  { x: 120, y: 1660, width: 260, height: 180 },
  { x: 455, y: 1715, width: 245, height: 170 },
  { x: 120, y: 1940, width: 300, height: 190 },
  { x: 500, y: 2010, width: 250, height: 180 },
  { x: 120, y: 2240, width: 255, height: 205 },
  { x: 450, y: 2300, width: 285, height: 195 },
  { x: 835, y: 1785, width: 250, height: 175 },
  { x: 870, y: 2110, width: 245, height: 190 },
  { x: 1180, y: 1885, width: 260, height: 185 },
  { x: 1185, y: 2190, width: 270, height: 190 },

  // Market / Workers' Row — east side structures leave a central cart lane.
  { x: 1530, y: 1450, width: 210, height: 160 },
  { x: 2010, y: 1450, width: 240, height: 170 },
  { x: 1520, y: 1760, width: 230, height: 165 },
  { x: 2015, y: 1760, width: 250, height: 170 },

  // Lowtown — tighter, patched buildings but still no player-trapping alleys.
  { x: 1570, y: 2085, width: 240, height: 175 },
  { x: 1900, y: 2050, width: 285, height: 190 },
  { x: 1590, y: 2360, width: 270, height: 180 },
  { x: 1970, y: 2330, width: 255, height: 185 },

  // Old Ward stone structures.
  { x: 175, y: 300, width: 300, height: 210 },
  { x: 1810, y: 300, width: 310, height: 220 },
  { x: 235, y: 650, width: 250, height: 185 },
  { x: 1920, y: 640, width: 260, height: 190 },
];

const TOWN_COLLIDERS: readonly RectCollider[] = [
  // Authored Guild Hall and Blacksmith.
  { x: 419, y: 454, width: 420, height: 238 },
  { x: 1690, y: 900, width: 340, height: 245 },
  // Notice board and fountain.
  { x: 837, y: 978, width: 80, height: 88 },
  { x: 1100, y: 1325, width: 200, height: 205 },
  // Old Ward cemetery wall with an open gate into the Crypt road.
  { x: 70, y: 92, width: 950, height: 58 },
  { x: 1380, y: 92, width: 950, height: 58 },
  ...HOUSE_RECTS,
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

const PUDDLES: ReadonlyArray<readonly [number, number, number, number]> = [
  [1160, 360, 82, 24], [1060, 520, 62, 20], [1320, 610, 86, 25],
  [940, 820, 74, 22], [1220, 930, 92, 27], [1460, 1050, 64, 21],
  [1010, 1130, 75, 22], [1360, 1240, 90, 27], [970, 1570, 84, 25],
  [1250, 1660, 68, 21], [760, 1830, 78, 24], [1110, 1935, 90, 26],
  [600, 2160, 88, 27], [1020, 2310, 72, 22], [1325, 2400, 95, 28],
  [1680, 1640, 72, 23], [1850, 1870, 92, 28], [2050, 1970, 70, 23],
  [1740, 2260, 104, 31], [2090, 2460, 92, 27], [310, 1870, 76, 24],
  [325, 2180, 96, 28], [510, 2480, 83, 25], [2110, 770, 70, 22],
];

const AMBIENT_DIALOGUE = [
  'Think it’ll stop today?',
  'You said that yesterday.',
  'Roof’s leaking again.',
  'You fixed it yesterday. That’s the problem.',
  'Market’s flooded.',
  'It floods every week. Still annoying.',
  'My grandfather said the sky used to be blue.',
  'Your grandfather sold onions.',
  'Mom says the sun is yellow.',
  'That sounds made up.',
  'If it stops raining, I’m taking the day off.',
  'Forty-two years.',
  'Thirty-seven.',
  'Does either answer make you feel better?',
  'It ain’t weather.',
  'Here we go.',
  'You hear thunder?',
  'I hear thunder every day.',
  'That wasn’t thunder.',
  'Guild kid’s back.',
  'Aldric? He looks tired.',
  'Everybody looks tired.',
  'Drain’s backed up by Lowtown again.',
  'Tell the council. They love ignoring things.',
  'Archive lost another roof tile.',
  'Funny. Always the old records getting wet.',
  'Traveler asked when rainy season ends.',
  'What’d you tell him?',
  'Nothing. Felt mean.',
  'The old chapel has no gutters.',
  'Because it was built before the rain.',
  'Yeah. That’s the part I don’t like.',
] as const;

interface AmbientActor {
  actor: Container;
  baseX: number;
  baseY: number;
  axis: 'x' | 'y' | 'idle';
  range: number;
  speed: number;
  phase: number;
}

const housePalette = {
  residential: { wall: 0x55493c, roof: 0x343438, trim: 0x796652 },
  market: { wall: 0x54473b, roof: 0x343036, trim: 0x80674f },
  lowtown: { wall: 0x403b35, roof: 0x2d3032, trim: 0x62584a },
  old: { wall: 0x4b4f4d, roof: 0x303437, trim: 0x777b70 },
};

export class TownScene extends WalkableWorldScene {
  protected override readonly worldWidth = TOWN_WIDTH;
  protected override readonly worldHeight = TOWN_HEIGHT;
  protected override readonly cameraFollowsPlayer = true;
  protected readonly colliders = TOWN_COLLIDERS;
  protected readonly targets = TOWN_TARGETS;
  protected readonly spawnPoints = SPAWNS;
  protected readonly defaultSpawn = SPAWNS.default!;

  private readonly guildGlow = new Graphics();
  private readonly forgeGlow = new Graphics();
  private readonly rainLayer = new Graphics();
  private readonly puddleRipples = new Graphics();
  private readonly playerSplash = new Graphics();
  private readonly ambientBubble = new Container();
  private readonly ambientBubbleBg = new Graphics();
  private readonly ambientBubbleText = new Text({
    text: '',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 22,
      fill: 0xf0eadf,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 300,
      lineHeight: 26,
    },
  });
  private readonly ambientActors: AmbientActor[] = [];
  private hallStatus: 'REQUESTED' | 'LOADED' | 'FALLBACK' = 'REQUESTED';
  private hallUrl = new URL(GUILD_HALL_ASSET, document.baseURI).href;
  private elapsed = 0;
  private lastAmbientIndex = -1;

  constructor(state: StateManager) {
    super(state, 'town');
    this.drawGround();
    this.drawRoadsAndDrainage();
    this.drawOldWard();
    this.drawGuildQuarter();
    this.drawResidentialWard();
    this.drawMarket();
    this.drawLowtown();
    this.drawPuddles();
    this.drawTownPopulation();
    this.drawLight();
    this.drawRain();
    this.configureAmbientBubble();
    this.finishScene();
    void this.loadBuildings();
  }

  override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    if (!this.visible) return;
    this.elapsed += Math.max(0, deltaSeconds);
    this.guildGlow.alpha = 0.72 + Math.sin(this.elapsed * 2.15) * 0.12;
    this.forgeGlow.alpha = 0.76 + Math.sin(this.elapsed * 3.8 + 0.8) * 0.14;
    this.puddleRipples.alpha = 0.34 + Math.sin(this.elapsed * 2.7) * 0.12;
    this.rainLayer.y = (this.elapsed * 220) % 96 - 96;
    this.updatePopulation();
    this.updateAmbientDialogue();
    this.updatePlayerSplash();
  }

  private drawGround(): void {
    const ground = new Graphics();
    ground.rect(0, 0, TOWN_WIDTH, TOWN_HEIGHT).fill(0x3d4a49);

    // District ground language. These are intentionally broad and subdued so the
    // whole settlement remains one town under the same cold gray sky.
    ground
      .rect(0, 0, TOWN_WIDTH, 720).fill({ color: 0x454d4a, alpha: 0.92 })
      .rect(0, 720, TOWN_WIDTH, 870).fill({ color: 0x4a5048, alpha: 0.88 })
      .rect(0, 1590, 1500, 1010).fill({ color: 0x465044, alpha: 0.9 })
      .rect(1500, 1240, 900, 770).fill({ color: 0x514c43, alpha: 0.84 })
      .rect(1500, 2010, 900, 590).fill({ color: 0x3e4540, alpha: 0.94 });

    // Permanent wet sheen. Cheap translucent strips give roads and stone a
    // reflective read without full-screen water simulation.
    for (let y = 60; y < TOWN_HEIGHT; y += 170) {
      ground.rect(0, y, TOWN_WIDTH, 38).fill({ color: 0xa9c0c5, alpha: 0.018 });
    }
    this.backgroundLayer.addChild(ground);
  }

  private drawRoadsAndDrainage(): void {
    const roads = new Graphics();
    roads
      // Main road to Ashen Crypt.
      .roundRect(1085, 120, 230, 2400, 92).fill(0x696962)
      // Guild Quarter cross streets.
      .roundRect(350, 760, 1700, 170, 58).fill(0x6e6b62)
      .roundRect(470, 1120, 1580, 175, 62).fill(0x706c61)
      .roundRect(430, 1400, 1760, 190, 68).fill(0x706e64)
      // Residential loops and shortcuts.
      .roundRect(365, 1540, 180, 940, 62).fill(0x675f55)
      .roundRect(735, 1580, 175, 880, 62).fill(0x696158)
      .roundRect(1450, 1540, 175, 970, 62).fill(0x655f57)
      .roundRect(270, 1880, 1350, 150, 58).fill(0x6a6258)
      .roundRect(300, 2180, 1350, 150, 58).fill(0x665e55)
      // Market and Lowtown lanes.
      .roundRect(1600, 1310, 640, 155, 52).fill(0x746b5e)
      .roundRect(1760, 1300, 170, 1220, 55).fill(0x686059)
      .roundRect(1530, 1940, 790, 150, 52).fill(0x625d58)
      .roundRect(1540, 2260, 760, 145, 50).fill(0x5d5a56);

    // Wet cobble highlights.
    for (const [x, y, width] of [
      [1120, 330, 150], [1095, 620, 190], [560, 820, 420], [1320, 850, 460],
      [560, 1180, 380], [1320, 1460, 500], [420, 1940, 540], [930, 2240, 560],
      [1650, 1380, 480], [1650, 2010, 500],
    ] as Array<[number, number, number]>) {
      roads.roundRect(x, y, width, 22, 9).fill({ color: 0xb7c7c7, alpha: 0.08 });
    }

    // Open drainage channels — a visual adaptation to decades of rain.
    for (const x of [1042, 1350]) {
      roads
        .roundRect(x, 360, 24, 2030, 10).fill(0x303c3e)
        .roundRect(x + 5, 365, 12, 2020, 6).fill({ color: 0x56747a, alpha: 0.72 });
    }
    roads
      .roundRect(250, 1600, 20, 850, 8).fill(0x303b3b)
      .roundRect(2280, 1450, 20, 1030, 8).fill(0x303b3b);

    this.backgroundLayer.addChild(roads);
  }

  private drawOldWard(): void {
    const ward = new Graphics();
    ward
      // Cemetery wall and open gate.
      .rect(70, 92, 950, 58).fill(0x414544).stroke({ color: 0x252a29, width: 5 })
      .rect(1380, 92, 950, 58).fill(0x414544).stroke({ color: 0x252a29, width: 5 })
      .rect(1010, 62, 22, 135).fill(0x2c3130)
      .rect(1368, 62, 22, 135).fill(0x2c3130)
      .moveTo(1032, 96).lineTo(1180, 142).lineTo(1180, 230).stroke({ color: 0x242a29, width: 8 })
      .moveTo(1368, 96).lineTo(1220, 142).lineTo(1220, 230).stroke({ color: 0x242a29, width: 8 });

    // Ancient chapel/watchtower landmarks. Deliberately no oversized modern gutters
    // on the chapel: a quiet visual clue that it predates the Long Rain.
    ward
      .roundRect(175, 300, 300, 210, 16).fill(0x515654).stroke({ color: 0x303534, width: 6 })
      .moveTo(145, 330).lineTo(325, 205).lineTo(505, 330).closePath().fill(0x353b3b)
      .rect(285, 215, 82, 98).fill(0x4a504f).stroke({ color: 0x2b302f, width: 5 })
      .circle(326, 366, 34).fill(0x313b3e).stroke({ color: 0x93865f, width: 5 })
      .roundRect(1810, 300, 310, 220, 12).fill(0x474d4c).stroke({ color: 0x2d3231, width: 6 })
      .rect(1895, 162, 128, 330).fill(0x484e4d).stroke({ color: 0x2c3130, width: 6 })
      .moveTo(1870, 180).lineTo(1960, 95).lineTo(2050, 180).closePath().fill(0x323738);

    // Archive and sealed cistern structures.
    ward
      .roundRect(235, 650, 250, 185, 12).fill(0x505350).stroke({ color: 0x303331, width: 5 })
      .roundRect(1920, 640, 260, 190, 12).fill(0x484b48).stroke({ color: 0x2b302e, width: 5 })
      .roundRect(1990, 725, 72, 105, 8).fill(0x282d2c).stroke({ color: 0x6f6957, width: 5 })
      .moveTo(2010, 754).lineTo(2045, 785).moveTo(2045, 754).lineTo(2010, 785)
      .stroke({ color: 0x81745a, width: 5 });

    // A faded old mural: unmistakably blue above the town, but not explained.
    ward
      .roundRect(520, 355, 205, 105, 8).fill(0x5c5c55).stroke({ color: 0x343632, width: 4 })
      .rect(538, 373, 169, 68).fill({ color: 0x6f8790, alpha: 0.48 })
      .circle(664, 393, 12).fill({ color: 0xd3bd72, alpha: 0.5 })
      .moveTo(545, 430).lineTo(590, 405).lineTo(625, 430).lineTo(666, 403).lineTo(704, 430)
      .stroke({ color: 0x4c574e, width: 8, alpha: 0.7 });

    // Old gravestones and rain-eaten statues.
    for (const [x, y, width, height] of [
      [1480, 260, 42, 68], [1550, 320, 34, 58], [1620, 245, 46, 75], [1695, 345, 36, 60],
      [770, 285, 40, 65], [835, 350, 34, 55],
    ] as Array<[number, number, number, number]>) {
      ward
        .roundRect(x, y, width, height, 11).fill(0x5a5d58).stroke({ color: 0x363a36, width: 3 })
        .rect(x - 7, y + height - 5, width + 14, 10).fill(0x454945);
    }
    this.worldLayer.addChild(ward);

    for (const [x, y, scale] of [
      [90, 260, 1.15], [560, 210, 1.05], [790, 560, 0.95], [2260, 270, 1.1],
      [1650, 600, 1.0], [80, 720, 1.08],
    ] as Array<[number, number, number]>) {
      this.positionActor(createTree(scale), x, y);
    }
  }

  private drawGuildQuarter(): void {
    this.drawNoticeBoard();
    this.drawFountainAndPlaza();

    const props = new Graphics();
    // Awnings, rain barrels, carts and benches around the old commercial center.
    props
      .roundRect(760, 780, 130, 22, 7).fill(0x66544a)
      .moveTo(760, 802).lineTo(748, 850).moveTo(890, 802).lineTo(902, 850)
      .stroke({ color: 0x44382f, width: 6 })
      .roundRect(910, 870, 38, 48, 8).fill(0x4f3e2f).stroke({ color: 0x2f261f, width: 4 })
      .roundRect(958, 862, 38, 56, 8).fill(0x55402f).stroke({ color: 0x2f261f, width: 4 })
      .roundRect(1410, 1000, 170, 75, 10).fill(0x4d3c2d).stroke({ color: 0x2c241d, width: 5 })
      .circle(1435, 1080, 24).stroke({ color: 0x2c2824, width: 8 })
      .circle(1550, 1080, 24).stroke({ color: 0x2c2824, width: 8 })
      .moveTo(720, 1300).lineTo(880, 1300).stroke({ color: 0x4c3b2d, width: 13 })
      .moveTo(740, 1270).lineTo(740, 1325).moveTo(860, 1270).lineTo(860, 1325)
      .stroke({ color: 0x322820, width: 8 });
    this.worldLayer.addChild(props);
  }

  private drawNoticeBoard(): void {
    const board = new Graphics();
    board
      .rect(844, 985, 64, 59).fill(0x493523).stroke({ color: 0x241a13, width: 5 })
      .rect(833, 971, 86, 17).fill(0x34251a)
      .rect(848, 1044, 9, 50).fill(0x34271d)
      .rect(897, 1044, 9, 50).fill(0x34271d)
      .roundRect(852, 996, 23, 31, 2).fill(0xd0bb88)
      .roundRect(880, 993, 20, 35, 2).fill(0xbca779)
      .circle(865, 999, 2).fill(0x8f3932)
      .circle(892, 996, 2).fill(0x8f3932);
    this.worldLayer.addChild(board);
  }

  private drawFountainAndPlaza(): void {
    const plaza = new Graphics();
    plaza.ellipse(1200, 1420, 270, 205).fill({ color: 0x656762, alpha: 0.72 });
    for (let ring = 0; ring < 3; ring += 1) {
      plaza.ellipse(1200, 1420, 235 - ring * 28, 175 - ring * 23)
        .stroke({ color: 0x8b918d, width: 4, alpha: 0.32 });
    }
    plaza
      .ellipse(1200, 1450, 100, 76).fill(0x4b4e4a).stroke({ color: 0x2d312f, width: 6 })
      .ellipse(1200, 1440, 84, 58).fill(0x294951)
      .ellipse(1200, 1432, 76, 46).fill({ color: 0x6f9da5, alpha: 0.48 })
      .rect(1177, 1350, 46, 82).fill(0x5c5d56).stroke({ color: 0x393b38, width: 4 })
      .ellipse(1200, 1355, 36, 18).fill(0x686963)
      .circle(1200, 1340, 9).fill({ color: 0xa9d9dc, alpha: 0.55 })
      .moveTo(1200, 1342).bezierCurveTo(1172, 1370, 1168, 1400, 1158, 1420)
      .moveTo(1200, 1342).bezierCurveTo(1228, 1370, 1232, 1400, 1242, 1420)
      .stroke({ color: 0x8fc8ce, width: 5, alpha: 0.55 });
    this.worldLayer.addChild(plaza);
  }

  private drawResidentialWard(): void {
    const houses: Array<[number, number, number, number, boolean]> = [
      [120, 1660, 260, 180, true], [455, 1715, 245, 170, false],
      [120, 1940, 300, 190, false], [500, 2010, 250, 180, true],
      [120, 2240, 255, 205, true], [450, 2300, 285, 195, false],
      [835, 1785, 250, 175, false], [870, 2110, 245, 190, true],
      [1180, 1885, 260, 185, true], [1185, 2190, 270, 190, false],
    ];
    houses.forEach(([x, y, width, height, awning], index) =>
      this.drawHouse(x, y, width, height, housePalette.residential, awning, index % 3 === 0));

    const details = new Graphics();
    // Communal well, vegetable plots, fences, laundry under awnings, barrels.
    details
      .ellipse(790, 1725, 72, 52).fill(0x484b48).stroke({ color: 0x2c302e, width: 5 })
      .ellipse(790, 1714, 56, 36).fill(0x2c4a50)
      .moveTo(740, 1670).lineTo(740, 1730).moveTo(840, 1670).lineTo(840, 1730)
      .stroke({ color: 0x4a382b, width: 8 })
      .moveTo(740, 1670).lineTo(790, 1630).lineTo(840, 1670).stroke({ color: 0x4a382b, width: 8 })
      .rect(285, 2120, 155, 75).fill({ color: 0x354632, alpha: 0.9 })
      .rect(485, 2195, 135, 70).fill({ color: 0x384b35, alpha: 0.9 })
      .moveTo(160, 1880).lineTo(430, 1880).stroke({ color: 0x49382c, width: 9 })
      .moveTo(175, 1855).lineTo(175, 1900).moveTo(310, 1855).lineTo(310, 1900)
      .stroke({ color: 0x342a23, width: 7 })
      .moveTo(520, 1980).lineTo(690, 1980).stroke({ color: 0x6f665e, width: 4 })
      .rect(545, 1960, 40, 18).fill(0x75685d)
      .rect(602, 1957, 45, 21).fill(0x596a68);
    this.worldLayer.addChild(details);

    for (const [x, y] of [[410, 1760], [770, 1990], [805, 2320], [1460, 1980], [1130, 2440]] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }
  }

  private drawMarket(): void {
    const houses: Array<[number, number, number, number]> = [
      [1530, 1450, 210, 160], [2010, 1450, 240, 170],
      [1520, 1760, 230, 165], [2015, 1760, 250, 170],
    ];
    houses.forEach(([x, y, width, height]) =>
      this.drawHouse(x, y, width, height, housePalette.market, true, true));

    const market = new Graphics();
    const stalls: Array<[number, number, number]> = [
      [1650, 1510, 0x6f5a4f], [1890, 1530, 0x56665e], [1640, 1730, 0x72624d],
      [1900, 1770, 0x5f586d], [1665, 1900, 0x6a5a48], [2040, 1910, 0x53645d],
    ];
    for (const [x, y, canopy] of stalls) {
      market
        .roundRect(x - 62, y - 35, 124, 28, 6).fill(canopy).stroke({ color: 0x38302b, width: 4 })
        .rect(x - 54, y - 7, 108, 42).fill(0x564331)
        .rect(x - 48, y + 35, 8, 46).fill(0x3c3026)
        .rect(x + 40, y + 35, 8, 46).fill(0x3c3026);
    }
    market
      .roundRect(2100, 1640, 160, 70, 8).fill(0x503d2e).stroke({ color: 0x2d241d, width: 5 })
      .circle(2122, 1712, 24).stroke({ color: 0x292521, width: 8 })
      .circle(2236, 1712, 24).stroke({ color: 0x292521, width: 8 })
      .roundRect(1810, 1360, 70, 82, 8).fill(0x4a392c)
      .roundRect(1888, 1370, 54, 72, 8).fill(0x553f2e);
    this.worldLayer.addChild(market);

    for (const [x, y] of [[1580, 1460], [1980, 1450], [1580, 1880], [2130, 1860]] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }
  }

  private drawLowtown(): void {
    const houses: Array<[number, number, number, number]> = [
      [1570, 2085, 240, 175], [1900, 2050, 285, 190],
      [1590, 2360, 270, 180], [1970, 2330, 255, 185],
    ];
    houses.forEach(([x, y, width, height], index) =>
      this.drawHouse(x, y, width, height, housePalette.lowtown, index !== 1, false, true));

    const low = new Graphics();
    low
      // Standing water and patched drainage.
      .roundRect(1490, 2480, 820, 72, 30).fill({ color: 0x31484a, alpha: 0.72 })
      .moveTo(1550, 2210).lineTo(1760, 2185).lineTo(1860, 2200)
      .stroke({ color: 0x514537, width: 9 })
      .rect(1840, 2140, 42, 95).fill(0x3f392f)
      .rect(1834, 2135, 54, 14).fill(0x695847)
      // Boarded alley / locked cellar seed.
      .roundRect(2180, 2140, 115, 95, 8).fill(0x292e2d).stroke({ color: 0x50483d, width: 5 })
      .moveTo(2190, 2165).lineTo(2285, 2208).moveTo(2285, 2165).lineTo(2190, 2208)
      .stroke({ color: 0x6d5a45, width: 8 })
      // Old rain shrine.
      .rect(1515, 2320, 70, 82).fill(0x4d4b45).stroke({ color: 0x30332f, width: 4 })
      .moveTo(1528, 2360).lineTo(1570, 2335).lineTo(1555, 2380).closePath()
      .fill({ color: 0x78898a, alpha: 0.5 });
    this.worldLayer.addChild(low);

    for (const [x, y] of [[1840, 2180], [2240, 2260]] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }
  }

  private drawHouse(
    x: number,
    y: number,
    width: number,
    height: number,
    palette: { wall: number; roof: number; trim: number },
    awning = false,
    lit = false,
    patched = false,
  ): void {
    const house = new Graphics();
    house
      .roundRect(x, y, width, height, 10).fill(palette.wall).stroke({ color: 0x2a2926, width: 5 })
      .moveTo(x - 18, y + 18).lineTo(x + width / 2, y - 82).lineTo(x + width + 18, y + 18).closePath()
      .fill(palette.roof).stroke({ color: 0x27292a, width: 5 })
      .roundRect(x + width * 0.39, y + height - 78, width * 0.22, 78, 6)
      .fill(0x2e241e).stroke({ color: palette.trim, width: 4 });

    const windowColor = lit ? 0xe2a75f : 0x5f685f;
    house
      .roundRect(x + 28, y + 60, 42, 42, 4).fill({ color: windowColor, alpha: lit ? 0.72 : 0.45 })
      .roundRect(x + width - 70, y + 60, 42, 42, 4).fill({ color: windowColor, alpha: lit ? 0.68 : 0.42 });

    // Oversized gutters and downspouts are now part of the town's architecture.
    house
      .moveTo(x - 4, y + 19).lineTo(x + width + 4, y + 19).stroke({ color: 0x343b3b, width: 8 })
      .moveTo(x + width - 8, y + 20).lineTo(x + width - 8, y + height - 6)
      .stroke({ color: 0x384143, width: 7 });

    if (awning) {
      house
        .roundRect(x + 18, y + 112, Math.min(126, width - 36), 24, 5).fill(0x63554b)
        .moveTo(x + 24, y + 136).lineTo(x + 15, y + 178)
        .moveTo(x + Math.min(136, width - 18), y + 136).lineTo(x + Math.min(145, width - 9), y + 178)
        .stroke({ color: 0x3d342d, width: 5 });
    }
    if (patched) {
      house
        .rect(x + 52, y - 24, 70, 18).fill(0x51483d)
        .rect(x + width - 110, y + 4, 62, 15).fill(0x4a443c);
    }
    this.worldLayer.addChild(house);

    const barrel = new Graphics()
      .roundRect(-16, -34, 32, 34, 8).fill(0x4c392b).stroke({ color: 0x2c241d, width: 3 })
      .ellipse(0, -34, 16, 5).stroke({ color: 0x79604a, width: 3 });
    this.positionActor(barrel, x + width - 28, y + height + 10);
  }

  private drawPuddles(): void {
    const puddles = new Graphics();
    for (const [x, y, rx, ry] of PUDDLES) {
      puddles
        .ellipse(x, y, rx, ry).fill({ color: 0x334f55, alpha: 0.68 })
        .ellipse(x - rx * 0.18, y - ry * 0.25, rx * 0.56, Math.max(5, ry * 0.22))
        .fill({ color: 0xa8bcc0, alpha: 0.11 });
      this.puddleRipples
        .ellipse(x + rx * 0.16, y, Math.max(10, rx * 0.2), Math.max(5, ry * 0.35))
        .stroke({ color: 0xa9c7cc, width: 2, alpha: 0.46 });
    }
    this.worldLayer.addChild(puddles, this.puddleRipples);
  }

  private drawTownPopulation(): void {
    // Existing party remains exactly where the first-quest flow expects them.
    this.positionActor(createNpcSilhouette('cleric'), 595, 1387);
    this.positionActor(createNpcSilhouette('ranger'), 655, 1412);
    this.positionActor(createNpcSilhouette('arcanist'), 715, 1384);

    const ambient: Array<[NpcRole, number, number, 'x' | 'y' | 'idle', number, number, number]> = [
      // Guild Quarter.
      ['resident', 915, 845, 'x', 90, 0.24, 0.3], ['guard', 1280, 760, 'y', 80, 0.2, 1.1],
      ['worker', 1470, 1160, 'x', 110, 0.23, 2.1], ['elder', 980, 1280, 'idle', 0, 0, 0],
      ['resident', 1350, 1510, 'x', 80, 0.2, 2.9], ['guard', 1110, 520, 'y', 90, 0.18, 0.8],
      // Residential Ward.
      ['resident', 620, 1840, 'y', 105, 0.19, 0.4], ['child', 780, 2010, 'x', 75, 0.27, 1.5],
      ['resident', 1040, 2180, 'x', 110, 0.17, 2.6], ['worker', 1340, 2320, 'y', 75, 0.2, 3.5],
      ['elder', 700, 2380, 'idle', 0, 0, 0], ['child', 425, 2130, 'x', 65, 0.3, 4.1],
      // Market.
      ['worker', 1780, 1495, 'x', 110, 0.25, 0.9], ['resident', 1900, 1610, 'x', 95, 0.2, 1.7],
      ['worker', 1810, 1810, 'y', 100, 0.25, 3.2], ['traveler', 2140, 1860, 'idle', 0, 0, 0],
      ['guard', 2200, 1550, 'y', 70, 0.2, 2.4], ['resident', 1650, 1960, 'x', 80, 0.19, 4.5],
      // Lowtown.
      ['resident', 1680, 2170, 'x', 85, 0.18, 1.3], ['elder', 2050, 2260, 'idle', 0, 0, 0],
      ['worker', 1860, 2440, 'x', 120, 0.2, 2.7], ['child', 2190, 2460, 'x', 55, 0.26, 4.0],
      // Old Ward.
      ['elder', 650, 520, 'idle', 0, 0, 0], ['guard', 1490, 470, 'x', 80, 0.19, 0.7],
      ['traveler', 1680, 720, 'y', 60, 0.18, 3.7], ['resident', 870, 680, 'x', 70, 0.18, 2.2],
    ];

    for (const [role, x, y, axis, range, speed, phase] of ambient) {
      const actor = createNpcSilhouette(role);
      this.positionActor(actor, x, y);
      this.ambientActors.push({ actor, baseX: x, baseY: y, axis, range, speed, phase });
    }
  }

  private updatePopulation(): void {
    for (const entry of this.ambientActors) {
      if (entry.axis === 'idle') continue;
      const offset = Math.sin(this.elapsed * entry.speed + entry.phase) * entry.range;
      if (entry.axis === 'x') entry.actor.position.set(entry.baseX + offset, entry.baseY);
      else entry.actor.position.set(entry.baseX, entry.baseY + offset);
      entry.actor.zIndex = Math.round(entry.actor.y);
    }
  }

  private drawLight(): void {
    this.guildGlow.ellipse(595, 686, 120, 42).fill({ color: 0xd98b42, alpha: 0.11 });
    this.guildGlow.blendMode = 'add';
    this.forgeGlow.ellipse(1860, 1138, 98, 50).fill({ color: 0xff7a32, alpha: 0.15 });
    this.forgeGlow.blendMode = 'add';
    this.worldLayer.addChild(this.guildGlow, this.forgeGlow);

    for (const [x, y] of [
      [880, 720], [1040, 1020], [1360, 940], [1510, 1320], [1040, 1590], [1420, 1620],
      [1960, 1260], [2190, 1980], [1040, 2460], [1480, 720],
    ] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }

    const mist = new Graphics();
    mist
      .ellipse(1200, 390, 840, 120).fill({ color: 0xc5d1d0, alpha: 0.025 })
      .ellipse(1980, 2170, 520, 100).fill({ color: 0xc9d0ca, alpha: 0.022 })
      .ellipse(650, 2420, 620, 120).fill({ color: 0xc9d4d2, alpha: 0.018 });
    this.worldLayer.addChild(mist);
  }

  private drawRain(): void {
    const params = new URLSearchParams(location.search);
    const forced = params.get('weather');
    const quality = forced === 'low' || forced === 'medium' || forced === 'high'
      ? forced
      : navigator.hardwareConcurrency <= 4 ? 'medium' : 'high';
    const count = quality === 'low' ? 110 : quality === 'medium' ? 180 : 260;

    // Deterministic placement keeps visual tests stable and avoids allocating
    // hundreds of independent particle objects.
    for (let i = 0; i < count; i += 1) {
      const x = (i * 173 + (i % 11) * 47) % TOWN_WIDTH;
      const y = (i * 251 + (i % 7) * 91) % (TOWN_HEIGHT + 160) - 80;
      const length = 24 + (i % 5) * 7;
      this.rainLayer
        .moveTo(x, y)
        .lineTo(x - 7, y + length)
        .stroke({ color: 0xc3d7dc, width: quality === 'high' ? 2 : 1.5, alpha: 0.24 + (i % 3) * 0.035 });
    }
    this.overlayLayer.addChild(this.rainLayer, this.playerSplash);
  }

  private updatePlayerSplash(): void {
    const player = this.getPlayerWorldPosition();
    let nearest: readonly [number, number, number, number] | null = null;
    for (const puddle of PUDDLES) {
      const [x, y, rx, ry] = puddle;
      if (Math.abs(player.x - x) <= rx && Math.abs(player.y - y) <= ry + 26) {
        nearest = puddle;
        break;
      }
    }

    this.playerSplash.clear();
    if (!nearest) return;
    const pulse = 12 + Math.sin(this.elapsed * 9) * 4;
    this.playerSplash
      .ellipse(player.x, player.y + 7, pulse * 2.2, pulse * 0.62)
      .stroke({ color: 0xb7d4d8, width: 2.5, alpha: 0.46 })
      .circle(player.x - 18, player.y - 4, 3).fill({ color: 0xc7dde0, alpha: 0.42 })
      .circle(player.x + 16, player.y - 1, 2.5).fill({ color: 0xc7dde0, alpha: 0.38 });
  }

  private configureAmbientBubble(): void {
    this.ambientBubbleText.anchor.set(0.5, 1);
    this.ambientBubble.addChild(this.ambientBubbleBg, this.ambientBubbleText);
    this.ambientBubble.visible = false;
    this.overlayLayer.addChild(this.ambientBubble);
  }

  private updateAmbientDialogue(): void {
    if (this.ambientActors.length === 0) return;
    const slot = Math.floor(this.elapsed / 8);
    const segment = this.elapsed % 8;
    const lineIndex = slot % AMBIENT_DIALOGUE.length;
    const actor = this.ambientActors[(slot * 5 + 3) % this.ambientActors.length]!;

    if (lineIndex !== this.lastAmbientIndex) {
      this.lastAmbientIndex = lineIndex;
      this.ambientBubbleText.text = AMBIENT_DIALOGUE[lineIndex]!;
      const width = Math.min(330, Math.max(150, this.ambientBubbleText.width + 28));
      const height = Math.max(52, this.ambientBubbleText.height + 20);
      this.ambientBubbleBg.clear();
      this.ambientBubbleBg
        .roundRect(-width / 2, -height - 8, width, height, 14)
        .fill({ color: 0x20282a, alpha: 0.88 })
        .stroke({ color: 0x7c8b8d, width: 2, alpha: 0.68 })
        .moveTo(-8, -8).lineTo(0, 5).lineTo(8, -8).closePath()
        .fill({ color: 0x20282a, alpha: 0.88 });
    }

    this.ambientBubble.position.set(actor.actor.x, actor.actor.y - 118);
    this.ambientBubble.visible = segment < 4.2;
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
      hall.position.set(397, 386);
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
        sprite.position.set(1678, 853);
        sprite.width = 365;
        sprite.height = 330;
      },
      () => this.createBlacksmithFallback(),
    );
    this.worldLayer.addChild(smithy);
  }

  private createGuildHallFallback(): Container {
    return new Graphics()
      .roundRect(419, 528, 350, 190, 12).fill(0x493e33).stroke({ color: 0x74614c, width: 6 })
      .moveTo(399, 548).lineTo(595, 430).lineTo(789, 548).closePath().fill(0x292527)
      .roundRect(559, 630, 72, 88, 8).fill(0x261b16).stroke({ color: 0x8a603d, width: 5 })
      .circle(595, 548, 31).fill(0x30353a).stroke({ color: 0xc09755, width: 5 })
      .moveTo(595, 524).lineTo(595, 573).moveTo(573, 548).lineTo(617, 548)
      .stroke({ color: 0xc09755, width: 5 });
  }

  private createBlacksmithFallback(): Container {
    return new Graphics()
      .roundRect(1690, 969, 310, 214, 10).fill(0x49382c).stroke({ color: 0x725640, width: 6 })
      .moveTo(1668, 999).lineTo(1834, 884).lineTo(2024, 999).closePath().fill(0x292526)
      .rect(1926, 872, 46, 118).fill(0x504941).stroke({ color: 0x2c2926, width: 5 })
      .roundRect(1816, 1091, 70, 92, 7).fill(0x211814).stroke({ color: 0x8a5c38, width: 5 })
      .roundRect(1704, 1049, 78, 62, 7).fill({ color: 0xf08b43, alpha: 0.56 })
      .moveTo(1725, 1109).lineTo(1764, 1109).lineTo(1755, 1129).lineTo(1716, 1129).closePath().fill(0x303033);
  }

  private reportHall(status: 'REQUESTED' | 'LOADED' | 'FALLBACK', url: string, error?: unknown): void {
    this.hallStatus = status;
    this.hallUrl = url;
    const publish = () => window.dispatchEvent(new CustomEvent('town:guild-hall-status', {
      detail: { status: this.hallStatus, url: this.hallUrl },
    }));
    publish();
    window.setTimeout(publish, 0);
    if (!this.isStoryDebug()) return;
    console.info(`[Town] Guild Hall asset ${status.toLowerCase()}: ${url}`);
    if (error) console.error('[Town] Guild Hall asset error:', error);
  }
}
