export interface HeroStats {
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number;
  blockChance: number;
  haste: number;
}

export interface HeroSave {
  id: string;
  name: string;
  level: number;
  xp: number;
  jobId: string;
  jobLevel: number;
  jp: number;
  masteryPassives: string[];
  stats: HeroStats;
  currentHp: number;
  equipment: Record<string, string | null>;
}

export class Hero implements HeroSave {
  id: string;
  name: string;
  level: number;
  xp: number;
  jobId: string;
  jobLevel: number;
  jp: number;
  masteryPassives: string[];
  stats: HeroStats;
  currentHp: number;
  equipment: Record<string, string | null>;

  constructor(data: HeroSave) {
    this.id = data.id;
    this.name = data.name;
    this.level = data.level;
    this.xp = data.xp;
    this.jobId = data.jobId;
    this.jobLevel = data.jobLevel;
    this.jp = data.jp;
    this.masteryPassives = [...data.masteryPassives];
    this.stats = { ...data.stats };
    this.currentHp = data.currentHp;
    this.equipment = { ...data.equipment };
  }

  get alive(): boolean { return this.currentHp > 0; }
  receiveDamage(amount: number): void { this.currentHp = Math.max(0, this.currentHp - amount); }
  heal(amount: number): void { this.currentHp = Math.min(this.stats.maxHp, this.currentHp + amount); }
}

export const createStarterHero = (id: string, name: string, jobId = 'novice'): Hero =>
  new Hero({
    id, name, level: 1, xp: 0, jobId, jobLevel: 1, jp: 0, masteryPassives: [],
    stats: { maxHp: 120, attack: 18, defense: 10, critChance: 0.08, blockChance: 0.05, haste: 0 },
    currentHp: 120,
    equipment: { weapon: null, armor: null, accessory: null }
  });
