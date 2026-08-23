import { Hero, createStarterHero, type HeroSave } from '../models/Hero';
import { Guild, type GuildSave } from '../models/Guild';
import { EventBus } from './EventBus';

export interface GameSave {
  version: 1;
  savedAt: number;
  heroes: HeroSave[];
  guild: GuildSave;
  activeView: string;
  zoneLevel: number;
}

const SAVE_KEY = 'idle-guild-master-save-v1';

export class StateManager {
  heroes: Hero[];
  guild: Guild;
  activeView = 'dungeon';
  zoneLevel = 1;

  constructor(private bus: EventBus) {
    this.heroes = [
      createStarterHero('hero-1', 'Aldric', 'guardian'),
      createStarterHero('hero-2', 'Mira', 'cleric'),
      createStarterHero('hero-3', 'Nyx', 'ranger'),
      createStarterHero('hero-4', 'Orin', 'arcanist'),
      createStarterHero('hero-5', 'Bran', 'guardian'),
      createStarterHero('hero-6', 'Elowen', 'cleric'),
      createStarterHero('hero-7', 'Kael', 'ranger'),
      createStarterHero('hero-8', 'Veyra', 'arcanist')
    ];
    this.guild = new Guild();
  }

  snapshot(): GameSave {
    return {
      version: 1,
      savedAt: Date.now(),
      heroes: this.heroes.map((hero) => ({ ...hero, stats: { ...hero.stats }, equipment: { ...hero.equipment } })),
      guild: {
        gold: this.guild.gold,
        gems: this.guild.gems,
        shards: this.guild.shards,
        essences: this.guild.essences,
        facilities: { ...this.guild.facilities }
      },
      activeView: this.activeView,
      zoneLevel: this.zoneLevel
    };
  }

  save(): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot()));
    this.bus.emit('save:complete', undefined);
  }

  load(): GameSave | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as GameSave;
    this.apply(save);
    return save;
  }

  apply(save: GameSave): void {
    this.heroes = save.heroes.map((hero) => {
      const normalized = {
        ...hero,
        currentHp: Math.max(0, Math.min(hero.stats.maxHp, Number.isFinite(hero.currentHp) ? hero.currentHp : hero.stats.maxHp)),
      };
      return new Hero(normalized);
    });
    this.guild = new Guild(save.guild);
    this.activeView = save.activeView;
    this.zoneLevel = Math.max(1, Math.floor(save.zoneLevel || 1));

    // A reload during the short defeat countdown must never strand the active party at 0 HP.
    const activeParty = this.heroes.slice(0, 4);
    if (activeParty.length > 0 && activeParty.every((hero) => !hero.alive)) {
      activeParty.forEach((hero) => hero.heal(hero.stats.maxHp));
    }
  }

  exportJson(): string { return JSON.stringify(this.snapshot()); }

  importJson(raw: string): void {
    const parsed = JSON.parse(raw) as GameSave;
    if (parsed.version !== 1 || !Array.isArray(parsed.heroes)) throw new Error('Unsupported or invalid save data.');
    this.apply(parsed);
    this.save();
  }
}
