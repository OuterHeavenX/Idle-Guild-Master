import { EventBus } from '../core/EventBus';
import type { StateManager } from '../core/StateManager';
export type GameView='dungeon'|'town'|'heroes'|'blacksmith'|'raid';
export class ViewManager { private buttons=new Map<GameView,HTMLButtonElement>(); constructor(private state:StateManager,private bus:EventBus,private root:HTMLElement){}
  mount():void{const nav=document.createElement('nav');nav.className='bottom-nav';const entries:Array<[GameView,string,string]>=[['dungeon','Dungeon','⚔'],['town','Town','⌂'],['heroes','Heroes','♟'],['blacksmith','Forge','⚒'],['raid','Raid','♜']];for(const[view,label,icon]of entries){const b=document.createElement('button');b.innerHTML=`<span class="nav-icon">${icon}</span><span>${label}</span>`;b.addEventListener('click',()=>this.show(view));nav.appendChild(b);this.buttons.set(view,b);}this.root.appendChild(nav);this.show((this.state.activeView as GameView)||'dungeon');}
  show(view:GameView):void{this.state.activeView=view;this.root.dataset.view=view;document.querySelectorAll<HTMLElement>('[data-view]').forEach(p=>p.hidden=p.dataset.view!==view);this.buttons.forEach((b,k)=>b.classList.toggle('active',k===view));this.bus.emit('view:change',{view});}
}
