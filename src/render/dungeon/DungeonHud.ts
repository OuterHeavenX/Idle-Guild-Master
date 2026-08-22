import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { StateManager } from '../../core/StateManager';
import type { CombatSystem } from '../../systems/CombatSystem';

export class DungeonHud extends Container {
  private enemyBar = new Graphics(); private zoneText = new Text({ text: '', style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: '700', fill: 0xf2dfbd, letterSpacing: 1 }) });
  private enemyText = new Text({ text: '', style: new TextStyle({ fontFamily: 'system-ui', fontSize: 13, fontWeight: '700', fill: 0xf2e8db }) });
  private waveText = new Text({ text: '', style: new TextStyle({ fontFamily: 'system-ui', fontSize: 11, fill: 0xbeb4c5 }) });
  private heroBars: Graphics[] = []; private heroTexts: Text[] = [];
  constructor(private state: StateManager, private combat: CombatSystem) { super(); this.addChild(this.enemyBar, this.zoneText, this.enemyText, this.waveText); for (let i=0;i<4;i++){ const g=new Graphics(); const t=new Text({text:'',style:new TextStyle({fontFamily:'system-ui',fontSize:10,fill:0xddd4c9})}); this.heroBars.push(g); this.heroTexts.push(t); this.addChild(g,t);} }
  update(width: number, height: number): void {
    const e = this.combat.currentEnemy; const ratio = Math.max(0, e.hp/e.maxHp); this.zoneText.text=`ASHEN CRYPT — ZONE ${this.state.zoneLevel}`; this.zoneText.position.set(12,10); this.enemyText.text=`${e.name}  Lv.${e.level}`; this.enemyText.position.set(12,34); this.waveText.text=`Wave ${this.combat.wave} / 10`; this.waveText.anchor.set(1,0); this.waveText.position.set(width-12,13);
    const barW=width-24; this.enemyBar.clear().roundRect(12,54,barW,15,7).fill({color:0x160e12,alpha:.9}).roundRect(14,56,(barW-4)*ratio,11,5).fill(0xb7433f).stroke({color:0xd98769,width:1,alpha:.45});
    const heroes=this.state.heroes.slice(0,4); const cardW=(width-30)/2; heroes.forEach((h,i)=>{ const col=i%2,row=Math.floor(i/2),x=10+col*(cardW+10),y=height-91+row*39,r=Math.max(0,h.currentHp/h.stats.maxHp); const g=this.heroBars[i]!; g.clear().roundRect(x,y,cardW,32,8).fill({color:0x0b0c12,alpha:.82}).stroke({color:0x4d4454,width:1}).circle(x+10,y+10,4).fill(h.jobId==='guardian'?0x91a7b3:h.jobId==='cleric'?0xffdf83:h.jobId==='ranger'?0x7e9d6c:0x8c75d1).roundRect(x+8,y+20,cardW-16,5,3).fill(0x271720).roundRect(x+8,y+20,(cardW-16)*r,5,3).fill(r>.35?0x5fa66d:0xbf4c48); const t=this.heroTexts[i]!; t.text=`  ${h.name} · ${h.jobId.toUpperCase()}`; t.position.set(x+8,y+5); });
  }
}
