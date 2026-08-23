import { classById } from '../../config/classes.config';
import type { Hero } from '../../models/Hero';

export const COMBAT_BALANCE = {
  criticalMultiplier: 1.5,
  defeatRecoveryTicks: 3,
  waveRecoveryFraction: 0.03,
  zoneRecoveryFraction: 1,
  burnTicks: 3,
  burnBaseDamage: 7,
  enemyBaseHp: 310,
  enemyBaseAttack: 14,
  enemyBaseDefense: 8,
  zoneHpStep: 0.22,
  zoneAttackStep: 0.36,
  zoneDefenseStep: 1.5,
  waveHpStep: 0.025,
  waveAttackStep: 0.025,
  waveDefenseStep: 0.25,
  guardianIncomingDamageMultiplier: 0.7,
  guardianTargetWeight: 4,
  clericTargetWeight: 0.8,
  rangerTargetWeight: 1.15,
  arcanistTargetWeight: 1,
  guardianDamageMultiplier: 0.85,
  clericDamageMultiplier: 0.6,
  rangerDamageMultiplier: 1.2,
  arcanistDamageMultiplier: 1,
  clericHealBase: 10,
  clericHealAttackCoefficient: 0.55,
  goldBase: 20,
  goldZoneStep: 0.18,
  goldWaveStep: 0.03,
  shardWaveInterval: 5,
  zoneClearGoldBase: 100,
  zoneClearShardReward: 1,
} as const;

export interface EnemyBalanceStats {
  hp: number;
  attack: number;
  defense: number;
}

export const enemyStatsFor = (zoneLevel: number, wave: number): EnemyBalanceStats => {
  const zone = Math.max(1, Math.floor(zoneLevel));
  const safeWave = Math.max(1, Math.min(10, Math.floor(wave)));
  const hp = Math.round(
    COMBAT_BALANCE.enemyBaseHp *
      (1 + COMBAT_BALANCE.zoneHpStep * (zone - 1)) *
      (1 + COMBAT_BALANCE.waveHpStep * (safeWave - 1)),
  );
  const attack = Math.round(
    COMBAT_BALANCE.enemyBaseAttack *
      (1 + COMBAT_BALANCE.zoneAttackStep * (zone - 1)) *
      (1 + COMBAT_BALANCE.waveAttackStep * (safeWave - 1)),
  );
  const defense = Math.round(
    COMBAT_BALANCE.enemyBaseDefense +
      COMBAT_BALANCE.zoneDefenseStep * (zone - 1) +
      COMBAT_BALANCE.waveDefenseStep * (safeWave - 1),
  );
  return { hp, attack, defense };
};

export const heroDamageMultiplier = (hero: Hero): number => {
  switch (hero.jobId) {
    case 'guardian': return COMBAT_BALANCE.guardianDamageMultiplier;
    case 'cleric': return COMBAT_BALANCE.clericDamageMultiplier;
    case 'ranger': return COMBAT_BALANCE.rangerDamageMultiplier;
    case 'arcanist': return COMBAT_BALANCE.arcanistDamageMultiplier;
    default: return 1;
  }
};

export const incomingDamageMultiplier = (hero: Hero): number =>
  classById(hero.jobId).role === 'tank' ? COMBAT_BALANCE.guardianIncomingDamageMultiplier : 1;

export const targetWeightFor = (hero: Hero): number => {
  switch (hero.jobId) {
    case 'guardian': return COMBAT_BALANCE.guardianTargetWeight;
    case 'cleric': return COMBAT_BALANCE.clericTargetWeight;
    case 'ranger': return COMBAT_BALANCE.rangerTargetWeight;
    case 'arcanist': return COMBAT_BALANCE.arcanistTargetWeight;
    default: return 1;
  }
};

export const clericHealAmount = (attack: number): number =>
  COMBAT_BALANCE.clericHealBase + Math.floor(attack * COMBAT_BALANCE.clericHealAttackCoefficient);

export const burnDamageFor = (zoneLevel: number): number =>
  COMBAT_BALANCE.burnBaseDamage + Math.max(1, Math.floor(zoneLevel));

export const rewardsForEnemy = (zoneLevel: number, wave: number): { gold: number; shards: number } => {
  const zone = Math.max(1, Math.floor(zoneLevel));
  const safeWave = Math.max(1, Math.min(10, Math.floor(wave)));
  return {
    gold: Math.max(1, Math.round(
      COMBAT_BALANCE.goldBase *
        (1 + COMBAT_BALANCE.goldZoneStep * (zone - 1)) *
        (1 + COMBAT_BALANCE.goldWaveStep * (safeWave - 1)),
    )),
    shards: safeWave % COMBAT_BALANCE.shardWaveInterval === 0 ? 1 : 0,
  };
};

export const zoneClearRewards = (zoneLevel: number): { gold: number; shards: number } => ({
  gold: COMBAT_BALANCE.zoneClearGoldBase * Math.max(1, Math.floor(zoneLevel)),
  shards: COMBAT_BALANCE.zoneClearShardReward,
});
