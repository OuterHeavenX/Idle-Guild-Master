import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import type { CombatSystem } from '../../systems/CombatSystem';

const classMeta: Record<string, { mark: string; color: number }> = {
  guardian: { mark: '◆', color: 0x9cb4c3 },
  cleric: { mark: '✦', color: 0xffdf83 },
  ranger: { mark: '➶', color: 0x8fa879 },
  arcanist: { mark: '✧', color: 0x9a85df },
};

export class DungeonHud extends Container {
  private enemyBar = new Graphics();
  private zoneText = new Text({ text: '', style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: '700', fill: 0xe8d7ba, letterSpacing: 1.1 }) });
  private enemyText = new Text({ text: '', style: new TextStyle({ fontFamily: 'system-ui', fontSize: 12, fontWeight: '800', fill: 0xf4ece0, letterSpacing: 0.3 }) });
  private waveText = new Text({ text: '', style: new TextStyle({ fontFamily: 'system-ui', fontSize: 10, fontWeight: '700', fill: 0xbcb2c5 }) });
  private heroBars: Graphics[] = [];
  private heroTexts: Text[] = [];

  constructor(private state: StateManager, private combat: CombatSystem) {
    super();
    this.addChild(this.enemyBar, this.zoneText, this.enemyText, this.waveText);
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      const t = new Text({ text: '', style: new TextStyle({ fontFamily: 'system-ui', fontSize: 9, fontWeight: '700', fill: 0xe7ded2 }) });
      this.heroBars.push(g);
      this.heroTexts.push(t);
      this.addChild(g, t);
    }
  }

  update(width: number, height: number): void {
    const enemy = this.combat.currentEnemy;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    this.zoneText.text = `ASHEN CRYPT · ZONE ${this.state.zoneLevel}`;
    this.zoneText.position.set(12, 9);
    this.enemyText.text = `${enemy.name.toUpperCase()}   LV.${enemy.level}`;
    this.enemyText.position.set(12, 29);
    this.waveText.text = `WAVE ${this.combat.wave} / 10`;
    this.waveText.anchor.set(1, 0);
    this.waveText.position.set(width - 12, 11);

    const barW = Math.min(width - 24, 390);
    this.enemyBar.clear()
      .roundRect(12, 47, barW, 10, 5).fill({ color: 0x160e12, alpha: 0.88 })
      .roundRect(14, 49, Math.max(0, (barW - 4) * ratio), 6, 3).fill(0xb84d47)
      .stroke({ color: 0xe0a079, width: 1, alpha: 0.28 });

    const heroes = this.state.heroes.slice(0, 4);
    const gap = 6;
    const cardW = (width - 26 - gap) / 2;
    const baseY = height - 70;
    heroes.forEach((hero, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 10 + col * (cardW + gap);
      const y = baseY + row * 30;
      const hp = Math.max(0, hero.currentHp / hero.stats.maxHp);
      const meta = classMeta[hero.jobId] ?? classMeta.guardian!;
      const g = this.heroBars[i]!;
      g.clear()
        .roundRect(x, y, cardW, 25, 7).fill({ color: 0x080a10, alpha: 0.72 }).stroke({ color: 0x4b4351, width: 1, alpha: 0.65 })
        .circle(x + 11, y + 9, 6).fill({ color: meta.color, alpha: 0.18 }).stroke({ color: meta.color, width: 1, alpha: 0.65 })
        .roundRect(x + 7, y + 18, cardW - 14, 4, 2).fill({ color: 0x25171d, alpha: 0.9 })
        .roundRect(x + 7, y + 18, (cardW - 14) * hp, 4, 2).fill(hp > 0.35 ? 0x67a66f : 0xbf514d);
      const t = this.heroTexts[i]!;
      t.text = `${meta.mark}  ${hero.name} · ${hero.jobId}`;
      t.position.set(x + 5, y + 3);
      t.alpha = hero.currentHp > 0 ? 1 : 0.48;
    });
  }
}
