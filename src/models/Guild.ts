import type { FacilityId } from '../config/town.config';

export interface GuildSave {
  gold: number;
  gems: number;
  shards: number;
  essences: number;
  facilities: Record<FacilityId, number>;
}

export class Guild implements GuildSave {
  gold: number;
  gems: number;
  shards: number;
  essences: number;
  facilities: Record<FacilityId, number>;

  constructor(data?: Partial<GuildSave>) {
    this.gold = data?.gold ?? 500;
    this.gems = data?.gems ?? 0;
    this.shards = data?.shards ?? 0;
    this.essences = data?.essences ?? 0;
    this.facilities = data?.facilities ?? {
      guildHall: 1,
      forge: 1,
      alchemy: 1,
      trainingGrounds: 1,
      expeditionHQ: 1
    };
  }
}
