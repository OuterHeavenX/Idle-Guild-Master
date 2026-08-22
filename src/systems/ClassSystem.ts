import { classById } from '../config/classes.config';
import { jpRequiredForJobLevel } from '../math/XpCalculations';
import type { Hero } from '../models/Hero';

export class ClassSystem {
  addJobPoints(hero: Hero, amount: number): void {
    hero.jp += amount;
    while (hero.jobLevel < 10) {
      const job = classById(hero.jobId);
      const cost = jpRequiredForJobLevel(hero.jobLevel + 1, job.tier);
      if (hero.jp < cost) break;
      hero.jp -= cost;
      hero.jobLevel += 1;
    }
    if (hero.jobLevel >= 10) {
      const mastery = classById(hero.jobId).masteryPassive;
      if (!hero.masteryPassives.includes(mastery)) hero.masteryPassives.push(mastery);
    }
  }

  canPromote(hero: Hero, nextClassId: string): boolean {
    const next = classById(nextClassId);
    return hero.jobLevel >= 10 && next.parentId === hero.jobId;
  }

  promote(hero: Hero, nextClassId: string): void {
    if (!this.canPromote(hero, nextClassId)) throw new Error('Promotion requirements not met.');
    hero.jobId = nextClassId;
    hero.jobLevel = 1;
    hero.jp = 0;
  }
}
