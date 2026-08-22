import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { CombatSystem } from '../../systems/CombatSystem';

export class ActiveHeroControls extends Container {
  private button = new Graphics();
  private label = new Text({
    text: 'SHIELD BASH',
    style: new TextStyle({ fontFamily: 'system-ui', fontSize: 9, fontWeight: '800', fill: 0xf3eadf, letterSpacing: 0.5 }),
  });
  private hint = new Text({
    text: 'DRAG ALDRIC',
    style: new TextStyle({ fontFamily: 'system-ui', fontSize: 8, fontWeight: '700', fill: 0xc9c1cb, letterSpacing: 0.4 }),
  });

  constructor(private combat: CombatSystem, private heroId: string, onActivate: () => void) {
    super();
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.label.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.addChild(this.button, this.label, this.hint);
    this.on('pointertap', onActivate);
  }

  layout(width: number, height: number): void {
    this.position.set(width - 64, height - 118);
    this.redraw();
  }

  update(): void { this.redraw(); }

  private redraw(): void {
    const cooldown = this.combat.getActiveSkillCooldown(this.heroId);
    const ready = cooldown <= 0 && !this.combat.recovering && !this.combat.canAdvanceZone;
    this.button.clear()
      .roundRect(-52, -20, 104, 40, 11)
      .fill({ color: ready ? 0x273846 : 0x171a20, alpha: 0.9 })
      .stroke({ color: ready ? 0x9cb4c3 : 0x55505a, width: 1, alpha: 0.9 });
    this.label.text = ready ? 'SHIELD BASH' : cooldown > 0 ? `SHIELD BASH · ${cooldown}s` : 'SHIELD BASH';
    this.label.alpha = ready ? 1 : 0.55;
    this.label.position.set(0, -3);
    this.hint.position.set(0, -30);
    this.hint.alpha = 0.72;
  }
}
