import type { Hero } from './Hero';

export class Party {
  constructor(public id: string, public heroes: Hero[]) {
    if (heroes.length > 4) throw new Error('A party may contain at most 4 heroes.');
  }

  get averageLevel(): number {
    if (!this.heroes.length) return 0;
    return this.heroes.reduce((sum, hero) => sum + hero.level, 0) / this.heroes.length;
  }

  get livingHeroes(): Hero[] { return this.heroes.filter((hero) => hero.alive); }
}
