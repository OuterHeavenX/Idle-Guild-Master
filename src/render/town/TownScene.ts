import {Assets,Container,Graphics,Sprite,Text,TextStyle} from 'pixi.js';
import type {StateManager} from '../../core/StateManager';
export interface TownTarget{id:string;label:string;x:number;y:number;r:number}
const targets:TownTarget[]=[{id:'steward',label:'TALK',x:.50,y:.25,r:.10},{id:'party',label:'TALK',x:.27,y:.48,r:.12},{id:'blacksmith',label:'TALK',x:.76,y:.48,r:.11},{id:'board',label:'READ',x:.35,y:.30,r:.08},{id:'crypt',label:'ENTER',x:.50,y:.08,r:.11}];
export class TownScene extends Container{
 private player=new Sprite();private w=1;private h=1;private vx=0;private vy=0;private speed=.22;private target:TownTarget|null=null;private onTarget:(t:TownTarget|null)=>void=()=>{};
 constructor(private state:StateManager){super();this.visible=false;this.build();}
 private async build(){const bg=new Graphics();bg.rect(0,0,1000,1500).fill(0x6f765f);bg.rect(110,170,780,1150).fill(0x887d61);bg.rect(400,80,200,1240).fill(0x9a8b6a);bg.rect(80,180,300,220).fill(0x40382f);bg.rect(620,380,300,260).fill(0x4a392b);bg.rect(70,650,270,220).fill(0x493c31);bg.rect(610,700,320,210).fill(0x46392e);bg.circle(500,710,105).fill(0x536e71);bg.circle(500,710,82).fill(0x253f49);this.addChild(bg);
  const style=new TextStyle({fontFamily:'Georgia',fontSize:28,fill:0xf5e2b7,stroke:{color:0x211810,width:4}});[['GUILD HALL',230,240],['BLACKSMITH',700,500],['NOTICE BOARD',250,470],['ASHEN CRYPT',415,105]].forEach(([s,x,y])=>this.addChild(Object.assign(new Text({text:String(s),style}),{x:Number(x),y:Number(y)})));
  for(const t of targets){if(t.id==='steward'||t.id==='party'||t.id==='blacksmith'){const g=new Graphics();g.circle(0,0,t.id==='party'?28:32).fill(t.id==='blacksmith'?0x6f3b26:0x352f39);g.circle(0,-28,18).fill(0xc69b78);g.x=t.x*1000;g.y=t.y*1500;this.addChild(g);}}
  await Assets.load('assets/dungeon/ashen-crypt/heroes/guardian.svg');this.player=Sprite.from('assets/dungeon/ashen-crypt/heroes/guardian.svg');this.player.anchor.set(.5,.82);this.player.width=86;this.player.height=112;this.addChild(this.player);this.syncPlayer();}
 setTargetListener(fn:(t:TownTarget|null)=>void){this.onTarget=fn;}
 setInput(x:number,y:number){this.vx=x;this.vy=y;}
 resize(w:number,h:number){this.w=w;this.h=h;const scale=Math.max(w/1000,h/1500);this.scale.set(scale);this.x=(w-1000*scale)/2;this.y=(h-1500*scale)/2;}
 private syncPlayer(){this.player.x=this.state.story.playerX*1000;this.player.y=this.state.story.playerY*1500;}
 update(dt:number){if(!this.visible)return;let x=this.state.story.playerX+this.vx*this.speed*dt,y=this.state.story.playerY+this.vy*this.speed*dt;x=Math.max(.08,Math.min(.92,x));y=Math.max(.12,Math.min(.88,y));
  const blocks=[[.08,.18,.38,.40],[.62,.38,.92,.64],[.07,.65,.34,.87],[.61,.70,.93,.91]];const inside=blocks.some(b=>x>b[0]&&x<b[2]&&y>b[1]&&y<b[3]);if(!inside){this.state.story.playerX=x;this.state.story.playerY=y;}this.syncPlayer();if(this.vx<-.05)this.player.scale.x=-Math.abs(this.player.scale.x||1);else if(this.vx>.05)this.player.scale.x=Math.abs(this.player.scale.x||1);
  let best:TownTarget|null=null,bd=Infinity;for(const t of targets){const d=Math.hypot(x-t.x,(y-t.y)*1.5);if(d<t.r&&d<bd){best=t;bd=d;}}if(best?.id!==this.target?.id){this.target=best;this.onTarget(best);}}
 get interactionTarget(){return this.target;}
}
