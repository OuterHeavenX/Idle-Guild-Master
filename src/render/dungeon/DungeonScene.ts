import { Container, Graphics } from 'pixi.js';
import type { EventBus } from '../../core/EventBus';
import type { StateManager } from '../../core/StateManager';
import type { CombatSystem } from '../../systems/CombatSystem';
import { HeroActor } from './HeroActor';
import { EnemyActor } from './EnemyActor';
import { DungeonHud } from './DungeonHud';
import { LootFeed } from './LootFeed';
import { CombatEffects } from '../effects/CombatEffects';

export class DungeonScene extends Container {
  private env = new Container(); private actors = new Container(); private ambient = new Container();
  private heroes: HeroActor[]=[]; private enemy=new EnemyActor(); private hud: DungeonHud; private feed=new LootFeed(); private fx=new CombatEffects(); private time=0; private sceneWidth=1; private sceneHeight=1;
  constructor(private state: StateManager, private combat: CombatSystem, private bus: EventBus){ super(); this.hud=new DungeonHud(state,combat); this.addChild(this.env,this.ambient,this.actors,this.fx.container,this.hud,this.feed); this.drawEnvironment(); state.heroes.slice(0,4).forEach((h,i)=>{const a=new HeroActor(state,h.id,i);this.heroes.push(a);this.actors.addChild(a);}); this.actors.addChild(this.enemy); this.bind(); }
  resize(width:number,height:number):void{ this.sceneWidth=width;this.sceneHeight=height;this.drawEnvironment(); const y=height*.62; const pts:[[number,number],[number,number],[number,number],[number,number]]=[[width*.19,y],[width*.36,y+35],[width*.24,y+82],[width*.43,y+86]]; this.heroes.forEach((h,i)=>{const p=pts[i]!;h.position.set(p[0],p[1]);}); this.enemy.position.set(width*.72,height*.47); this.feed.position.set(10,height*.73); this.feed.resize(Math.min(180,width*.47)); this.hud.update(width,height); }
  update(dt:number):void{ this.time+=dt; this.heroes.forEach(h=>h.update(dt)); this.enemy.update(dt); this.fx.update(dt); this.ambient.y=Math.sin(this.time*.18)*3; this.hud.update(this.sceneWidth,this.sceneHeight); }
  private drawEnvironment():void{ this.env.removeChildren().forEach(c=>c.destroy()); this.ambient.removeChildren().forEach(c=>c.destroy()); const w=this.sceneWidth,h=this.sceneHeight; const bg=new Graphics().rect(0,0,w,h).fill(0x0b0d16); const arch=new Graphics().roundRect(w*.08,h*.09,w*.84,h*.65,w*.18).fill(0x171826).stroke({color:0x38364a,width:5}); const inner=new Graphics().roundRect(w*.15,h*.16,w*.7,h*.53,w*.14).fill(0x0d101c); const floor=new Graphics().moveTo(0,h*.46).lineTo(w,h*.46).lineTo(w,h).lineTo(0,h).fill(0x17161d); for(let i=0;i<8;i++){floor.moveTo(i*w/7,h*.46).lineTo(w*.5+(i-3.5)*w*.12,h).stroke({color:0x2c2931,width:1,alpha:.65});} for(let j=0;j<5;j++){const yy=h*.49+j*h*.105;floor.moveTo(0,yy).lineTo(w,yy).stroke({color:0x2b2930,width:1,alpha:.55});}
    floor.moveTo(w*.54,h*.55).lineTo(w*.49,h*.61).lineTo(w*.57,h*.67).lineTo(w*.51,h*.74).stroke({color:0x08090d,width:3,alpha:.75});
    const pillars=new Graphics(); [w*.11,w*.87].forEach(x=>{pillars.rect(x-14,h*.16,28,h*.42).fill(0x25242e).stroke({color:0x45424d,width:2}).rect(x-20,h*.13,40,13).fill(0x302f39).rect(x-20,h*.57,40,12).fill(0x302f39);});
    const statue=new Graphics().circle(w*.73,h*.25,10).fill(0x33323a).roundRect(w*.69,h*.27,w*.08,h*.12,8).fill(0x2b2a32).moveTo(w*.7,h*.39).lineTo(w*.66,h*.45).lineTo(w*.78,h*.45).fill(0x26252d);
    const chains=new Graphics(); for(let k=0;k<3;k++){const x=w*(.22+k*.27);chains.moveTo(x,0).bezierCurveTo(x-8,h*.12,x+10,h*.2,x,h*.3).stroke({color:0x48424a,width:2,alpha:.75});}
    const torches=new Graphics(); [w*.19,w*.81].forEach(x=>{torches.moveTo(x,h*.26).lineTo(x,h*.36).stroke({color:0x5d4937,width:4}).circle(x,h*.25,8).fill({color:0xff7b35,alpha:.75}).circle(x,h*.25,16).fill({color:0xff8d3b,alpha:.12});});
    this.env.addChild(bg,arch,inner,floor,pillars,statue,chains,torches); const fog=new Graphics(); for(let i=0;i<7;i++)fog.ellipse(w*(.08+i*.15),h*(.42+(i%2)*.08),80,18).fill({color:0x8a89b5,alpha:.025}); const ash=new Graphics(); for(let i=0;i<35;i++)ash.circle(Math.random()*w,Math.random()*h,Math.random()*1.4+.4).fill({color:i%4===0?0xf1aa62:0xb8b2c5,alpha:.18}); this.ambient.addChild(fog,ash); }
  private heroPos(id:string):[number,number]{const h=this.heroes.find(x=>x.heroId===id);return h?[h.x,h.y-25]:[this.sceneWidth*.3,this.sceneHeight*.6];}
  private bind():void{
    this.bus.on('combat:damage',({sourceId,targetId,amount,crit,style})=>{ if(sourceId.startsWith('hero-')){const h=this.heroes.find(x=>x.heroId===sourceId);h?.playAttack();const [sx,sy]=this.heroPos(sourceId); if(style==='projectile'||style==='spell')this.fx.projectile(sx+18,sy,this.enemy.x-12,this.enemy.y-30,style==='spell'); this.enemy.playHurt();this.fx.damage(this.enemy.x,this.enemy.y-70,amount,crit);this.fx.impact(this.enemy.x-8,this.enemy.y-28,style==='spell'?0x789cff:0xffb56b);} else if(sourceId==='status-burn'){this.fx.damage(this.enemy.x,this.enemy.y-72,amount,false);} else {this.enemy.playAttack();const hero=this.heroes.find(x=>x.heroId===targetId);hero?.playHit();const [x,y]=this.heroPos(targetId);this.fx.damage(x,y-40,amount,false);} });
    this.bus.on('combat:heal',({targetId,amount})=>{const [x,y]=this.heroPos(targetId);this.fx.heal(x,y-42,amount);});
    this.bus.on('combat:status',({status,active})=>{if(active)this.fx.status(this.enemy.x,this.enemy.y-25,status);});
    this.bus.on('combat:enemy-death',()=>{this.enemy.playDeath();this.fx.loot(this.enemy.x,this.enemy.y-10);});
    this.bus.on('combat:enemy-spawn',()=>this.enemy.reset());
    this.bus.on('loot:drop',({itemName,rarity,gold})=>{this.feed.add(gold?`+${gold} Gold · ${itemName}`:itemName,rarity!=='common');});
    this.bus.on('progress:zone-ready',()=>this.feed.add('Zone cleared — NEXT ZONE unlocked',true));
  }
}
