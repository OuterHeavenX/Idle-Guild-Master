import { Graphics } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import {
  type InteractionTarget,
  type RectCollider,
  type WorldPosition,
  WalkableWorldScene,
} from '../world/WalkableScene';
import { createLantern, createNpcSilhouette } from '../world/WorldArt';

const TARGETS: readonly InteractionTarget[] = [
  { id: 'steward', label: 'TALK', x: 500, y: 478, radius: 132, priority: 1 },
  { id: 'guildHallExit', label: 'LEAVE', x: 500, y: 1370, radius: 112, priority: 1 },
];

const COLLIDERS: readonly RectCollider[] = [
  { x: 66, y: 128, width: 118, height: 470 },
  { x: 816, y: 214, width: 122, height: 322 },
  { x: 300, y: 278, width: 400, height: 146 },
  { x: 148, y: 654, width: 248, height: 92 },
  { x: 604, y: 654, width: 248, height: 92 },
  { x: 148, y: 874, width: 248, height: 92 },
  { x: 604, y: 874, width: 248, height: 92 },
  { x: 72, y: 1130, width: 142, height: 214 },
  { x: 786, y: 1130, width: 142, height: 214 },
];

const SPAWNS: Readonly<Record<string, WorldPosition>> = {
  default: { x: 0.5, y: 0.84 },
  entrance: { x: 0.5, y: 0.84 },
  'guildHall:entrance': { x: 0.5, y: 0.84 },
};

export class GuildHallScene extends WalkableWorldScene {
  protected readonly colliders = COLLIDERS;
  protected readonly targets = TARGETS;
  protected readonly spawnPoints = SPAWNS;
  protected readonly defaultSpawn = SPAWNS.default!;

  private readonly fireGlow = new Graphics();
  private elapsed = 0;

  constructor(state: StateManager) {
    super(state, 'guildHall');
    this.drawRoom();
    this.drawStewardStation();
    this.drawFurniture();
    this.drawEntrance();
    this.drawLighting();
    this.finishScene();
  }

  override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    if (!this.visible) return;
    this.elapsed += Math.max(0, deltaSeconds);
    this.fireGlow.alpha = 0.74 + Math.sin(this.elapsed * 7.1) * 0.08 + Math.sin(this.elapsed * 11.3) * 0.04;
  }

  private drawRoom(): void {
    const room = new Graphics();
    room.rect(0, 0, 1000, 1500).fill(0x171512);
    room
      .roundRect(42, 48, 916, 1394, 24).fill(0x594737).stroke({ color: 0x24201c, width: 18 })
      .rect(66, 74, 868, 1340).fill(0x69533d);

    // Long, worn floorboards make the hall legible as one real room.
    for (let y = 86; y < 1410; y += 58) {
      room.rect(68, y, 864, 50).fill(y % 116 === 86 ? 0x5d4937 : 0x634e3a);
      room.moveTo(68, y + 52).lineTo(932, y + 52).stroke({ color: 0x34291f, width: 4, alpha: 0.72 });
      const seam = 150 + ((y * 7) % 650);
      room.moveTo(seam, y).lineTo(seam, y + 50).stroke({ color: 0x3e3025, width: 3, alpha: 0.6 });
    }

    // Central guild runner and threshold wear.
    room
      .roundRect(408, 425, 184, 912, 34).fill(0x4e2930).stroke({ color: 0x8b6748, width: 7 })
      .roundRect(432, 445, 136, 872, 25).stroke({ color: 0xb28a58, width: 3, alpha: 0.62 })
      .ellipse(500, 1325, 150, 50).fill({ color: 0x34281f, alpha: 0.35 });

    // Stone wall cap and exposed timber braces.
    room
      .rect(62, 70, 876, 66).fill(0x403a34).stroke({ color: 0x242321, width: 6 })
      .rect(77, 120, 22, 1260).fill(0x3a2a20)
      .rect(901, 120, 22, 1260).fill(0x3a2a20)
      .moveTo(90, 180).lineTo(210, 70).moveTo(910, 180).lineTo(790, 70)
      .stroke({ color: 0x39291f, width: 18 });
    this.backgroundLayer.addChild(room);

    this.drawBanners();
  }

  private drawBanners(): void {
    const banners = new Graphics();
    for (const x of [245, 755]) {
      banners
        .moveTo(x - 56, 126).lineTo(x + 56, 126).lineTo(x + 48, 310).lineTo(x, 354).lineTo(x - 48, 310).closePath()
        .fill(x < 500 ? 0x3c4054 : 0x4a3034).stroke({ color: 0x1f2028, width: 5 })
        .circle(x, 218, 37).stroke({ color: 0xc29b5d, width: 7 })
        .moveTo(x, 184).lineTo(x, 252).moveTo(x - 31, 218).lineTo(x + 31, 218)
        .stroke({ color: 0xc29b5d, width: 7 });
    }
    this.worldLayer.addChild(banners);
  }

  private drawStewardStation(): void {
    const station = new Graphics();
    station
      .roundRect(300, 278, 400, 146, 12).fill(0x463123).stroke({ color: 0x241a14, width: 7 })
      .rect(320, 302, 360, 97).fill(0x5a3e29)
      .moveTo(332, 330).lineTo(668, 330).stroke({ color: 0x8e6844, width: 4 })
      .roundRect(368, 249, 164, 56, 6).fill(0x8f815f).stroke({ color: 0x3c3327, width: 4 })
      .moveTo(389, 269).lineTo(493, 279).lineTo(512, 260).stroke({ color: 0x5a4934, width: 4 })
      .roundRect(557, 252, 70, 48, 5).fill(0x755337)
      .circle(580, 269, 8).fill(0xb58c4e);
    this.worldLayer.addChild(station);

    const steward = createNpcSilhouette('steward');
    this.positionActor(steward, 500, 324);
  }

  private drawFurniture(): void {
    const furniture = new Graphics();

    // Records, shelves and rolled contracts.
    furniture
      .roundRect(66, 128, 118, 470, 7).fill(0x392a21).stroke({ color: 0x211a16, width: 6 });
    for (const y of [190, 286, 382, 478]) {
      furniture.rect(76, y, 98, 12).fill(0x604630);
      for (let x = 84; x < 165; x += 17) {
        furniture.roundRect(x, y - 55, 11, 52, 2).fill((x + y) % 3 ? 0x795d43 : 0x4a5360);
      }
    }

    // Fireplace on the opposite wall.
    furniture
      .roundRect(816, 214, 122, 322, 10).fill(0x49433c).stroke({ color: 0x292723, width: 7 })
      .roundRect(838, 349, 78, 142, 26).fill(0x1e1815).stroke({ color: 0x706052, width: 6 })
      .moveTo(852, 473).bezierCurveTo(840, 427, 872, 407, 878, 366).bezierCurveTo(916, 412, 905, 454, 893, 475).closePath()
      .fill(0xd96830)
      .moveTo(869, 467).bezierCurveTo(862, 436, 883, 421, 885, 397).bezierCurveTo(900, 429, 895, 450, 886, 468).closePath()
      .fill(0xffbc63);

    // Two rows of benches keep a generous central walking aisle.
    for (const [x, y] of [[148, 654], [604, 654], [148, 874], [604, 874]] as Array<[number, number]>) {
      furniture
        .roundRect(x, y, 248, 42, 7).fill(0x493323).stroke({ color: 0x271d17, width: 5 })
        .rect(x + 14, y + 42, 20, 50).fill(0x38281e)
        .rect(x + 214, y + 42, 20, 50).fill(0x38281e);
    }

    // Supply stacks deliberately occupy the rear corners, not the exit lane.
    for (const [x, y] of [[72, 1130], [786, 1130]] as Array<[number, number]>) {
      furniture
        .roundRect(x, y + 88, 142, 126, 8).fill(0x4c3727).stroke({ color: 0x2a2019, width: 6 })
        .roundRect(x + 18, y, 106, 99, 8).fill(0x5a422f).stroke({ color: 0x30231b, width: 5 })
        .moveTo(x + 18, y + 37).lineTo(x + 124, y + 37).stroke({ color: 0x8b6a48, width: 5 });
    }
    this.worldLayer.addChild(furniture);
  }

  private drawEntrance(): void {
    const entrance = new Graphics();
    entrance
      .roundRect(386, 1316, 228, 116, 26).fill(0x27201b).stroke({ color: 0x8c6844, width: 7 })
      .rect(410, 1340, 180, 92).fill(0x151414)
      .moveTo(500, 1346).lineTo(500, 1428).stroke({ color: 0x513726, width: 6 })
      .circle(479, 1380, 6).fill(0xc09959);
    this.worldLayer.addChild(entrance);
  }

  private drawLighting(): void {
    this.fireGlow.circle(876, 410, 150).fill({ color: 0xff8a3d, alpha: 0.09 });
    this.fireGlow.blendMode = 'add';
    this.worldLayer.addChild(this.fireGlow);
    for (const [x, y] of [[280, 545], [720, 545], [280, 1090], [720, 1090]] as Array<[number, number]>) {
      this.positionActor(createLantern(), x, y);
    }
  }
}
