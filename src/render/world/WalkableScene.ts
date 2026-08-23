import { Container, Graphics, Sprite } from 'pixi.js';
import type {
  StateManager,
  WorldLocation,
  WorldPosition as SavedWorldPosition,
} from '../../core/StateManager';

export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 1500;

export type WorldLocationId = WorldLocation;
export type WalkableLocationId = Exclude<WorldLocationId, 'ashenCrypt'>;
export type InteractionLabel = 'ENTER' | 'LEAVE' | 'TALK' | 'READ' | 'USE' | string;

/** Normalized position persisted by StateManager for the active logical world. */
export type WorldPosition = SavedWorldPosition;

export interface InteractionTarget {
  id: string;
  label: InteractionLabel;
  x: number;
  y: number;
  radius: number;
  priority: number;
}

export interface RectCollider {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WalkableSceneContract {
  readonly location: WalkableLocationId;
  readonly interactionTarget: InteractionTarget | null;
  setInput(x: number, y: number): void;
  setTargetListener(listener: (target: InteractionTarget | null) => void): void;
  enter(spawn?: WorldPosition | string): void;
  leave(): void;
  update(deltaSeconds: number): void;
  resize(width: number, height: number): void;
}

const STORY_DEBUG = new URLSearchParams(location.search).get('storydebug') === '1';
const PLAYER_ASSET = 'assets/dungeon/ashen-crypt/heroes/guardian.svg';

const finiteClamp = (value: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/**
 * Shared fixed-coordinate walking, collision and interaction implementation.
 * By default scenes retain the original 1000x1500 fitted presentation. Larger
 * exterior scenes can override worldWidth/worldHeight and cameraFollowsPlayer
 * without changing normalized save coordinates or interior behavior.
 */
export abstract class WalkableWorldScene extends Container implements WalkableSceneContract {
  readonly backgroundLayer = new Container();
  readonly worldLayer = new Container();
  readonly actorLayer = new Container();
  readonly overlayLayer = new Container();

  protected readonly player = Sprite.from(PLAYER_ASSET);
  protected readonly focusRing = new Graphics();

  protected readonly worldWidth: number = WORLD_WIDTH;
  protected readonly worldHeight: number = WORLD_HEIGHT;
  protected readonly cameraFollowsPlayer = false;
  protected readonly playerRadius = 24;
  protected readonly movementSpeed = 285;

  private readonly collisionDebug = new Graphics();
  private inputX = 0;
  private inputY = 0;
  private target: InteractionTarget | null = null;
  private targetListener: (target: InteractionTarget | null) => void = () => undefined;
  private ready = false;
  private lastFacing = 1;
  private viewportWidth = WORLD_WIDTH;
  private viewportHeight = WORLD_HEIGHT;
  private sceneScale = 1;

  protected abstract readonly colliders: readonly RectCollider[];
  protected abstract readonly targets: readonly InteractionTarget[];
  protected abstract readonly spawnPoints: Readonly<Record<string, WorldPosition>>;
  protected abstract readonly defaultSpawn: WorldPosition;

  constructor(
    protected readonly state: StateManager,
    readonly location: WalkableLocationId,
  ) {
    super();
    this.visible = false;
    this.actorLayer.sortableChildren = true;
    this.player.anchor.set(0.5, 0.82);
    this.player.width = 82;
    this.player.height = 108;
    this.player.zIndex = 1;
    this.focusRing.visible = false;
    this.addChild(this.backgroundLayer, this.worldLayer, this.actorLayer, this.overlayLayer);
  }

  get interactionTarget(): InteractionTarget | null {
    return this.target;
  }

  setTargetListener(listener: (target: InteractionTarget | null) => void): void {
    this.targetListener = listener;
    listener(this.target);
  }

  setInput(x: number, y: number): void {
    const safeX = finiteClamp(x, -1, 1, 0);
    const safeY = finiteClamp(y, -1, 1, 0);
    const length = Math.hypot(safeX, safeY);
    if (length > 1) {
      this.inputX = safeX / length;
      this.inputY = safeY / length;
    } else {
      this.inputX = safeX;
      this.inputY = safeY;
    }
  }

  enter(spawn?: WorldPosition | string): void {
    this.visible = true;
    this.setInput(0, 0);
    const next = typeof spawn === 'string'
      ? this.spawnPoints[spawn] ?? this.readPosition()
      : spawn ?? this.readPosition();
    this.writePosition(next.x, next.y);
    this.syncPlayer();
    this.resolveTarget(true);
  }

  leave(): void {
    this.setInput(0, 0);
    this.visible = false;
    this.setTarget(null);
  }

  resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    const portrait = height >= width * 1.15;
    this.sceneScale = portrait
      ? Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT)
      : Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    this.scale.set(this.sceneScale);
    this.applyCamera();
  }

  update(deltaSeconds: number): void {
    if (!this.visible || !this.ready) return;
    const dt = finiteClamp(deltaSeconds, 0, 0.05, 0);
    const position = this.readPosition();
    const currentX = position.x * this.worldWidth;
    const currentY = position.y * this.worldHeight;
    const requestedX = currentX + this.inputX * this.movementSpeed * dt;
    const requestedY = currentY + this.inputY * this.movementSpeed * dt;

    let nextX = this.clampWorldX(requestedX);
    let nextY = currentY;
    if (this.isBlocked(nextX, currentY)) nextX = currentX;

    nextY = this.clampWorldY(requestedY);
    if (this.isBlocked(nextX, nextY)) nextY = currentY;

    this.writePosition(nextX / this.worldWidth, nextY / this.worldHeight);
    this.syncPlayer();
    if (this.inputX < -0.05) this.lastFacing = -1;
    else if (this.inputX > 0.05) this.lastFacing = 1;
    this.player.scale.x = Math.abs(this.player.scale.x || 1) * this.lastFacing;
    this.resolveTarget(false);
  }

  /** Call once after the subclass has populated its visual and actor layers. */
  protected finishScene(): void {
    if (this.ready) return;
    this.ready = true;
    this.actorLayer.addChild(this.player);
    this.overlayLayer.addChild(this.focusRing);
    if (STORY_DEBUG) {
      this.drawDebug();
      this.overlayLayer.addChild(this.collisionDebug);
    }
    this.syncPlayer();
  }

  protected isStoryDebug(): boolean {
    return STORY_DEBUG;
  }

  protected positionActor(actor: Container, x: number, y: number): void {
    actor.position.set(x, y);
    actor.zIndex = Math.round(y);
    this.actorLayer.addChild(actor);
  }

  protected getPlayerWorldPosition(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  private readPosition(): WorldPosition {
    const position = this.state.worldPosition(this.location);
    const fallback = this.defaultSpawn;
    return {
      x: finiteClamp(position?.x ?? fallback.x, 0, 1, fallback.x),
      y: finiteClamp(position?.y ?? fallback.y, 0, 1, fallback.y),
    };
  }

  private writePosition(x: number, y: number): void {
    const safeX = finiteClamp(x, 0, 1, this.defaultSpawn.x);
    const safeY = finiteClamp(y, 0, 1, this.defaultSpawn.y);
    this.state.setWorldPosition(this.location, safeX, safeY);
  }

  private syncPlayer(): void {
    const position = this.readPosition();
    this.player.position.set(position.x * this.worldWidth, position.y * this.worldHeight);
    this.player.zIndex = Math.round(this.player.y);
    this.applyCamera();
  }

  private applyCamera(): void {
    const scale = Math.max(0.0001, this.sceneScale);
    if (!this.cameraFollowsPlayer) {
      this.position.set(
        (this.viewportWidth - this.worldWidth * scale) / 2,
        (this.viewportHeight - this.worldHeight * scale) / 2,
      );
      return;
    }

    const visibleWidth = this.viewportWidth / scale;
    const visibleHeight = this.viewportHeight / scale;
    const maxLeft = Math.max(0, this.worldWidth - visibleWidth);
    const maxTop = Math.max(0, this.worldHeight - visibleHeight);
    const left = Math.max(0, Math.min(maxLeft, this.player.x - visibleWidth / 2));
    const top = Math.max(0, Math.min(maxTop, this.player.y - visibleHeight / 2));
    this.position.set(-left * scale, -top * scale);
  }

  private clampWorldX(value: number): number {
    return finiteClamp(
      value,
      this.playerRadius + 48,
      this.worldWidth - this.playerRadius - 48,
      this.worldWidth / 2,
    );
  }

  private clampWorldY(value: number): number {
    return finiteClamp(
      value,
      this.playerRadius + 48,
      this.worldHeight - this.playerRadius - 58,
      this.worldHeight * 0.8,
    );
  }

  private isBlocked(x: number, y: number): boolean {
    const radius = this.playerRadius;
    return this.colliders.some((rect) =>
      x + radius > rect.x &&
      x - radius < rect.x + rect.width &&
      y + radius > rect.y &&
      y - radius < rect.y + rect.height,
    );
  }

  private resolveTarget(force: boolean): void {
    const position = this.readPosition();
    const x = position.x * this.worldWidth;
    const y = position.y * this.worldHeight;

    if (!force && this.target) {
      const retainedDistance = Math.hypot(x - this.target.x, y - this.target.y);
      if (retainedDistance <= this.target.radius + 18) return;
    }

    const eligible = this.targets
      .map((target) => ({ target, distance: Math.hypot(x - target.x, y - target.y) }))
      .filter(({ target, distance }) => distance <= target.radius)
      .sort((a, b) =>
        a.distance - b.distance ||
        a.target.priority - b.target.priority ||
        a.target.id.localeCompare(b.target.id),
      );
    this.setTarget(eligible[0]?.target ?? null);
  }

  private setTarget(target: InteractionTarget | null): void {
    if (target?.id === this.target?.id) return;
    this.target = target;
    this.focusRing.clear();
    if (target) {
      this.focusRing
        .ellipse(target.x, target.y + 10, 48, 18)
        .stroke({ color: 0xf0ce85, width: 4, alpha: 0.72 });
      this.focusRing.visible = true;
    } else {
      this.focusRing.visible = false;
    }
    this.targetListener(target);
  }

  private drawDebug(): void {
    this.collisionDebug.clear();
    this.collisionDebug
      .rect(0, 0, this.worldWidth, this.worldHeight)
      .stroke({ color: 0x87ff9d, width: 4, alpha: 0.45 });
    for (const rect of this.colliders) {
      this.collisionDebug
        .rect(rect.x, rect.y, rect.width, rect.height)
        .fill({ color: 0xff4d5e, alpha: 0.07 })
        .stroke({ color: 0xff6875, width: 3, alpha: 0.78 });
    }
    for (const target of this.targets) {
      this.collisionDebug
        .circle(target.x, target.y, target.radius)
        .stroke({ color: 0x63d8ff, width: 2, alpha: 0.62 });
    }
  }
}
