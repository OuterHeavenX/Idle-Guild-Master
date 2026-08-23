import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import type { CombatSnapshot, CombatSystem } from '../../systems/CombatSystem';

const labelStyle = new TextStyle({
  fontFamily: 'system-ui',
  fontSize: 10,
  fontWeight: '800',
  fill: 0xf1e8dc,
  letterSpacing: 0.35,
});

export class DungeonHud extends Container {
  private bars = new Graphics();
  private zoneText = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: '700', fill: 0xe8d7ba, letterSpacing: 1.1 }),
  });
  private encounterText = new Text({ text: '', style: labelStyle });
  private enemyText = new Text({ text: '', style: labelStyle });
  private playerText = new Text({ text: '', style: labelStyle });
  private guardText = new Text({ text: '', style: labelStyle });
  private phaseText = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: '700', fill: 0xf0c985, letterSpacing: 1.4 }),
  });

  constructor(private state: StateManager, private combat: CombatSystem) {
    super();
    this.encounterText.anchor.set(1, 0);
    this.guardText.anchor.set(1, 0);
    this.phaseText.anchor.set(0.5);
    this.addChild(this.bars, this.zoneText, this.encounterText, this.enemyText, this.playerText, this.guardText, this.phaseText);
  }

  update(width: number, height: number, supplied?: CombatSnapshot): void {
    const snapshot = supplied ?? this.combat.snapshot;
    const enemyRatio = Math.max(0, Math.min(1, snapshot.enemy.hp / Math.max(1, snapshot.enemy.maxHp)));
    const playerRatio = Math.max(0, Math.min(1, snapshot.player.hp / Math.max(1, snapshot.player.maxHp)));
    const guardRatio = Math.max(0, Math.min(1, snapshot.player.guard / Math.max(1, snapshot.player.maxGuard)));
    const barWidth = Math.min(width - 24, 430);
    const halfWidth = Math.max(118, Math.min(205, (barWidth - 8) / 2));

    this.zoneText.text = `ASHEN CRYPT · ZONE ${snapshot.zoneLevel || this.state.zoneLevel}`;
    this.zoneText.position.set(12, 9);
    this.encounterText.text = `ENCOUNTER ${snapshot.encounter} / ${snapshot.totalEncounters}`;
    this.encounterText.position.set(width - 12, 10);
    this.enemyText.text = `${snapshot.enemy.name.toUpperCase()}   ${Math.ceil(snapshot.enemy.hp)} / ${snapshot.enemy.maxHp}`;
    this.enemyText.position.set(12, 29);
    this.playerText.text = `${snapshot.player.name.toUpperCase()}   ${Math.ceil(snapshot.player.hp)} / ${snapshot.player.maxHp}`;
    this.playerText.position.set(12, 67);
    this.guardText.text = snapshot.player.guardBroken ? 'GUARD BROKEN' : `GUARD ${Math.ceil(snapshot.player.guard)}`;
    this.guardText.style.fill = snapshot.player.guardBroken ? 0xef7b6c : 0xc6dfeb;
    this.guardText.position.set(Math.min(width - 12, 12 + halfWidth * 2 + 8), 67);

    this.bars.clear()
      .roundRect(12, 47, barWidth, 10, 5).fill({ color: 0x170e13, alpha: 0.92 })
      .roundRect(14, 49, Math.max(0, (barWidth - 4) * enemyRatio), 6, 3).fill(0xc3544e)
      .roundRect(12, 84, halfWidth, 9, 4).fill({ color: 0x10201d, alpha: 0.92 })
      .roundRect(14, 86, Math.max(0, (halfWidth - 4) * playerRatio), 5, 3).fill(playerRatio > 0.25 ? 0x68aa78 : 0xc95752)
      .roundRect(20 + halfWidth, 84, halfWidth, 9, 4).fill({ color: 0x111b24, alpha: 0.92 })
      .roundRect(22 + halfWidth, 86, Math.max(0, (halfWidth - 4) * guardRatio), 5, 3).fill(snapshot.player.guardBroken ? 0xb34d4b : 0x73aeca);

    this.phaseText.text = snapshot.phase === 'defeat'
      ? 'ALDRIC FALLS'
      : snapshot.phase === 'victory'
        ? 'UPPER CRYPT CLEARED'
        : snapshot.phase === 'between'
          ? `GHOUL ${snapshot.completedEncounters} DEFEATED`
          : '';
    this.phaseText.position.set(width / 2, height * 0.28);
    this.phaseText.visible = Boolean(this.phaseText.text);
    this.alpha = snapshot.active ? 1 : 0.55;
  }
}
