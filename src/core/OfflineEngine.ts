import { expeditionOfflineCapHours } from '../config/town.config';

export interface OfflineResult {
  elapsedHours: number;
  creditedHours: number;
  gold: number;
}

export class OfflineEngine {
  calculate(savedAt: number, now: number, baseZoneRate: number, averagePartyLevel: number, zoneLevel: number, guildModifier: number, expeditionHQLevel: number): OfflineResult {
    const elapsedHours = Math.max(0, (now - savedAt) / 3_600_000);
    const creditedHours = Math.min(elapsedHours, expeditionOfflineCapHours(expeditionHQLevel));
    const perHour = baseZoneRate * (1 + averagePartyLevel / Math.max(1, zoneLevel)) * guildModifier;
    return { elapsedHours, creditedHours, gold: Math.floor(perHour * creditedHours) };
  }
}
