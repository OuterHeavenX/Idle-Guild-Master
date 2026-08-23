import{Assets,Container,Graphics,Sprite,Text,TextStyle}from'pixi.js';import type{StateManager}from'../../core/StateManager';
export interface TownTarget{id:string;label:string;x:number;y:number;r:number;priority:number}
const targets:TownTarget[]=[{id:'steward',label:'TALK',x:.50,y:.25,r:.105,priority:1},{id:'party',label:'TALK',x:.27,y:.48,r:.115,priority:2},{id:'blacksmith',label:'TALK',x:.76,y:.48,r:.11,priority:3},{id:'board',label:'READ',x:.35,y:.30,r:.085,priority:4},{id:'crypt',label:'ENTER',x:.50,y:.08,r:.105,priority:5}];
type Rect=[number,number,number,number];
const blocks:Rect[]=[
 [.08,.18,.38,.40], [.62,.38,.92,.64], [.07,.65,.34,.87], [.61,.70,.93,.91],
 [.405,.405,.595,.54],
 [.08,.055,.39,.105], [.61,.055,.92,.105],
];
const debug=new URLSearchParams(location.search).get('storydebug')==='1';
const GUILD_HALL=new URL('assets/town/buildings/guild-hall.svg',document.baseURI).href;
type HallStatus='REQUESTED'|'LOADED'|'FALLBACK';
function reportHall(status:HallStatus,error?:unknown){
 window.dispatchEvent(new CustomEvent('town:guild-hall-status',{detail:{status,url:GUILD_HALL}}));
 if(debug){console.info(`[Town] Guild Hall asset ${status.toLowerCase()}: ${GUILD_HALL}`);if(error)console.error('[Town] Guild Hall asset error:',error)}
}
export class TownScene extends Container{
 private player=new Sprite();private vx=0;private vy=0;private speed=.205;private target:TownTarget|null=null;private onTarget:(t:TownTarget|null)=>void=()=>{};private focusRing=new Graphics();private debugLayer=new Graphics();private guildGlow=new Graphics();private elapsed=0;
 constructor(private state:StateManager){super();this.visible=false;void this.build()}
 private async build(){
  const bg=new Graphics();
  bg.rect(0,0,1000,1500).fill(0x6f765f);
  bg.rect(110,170,780,1150).fill(0x887d61);
  bg.rect(400,80,200,1240).fill(0x9a8b6a);
  // Guild Hall forecourt integration: worn earth, threshold stones and a few grass breaks.
  bg.roundRect(110,335,270,92,22).fill(0x7d7058);
  bg.roundRect(230,360,155,78,18).fill(0x8e7d60);
  for(const[x,y,r]of[[124,348,9],[151,365,6],[200,418,8],[345,410,7],[372,352,6]]as Array<[number,number,number]>)bg.circle(x,y,r).fill(0x55634b);
  for(const[x,y,w,h]of[[240,372,58,18],[302,382,56,18],[265,407,62,16]]as Array<[number,number,number,number]>)bg.roundRect(x,y,w,h,5).fill(0x716754);
  // Existing approved Town geometry remains intact outside the Guild Hall proof area.
  bg.rect(620,380,300,260).fill(0x4a392b);bg.rect(70,650,270,220).fill(0x493c31);bg.rect(610,700,320,210).fill(0x46392e);bg.circle(500,710,105).fill(0x536e71);bg.circle(500,710,82).fill(0x253f49);bg.rect(80,80,310,22).fill(0x4b4a42);bg.rect(610,80,310,22).fill(0x4b4a42);this.addChild(bg);

  // One authored hero building only. Keep a graceful geometric fallback if the SVG fails.
  reportHall('REQUESTED');
  try{await Assets.load(GUILD_HALL);const hall=Sprite.from(GUILD_HALL);hall.x=58;hall.y=116;hall.width=356;hall.height=304;this.addChild(hall);reportHall('LOADED')}catch(error){reportHall('FALLBACK',error);const fallback=new Graphics();fallback.roundRect(80,180,300,220,12).fill(0x40382f).stroke({color:0x77614a,width:5});fallback.x=0;fallback.y=0;this.addChild(fallback)}

  this.guildGlow.ellipse(250,322,96,52).fill({color:0xd98b42,alpha:.09});this.guildGlow.blendMode='add';this.addChild(this.guildGlow);

  const style=new TextStyle({fontFamily:'Georgia',fontSize:28,fill:0xf5e2b7,stroke:{color:0x211810,width:4}});
  // The Guild Hall no longer relies on a giant world-space label; the authored silhouette/crest/entrance carry its identity.
  const labels:Array<[string,number,number]>=[['BLACKSMITH',700,500],['NOTICE BOARD',250,470],['EASTERN GATE',405,128]];
  for(const[s,x,y]of labels){const text=new Text({text:s,style});text.x=x;text.y=y;this.addChild(text)}

  const npc=(x:number,y:number,body:number,skin=0xc69b78)=>{const g=new Graphics();g.circle(0,0,32).fill(body);g.circle(0,-28,18).fill(skin);g.x=x*1000;g.y=y*1500;this.addChild(g)};
  npc(.50,.25,0x3f4057);npc(.76,.48,0x6f3b26);npc(.235,.475,0x665c62);npc(.275,.49,0x3e4e45);npc(.31,.47,0x353850);
  this.focusRing.visible=false;this.addChild(this.focusRing);
  await Assets.load('assets/dungeon/ashen-crypt/heroes/guardian.svg');this.player=Sprite.from('assets/dungeon/ashen-crypt/heroes/guardian.svg');this.player.anchor.set(.5,.82);this.player.width=82;this.player.height=108;this.addChild(this.player);
  if(debug){this.drawDebug();this.addChild(this.debugLayer)}this.syncPlayer();
 }
 setTargetListener(fn:(t:TownTarget|null)=>void){this.onTarget=fn}
 setInput(x:number,y:number){this.vx=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;this.vy=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0}
 resize(w:number,h:number){const scale=Math.max(w/1000,h/1500);this.scale.set(scale);this.x=(w-1000*scale)/2;this.y=(h-1500*scale)/2}
 private syncPlayer(){this.player.x=this.state.story.playerX*1000;this.player.y=this.state.story.playerY*1500}
 private blocked(x:number,y:number){return blocks.some(([l,t,r,b])=>x>l&&x<r&&y>t&&y<b)}
 private drawDebug(){this.debugLayer.clear();for(const[l,t,r,b]of blocks)this.debugLayer.rect(l*1000,t*1500,(r-l)*1000,(b-t)*1500).stroke({color:0xff5b5b,width:3,alpha:.75});for(const t of targets)this.debugLayer.circle(t.x*1000,t.y*1500,t.r*1000).stroke({color:0x65d9ff,width:2,alpha:.6})}
 private updateFocus(t:TownTarget|null){this.focusRing.clear();if(!t){this.focusRing.visible=false;return}this.focusRing.visible=true;this.focusRing.circle(t.x*1000,t.y*1500,42).stroke({color:0xf0ce85,width:4,alpha:.65})}
 update(dt:number){if(!this.visible)return;this.elapsed+=dt;this.guildGlow.alpha=.72+Math.sin(this.elapsed*2.2)*.12;const ox=this.state.story.playerX,oy=this.state.story.playerY;const nx=Math.max(.08,Math.min(.92,ox+this.vx*this.speed*dt)),ny=Math.max(.12,Math.min(.88,oy+this.vy*this.speed*dt));let x=ox,y=oy;if(!this.blocked(nx,oy))x=nx;if(!this.blocked(x,ny))y=ny;this.state.setTownPosition(x,y);this.syncPlayer();if(this.vx<-.05)this.player.scale.x=-Math.abs(this.player.scale.x||1);else if(this.vx>.05)this.player.scale.x=Math.abs(this.player.scale.x||1);const eligible=targets.map(t=>({t,d:Math.hypot(x-t.x,(y-t.y)*1.5)})).filter(v=>v.d<v.t.r).sort((a,b)=>Math.abs(a.d-b.d)>.008?a.d-b.d:a.t.priority-b.t.priority);const best=eligible[0]?.t||null;if(best?.id!==this.target?.id){this.target=best;this.updateFocus(best);this.onTarget(best)}}
 get interactionTarget(){return this.target}
}
