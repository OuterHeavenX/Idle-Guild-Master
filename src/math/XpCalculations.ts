import { TIER_FACTORS, type ClassTier } from '../config/classes.config';

export const xpRequiredForLevel = (level: number): number =>
  level <= 1 ? 0 : Math.floor(100 * Math.pow(level - 1, 1.65));

export const jpRequiredForJobLevel = (jobLevel: number, tier: ClassTier): number =>
  Math.floor(50 * Math.pow(Math.max(1, jobLevel), 1.8) * TIER_FACTORS[tier]);
