export interface Vec2 {
  x: number;
  y: number;
}

export interface ArenaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ARENA_WIDTH = 430;
export const ARENA_HEIGHT = 700;

/** The authored Crypt floor begins below the rear arch and ends before the HUD edge. */
export const CRYPT_WALKABLE_BOUNDS: ArenaRect = {
  x: 26,
  y: 330,
  width: 378,
  height: 338,
};

/** Rubble piles aligned with the floor dressing in the authored Crypt backdrop. */
export const CRYPT_OBSTACLES: readonly ArenaRect[] = [
  { x: 43, y: 382, width: 61, height: 48 },
  { x: 326, y: 526, width: 66, height: 50 },
];

export const clampMagnitude = (value: Vec2, maximum = 1): Vec2 => {
  const length = Math.hypot(value.x, value.y);
  if (!Number.isFinite(length) || length <= 0) return { x: 0, y: 0 };
  if (length <= maximum) return { x: value.x, y: value.y };
  const scale = maximum / length;
  return { x: value.x * scale, y: value.y * scale };
};

export const normalized = (value: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 => {
  const length = Math.hypot(value.x, value.y);
  return length > 0.0001
    ? { x: value.x / length, y: value.y / length }
    : { ...fallback };
};

export const distanceBetween = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const facingDot = (origin: Vec2, facing: Vec2, target: Vec2): number => {
  const direction = normalized({ x: target.x - origin.x, y: target.y - origin.y }, facing);
  const look = normalized(facing);
  return look.x * direction.x + look.y * direction.y;
};

const circleIntersectsRect = (position: Vec2, radius: number, rect: ArenaRect): boolean => {
  const nearestX = Math.max(rect.x, Math.min(rect.x + rect.width, position.x));
  const nearestY = Math.max(rect.y, Math.min(rect.y + rect.height, position.y));
  const dx = position.x - nearestX;
  const dy = position.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
};

const clampToBounds = (position: Vec2, radius: number, bounds: ArenaRect): Vec2 => ({
  x: Math.max(bounds.x + radius, Math.min(bounds.x + bounds.width - radius, position.x)),
  y: Math.max(bounds.y + radius, Math.min(bounds.y + bounds.height - radius, position.y)),
});

const blocked = (position: Vec2, radius: number, obstacles: readonly ArenaRect[]): boolean =>
  obstacles.some((obstacle) => circleIntersectsRect(position, radius, obstacle));

/**
 * Moves a circular actor one axis at a time. A blocked axis is discarded while the
 * other remains available, which produces forgiving wall sliding for touch input.
 */
export const moveCircleWithWallSlide = (
  position: Vec2,
  delta: Vec2,
  radius: number,
  bounds: ArenaRect = CRYPT_WALKABLE_BOUNDS,
  obstacles: readonly ArenaRect[] = CRYPT_OBSTACLES,
): Vec2 => {
  let result = clampToBounds(position, radius, bounds);

  const xCandidate = clampToBounds({ x: result.x + delta.x, y: result.y }, radius, bounds);
  if (!blocked(xCandidate, radius, obstacles)) result = xCandidate;

  const yCandidate = clampToBounds({ x: result.x, y: result.y + delta.y }, radius, bounds);
  if (!blocked(yCandidate, radius, obstacles)) result = yCandidate;

  return result;
};

/**
 * Separates two actors without creating an immovable body block. Most displacement
 * is assigned to the enemy, leaving Aldric room to maneuver near walls.
 */
export const softlySeparateCircles = (
  player: Vec2,
  playerRadius: number,
  enemy: Vec2,
  enemyRadius: number,
): { player: Vec2; enemy: Vec2 } => {
  const minimum = playerRadius + enemyRadius;
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= minimum || distance <= 0.0001) return { player, enemy };

  const overlap = minimum - distance;
  const nx = dx / distance;
  const ny = dy / distance;
  const playerPush = overlap * 0.25;
  const enemyPush = overlap * 0.75;

  return {
    player: moveCircleWithWallSlide(player, { x: -nx * playerPush, y: -ny * playerPush }, playerRadius),
    enemy: moveCircleWithWallSlide(enemy, { x: nx * enemyPush, y: ny * enemyPush }, enemyRadius),
  };
};
