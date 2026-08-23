import { Graphics } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import {
  type InteractionTarget,
  type RectCollider,
  type WorldPosition,
  WalkableWorldScene,
} from '../world/WalkableScene';
import { createNpcSilhouette } from '../world/WorldArt';

const TARGETS: readonly InteractionTarget[] = [
  { id: 'smith', label: 'TALK', x: 688, y: 690, radius: 128, priority: 1 },
  { id: 'forge', label: 'USE', x: 248, y: 620, radius: 122, priority: 1 },
  { id: 'blacksmithExit', label: 'LEAVE', x: 500, y: 1370, radius: 112, priority: 1 },
];

const COLLIDERS: readonly RectCollider[] = [
  { x: 62, y: 170, width: 292, height: 414 },
  { x: 802, y: 164, width: 132, height: 468 },
  { x: 532, y: 305, width: 246, height: 154 },
  { x: 414, y: 718, width: 172, height: 122 },
  { x: 68, y: 1010, width: 154, height: 320 },
  { x: 778, y: 1018, width: 154, height: 312 },
];

const SPAWNS: Readonly<Record<string, WorldPosition>> = {
  default: { x: 0.5, y: 0.84 },
  entrance: { x: 0.5, y: 0.84 },
  'blacksmith:entrance': { x: 0.5, y: 0.84 },
};

export class BlacksmithScene extends WalkableWorldScene {
  protected readonly colliders = COLLIDERS;
  protected readonly targets = TARGETS;
  protected readonly spawnPoints = SPAWNS;
  protected readonly defaultSpawn = SPAWNS.default!;

  private readonly forgeLight = new Graphics();
  private readonly embers = new Graphics();
  private elapsed = 0;

  constructor(state: StateManager) {
    super(state, 'blacksmith');
    this.drawRoom();
    this.drawForge();
    this.drawWorkbenchAndRacks();
    this.drawAnvil();
    this.drawSmith();
    this.drawSuppliesAndEntrance();
    this.finishScene();
  }

  override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    if (!this.visible) return;
    this.elapsed += Math.max(0, deltaSeconds);
    const flicker = Math.sin(this.elapsed * 8.4) * 0.06 + Math.sin(this.elapsed * 13.2) * 0.035;
    this.forgeLight.alpha = 0.78 + flicker;
    this.drawEmbers();
  }

  private drawRoom(): void {
    const room = new Graphics();
    room
      .rect(0, 0, 1000, 1500).fill(0x151312)
      .roundRect(40, 48, 920, 1396, 24).fill(0x393430).stroke({ color: 0x1d1b1a, width: 18 })
      .rect(65, 75, 870, 1340).fill(0x3f3934);

    // Broad flagstones keep collision and scale readable on a phone.
    for (let y = 88; y < 1410; y += 92) {
      for (let x = 68 + ((y / 92) % 2) * 42; x < 930; x += 168) {
        room.roundRect(x, y, 156, 80, 7)
          .fill((x + y) % 4 ? 0x423c37 : 0x48413a)
          .stroke({ color: 0x292622, width: 4, alpha: 0.72 });
      }
    }

    // Soot-dark walls and beams.
    room
      .rect(62, 70, 876, 72).fill(0x292725).stroke({ color: 0x191817, width: 6 })
      .rect(78, 120, 24, 1260).fill(0x30251e)
      .rect(898, 120, 24, 1260).fill(0x30251e)
      .moveTo(91, 184).lineTo(220, 70).moveTo(909, 184).lineTo(780, 70)
      .stroke({ color: 0x30251e, width: 19 });

    // A worn, ash-marked central work lane.
    room
      .roundRect(374, 475, 252, 842, 80).fill({ color: 0x272626, alpha: 0.48 })
      .ellipse(500, 785, 205, 132).fill({ color: 0x1e1d1d, alpha: 0.25 })
      .ellipse(251, 613, 188, 70).fill({ color: 0x151515, alpha: 0.24 });
    this.backgroundLayer.addChild(room);
  }

  private drawForge(): void {
    const forge = new Graphics();
    forge
      .roundRect(62, 170, 292, 414, 14).fill(0x4c4741).stroke({ color: 0x252422, width: 8 })
      .rect(88, 190, 238, 100).fill(0x5d5750)
      .roundRect(104, 317, 208, 210, 42).fill(0x1d1816).stroke({ color: 0x736355, width: 8 })
      .roundRect(124, 360, 168, 142, 31).fill(0x3b2018)
      .moveTo(138, 487).bezierCurveTo(126, 424, 176, 408, 181, 350)
      .bezierCurveTo(236, 404, 220, 454, 206, 489).closePath().fill(0xc94e26)
      .moveTo(171, 486).bezierCurveTo(164, 447, 196, 421, 199, 387)
      .bezierCurveTo(227, 430, 213, 464, 204, 487).closePath().fill(0xffb14f)
      .rect(91, 526, 234, 58).fill(0x393633)
      .moveTo(91, 214).lineTo(326, 214).moveTo(91, 254).lineTo(326, 254)
      .stroke({ color: 0x383532, width: 5 });
    this.worldLayer.addChild(forge);

    this.forgeLight.circle(215, 421, 230).fill({ color: 0xff7934, alpha: 0.105 });
    this.forgeLight.blendMode = 'add';
    this.worldLayer.addChild(this.forgeLight, this.embers);
  }

  private drawWorkbenchAndRacks(): void {
    const furnishings = new Graphics();
    furnishings
      .roundRect(532, 305, 246, 92, 8).fill(0x503824).stroke({ color: 0x291f18, width: 7 })
      .rect(552, 397, 25, 62).fill(0x38291f)
      .rect(733, 397, 25, 62).fill(0x38291f)
      .roundRect(802, 164, 132, 468, 8).fill(0x34281f).stroke({ color: 0x1e1915, width: 7 });

    for (const y of [235, 342, 449, 556]) {
      furnishings.rect(816, y, 104, 11).fill(0x60452f);
    }

    // Hammers, tongs, sword blanks and horseshoes are readable silhouettes.
    furnishings
      .moveTo(574, 334).lineTo(574, 382).stroke({ color: 0x252527, width: 8 })
      .roundRect(555, 322, 40, 18, 4).fill(0x747579).stroke({ color: 0x28282a, width: 3 })
      .moveTo(627, 323).lineTo(615, 382).moveTo(642, 323).lineTo(655, 382)
      .stroke({ color: 0x6f7073, width: 7 })
      .moveTo(693, 320).lineTo(726, 383).stroke({ color: 0x898a8d, width: 8 })
      .moveTo(708, 319).lineTo(675, 383).stroke({ color: 0x898a8d, width: 8 });

    for (const [x, y] of [[834, 190], [876, 190], [834, 300], [876, 410], [834, 518]] as Array<[number, number]>) {
      furnishings
        .moveTo(x, y).lineTo(x + 45, y + 50).stroke({ color: 0x85878a, width: 7 })
        .moveTo(x + 39, y + 45).lineTo(x + 53, y + 58).stroke({ color: 0x3a3a3c, width: 4 });
    }
    this.worldLayer.addChild(furnishings);
  }

  private drawAnvil(): void {
    const anvil = new Graphics();
    anvil
      .moveTo(414, 720).lineTo(579, 720).lineTo(550, 766).lineTo(467, 766).lineTo(430, 748).closePath()
      .fill(0x6c6e72).stroke({ color: 0x252629, width: 8 })
      .moveTo(465, 766).lineTo(548, 766).lineTo(568, 826).lineTo(442, 826).closePath()
      .fill(0x45474a).stroke({ color: 0x242527, width: 7 })
      .rect(428, 826, 158, 14).fill(0x262729)
      .ellipse(500, 845, 125, 28).fill({ color: 0x111111, alpha: 0.28 });
    this.worldLayer.addChild(anvil);
  }

  private drawSmith(): void {
    const smith = createNpcSilhouette('smith');
    smith.scale.set(1.12);
    this.positionActor(smith, 688, 613);
  }

  private drawSuppliesAndEntrance(): void {
    const props = new Graphics();
    for (const [x, y] of [[68, 1120], [778, 1128]] as Array<[number, number]>) {
      props
        .roundRect(x, y + 84, 154, 126, 8).fill(0x493424).stroke({ color: 0x281f18, width: 6 })
        .roundRect(x + 20, y, 112, 96, 8).fill(0x57402d).stroke({ color: 0x30241b, width: 5 })
        .moveTo(x + 20, y + 38).lineTo(x + 132, y + 38).stroke({ color: 0x866545, width: 5 });
    }

    props
      .roundRect(386, 1316, 228, 116, 26).fill(0x231d19).stroke({ color: 0x805b3b, width: 7 })
      .rect(410, 1340, 180, 92).fill(0x121212)
      .moveTo(500, 1344).lineTo(500, 1428).stroke({ color: 0x4e3425, width: 6 })
      .circle(479, 1380, 6).fill(0xc49252);
    this.worldLayer.addChild(props);
  }

  private drawEmbers(): void {
    this.embers.clear();
    for (let index = 0; index < 12; index += 1) {
      const phase = this.elapsed * (0.7 + (index % 4) * 0.12) + index * 1.83;
      const x = 150 + ((index * 37) % 128) + Math.sin(phase * 2) * 9;
      const travel = (phase * 52) % 150;
      const y = 484 - travel;
      this.embers.circle(x, y, 1.5 + (index % 3) * 0.55)
        .fill({ color: index % 3 ? 0xf4893d : 0xffd17b, alpha: 0.24 + (index % 4) * 0.09 });
    }
  }
}
