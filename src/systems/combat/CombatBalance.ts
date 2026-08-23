import { mitigateDamage } from '../../math/CombatMath';
import type { Hero } from '../../models/Hero';

export const SOLO_COMBAT_BALANCE = {
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxSimulationSteps: 8,

  totalEncounters: 3,
  playerRadius: 18,
  enemyRadius: 23,
  playerMoveSpeed: 148,
  enemyMoveSpeed: 72,
  attackMoveMultiplier: 0.26,
  blockMoveMultiplier: 0.43,

  playerAttackWindup: 0.2,
  playerAttackActive: 0.12,
  playerAttackRecovery: 0.46,
  playerAttackRange: 76,
  playerAttackFacingDot: 0.05,
  playerAttackMultiplier: 1.04,
  playerAttackFlatDamage: 2,
  criticalMultiplier: 1.5,

  enemySpawnDuration: 0.52,
  enemyTelegraphDuration: 0.96,
  enemyStrikeDuration: 0.16,
  enemyStrikeHitTime: 0.065,
  enemyRecoveryDuration: 0.82,
  enemyDeathDuration: 0.72,
  encounterIntermission: 0.82,
  enemyAttackTriggerRange: 69,
  enemyStrikeRange: 72,
  enemyStrikeFacingDot: 0.18,

  maxGuard: 100,
  blockDamageReduction: 0.76,
  guardDamagePerStrike: 22,
  guardRegenPerSecond: 26,
  guardRegenDelay: 0.45,
  guardBreakDuration: 1.2,
  blockedKnockback: 5,
  unblockedKnockback: 12,

  enemyBaseHp: 220,
  enemyHpStep: 28,
  enemyBaseAttack: 18,
  enemyAttackStep: 2,
  enemyBaseDefense: 4,
  enemyDefenseStep: 1,

  goldPerEncounter: 24,
  zoneClearGold: 90,
  zoneClearShards: 2,
} as const;

export interface SoloEnemyStats {
  hp: number;
  attack: number;
  defense: number;
}

export const soloEnemyStatsFor = (encounterIndex: number, zoneLevel = 1): SoloEnemyStats => {
  const encounter = Math.max(0, Math.min(SOLO_COMBAT_BALANCE.totalEncounters - 1, Math.floor(encounterIndex)));
  const zone = Math.max(1, Math.floor(zoneLevel));
  const zoneScale = 1 + (zone - 1) * 0.16;
  return {
    hp: Math.round((SOLO_COMBAT_BALANCE.enemyBaseHp + encounter * SOLO_COMBAT_BALANCE.enemyHpStep) * zoneScale),
    attack: Math.round((SOLO_COMBAT_BALANCE.enemyBaseAttack + encounter * SOLO_COMBAT_BALANCE.enemyAttackStep) * (1 + (zone - 1) * 0.1)),
    defense: Math.round(SOLO_COMBAT_BALANCE.enemyBaseDefense + encounter * SOLO_COMBAT_BALANCE.enemyDefenseStep + (zone - 1) * 0.75),
  };
};

export const aldricAttackDamage = (hero: Hero, enemyDefense: number): number => {
  const raw = Math.max(
    1,
    Math.round(hero.stats.attack * SOLO_COMBAT_BALANCE.playerAttackMultiplier) + SOLO_COMBAT_BALANCE.playerAttackFlatDamage,
  );
  return mitigateDamage(raw, enemyDefense);
};

export const ghoulAttackDamage = (attack: number, hero: Hero): number => mitigateDamage(attack, hero.stats.defense);

export const encounterRewards = (encounterIndex: number, zoneLevel = 1): { gold: number; shards: number } => ({
  gold: Math.round(SOLO_COMBAT_BALANCE.goldPerEncounter * Math.max(1, zoneLevel) * (1 + encounterIndex * 0.12)),
  shards: encounterIndex === SOLO_COMBAT_BALANCE.totalEncounters - 1 ? 1 : 0,
});

export const zoneClearRewards = (zoneLevel = 1): { gold: number; shards: number } => ({
  gold: SOLO_COMBAT_BALANCE.zoneClearGold * Math.max(1, Math.floor(zoneLevel)),
  shards: SOLO_COMBAT_BALANCE.zoneClearShards,
});
