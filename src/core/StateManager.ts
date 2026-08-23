import { Hero, createStarterHero, type HeroSave } from '../models/Hero';
import { Guild, type GuildSave } from '../models/Guild';
import { EventBus } from './EventBus';
import type { QuestState } from '../content/story/ashenCryptIntro';
export interface StorySave{quest:QuestState;cryptObjectiveComplete:boolean;rewardGranted:boolean;playerX:number;playerY:number}
export interface GameSave {version:1;savedAt:number;heroes:HeroSave[];guild:GuildSave;activeView:string;zoneLevel:number;story?:StorySave}
const SAVE_KEY='idle-guild-master-save-v1';
const QUEST_ORDER:QuestState[]=['NOT_STARTED','INTRODUCED','ACCEPTED','PARTY_MET','PREPARED','ENTERED_CRYPT','CRYPT_ATTEMPTED','CRYPT_CLEARED','RETURNED_TO_GUILD','COMPLETE'];
const defaultStory=():StorySave=>({quest:'NOT_STARTED',cryptObjectiveComplete:false,rewardGranted:false,playerX:0.5,playerY:0.76});
function finiteClamp(v:number,min:number,max:number,fallback:number){return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}
function normalizeStory(raw?:Partial<StorySave>):StorySave{
 const story={...defaultStory(),...(raw||{})};
 if(!QUEST_ORDER.includes(story.quest))story.quest='NOT_STARTED';
 story.playerX=finiteClamp(story.playerX,.08,.92,.5);story.playerY=finiteClamp(story.playerY,.12,.88,.76);
 if(story.rewardGranted){story.cryptObjectiveComplete=true;story.quest='COMPLETE';}
 else if(story.cryptObjectiveComplete&&QUEST_ORDER.indexOf(story.quest)<QUEST_ORDER.indexOf('CRYPT_CLEARED'))story.quest='CRYPT_CLEARED';
 return story;
}
export class StateManager{
 heroes:Hero[];guild:Guild;activeView='town';zoneLevel=1;story:StorySave=defaultStory();
 constructor(private bus:EventBus){this.heroes=[createStarterHero('hero-1','Aldric','guardian'),createStarterHero('hero-2','Mira','cleric'),createStarterHero('hero-3','Nyx','ranger'),createStarterHero('hero-4','Orin','arcanist'),createStarterHero('hero-5','Bran','guardian'),createStarterHero('hero-6','Elowen','cleric'),createStarterHero('hero-7','Kael','ranger'),createStarterHero('hero-8','Veyra','arcanist')];this.guild=new Guild();}
 snapshot():GameSave{return{version:1,savedAt:Date.now(),heroes:this.heroes.map(hero=>({...hero,stats:{...hero.stats},equipment:{...hero.equipment}})),guild:{gold:this.guild.gold,gems:this.guild.gems,shards:this.guild.shards,essences:this.guild.essences,facilities:{...this.guild.facilities}},activeView:this.activeView,zoneLevel:this.zoneLevel,story:{...this.story}};}
 save():void{localStorage.setItem(SAVE_KEY,JSON.stringify(this.snapshot()));this.bus.emit('save:complete',undefined);}
 load():GameSave|null{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const save=JSON.parse(raw) as GameSave;this.apply(save);return save;}
 apply(save:GameSave):void{this.heroes=save.heroes.map(hero=>new Hero({...hero,currentHp:Math.max(0,Math.min(hero.stats.maxHp,Number.isFinite(hero.currentHp)?hero.currentHp:hero.stats.maxHp))}));this.guild=new Guild(save.guild);this.zoneLevel=Math.max(1,Math.floor(save.zoneLevel||1));this.story=normalizeStory(save.story);
  // Reload is intentionally deterministic: story/progression persists, but presentation resumes safely in Town.
  this.activeView='town';const party=this.heroes.slice(0,4);if(party.length&&party.every(h=>!h.alive))party.forEach(h=>h.heal(h.stats.maxHp));}
 setQuest(quest:QuestState):void{if(this.story.quest===quest)return;this.story.quest=quest;this.save();}
 setTownPosition(x:number,y:number):void{this.story.playerX=finiteClamp(x,.08,.92,.5);this.story.playerY=finiteClamp(y,.12,.88,.76);}
 exportJson():string{return JSON.stringify(this.snapshot());}
 importJson(raw:string):void{const parsed=JSON.parse(raw) as GameSave;if(parsed.version!==1||!Array.isArray(parsed.heroes))throw new Error('Unsupported or invalid save data.');this.apply(parsed);this.save();}
}
