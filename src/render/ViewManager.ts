import { EventBus } from '../core/EventBus';
import type { StateManager } from '../core/StateManager';

export type GameView = 'dungeon' | 'town' | 'heroes' | 'blacksmith' | 'raid';

export class ViewManager {
  private buttons = new Map<GameView, HTMLButtonElement>();

  constructor(private state: StateManager, private bus: EventBus, private root: HTMLElement) {}

  mount(): void {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    const entries: Array<[GameView, string]> = [
      ['dungeon', 'Dungeon'],
      ['town', 'Town'],
      ['heroes', 'Heroes'],
      ['blacksmith', 'Forge'],
      ['raid', 'Raid']
    ];
    for (const [view, label] of entries) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => this.show(view));
      nav.appendChild(button);
      this.buttons.set(view, button);
    }
    this.root.appendChild(nav);
    this.show((this.state.activeView as GameView) || 'dungeon');
  }

  show(view: GameView): void {
    this.state.activeView = view;
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((panel) => {
      panel.hidden = panel.dataset.view !== view;
    });
    this.buttons.forEach((button, key) => button.classList.toggle('active', key === view));
    this.bus.emit('view:change', { view });
  }
}
