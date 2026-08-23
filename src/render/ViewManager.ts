import { EventBus } from '../core/EventBus';
import type { StateManager, WorldLocation } from '../core/StateManager';

export type MenuView = 'none' | 'dungeonInfo' | 'heroes' | 'forge' | 'raid';

const LOCATION_LABELS: Record<WorldLocation, string> = {
  town: 'GUILD TOWN',
  guildHall: 'GUILD HALL',
  blacksmith: 'TORREN’S FORGE',
  ashenCrypt: 'ASHEN CRYPT',
};

export class ViewManager {
  private buttons = new Map<MenuView, HTMLButtonElement>();
  private debugBadge?: HTMLDivElement;
  private menu: MenuView = 'none';
  private location: WorldLocation;
  private hallStatus = 'PENDING';

  constructor(private state: StateManager, private bus: EventBus, private root: HTMLElement) {
    this.location = state.world.location;
  }

  mount(): void {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Game navigation');
    const entries: Array<[MenuView, string, string]> = [
      ['dungeonInfo', 'Crypt', '⚔'],
      ['none', 'Explore', '⌂'],
      ['heroes', 'Aldric', '♟'],
      ['forge', 'Forge', '⚒'],
      ['raid', 'Raid', '♜'],
    ];
    for (const [view, label, icon] of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span class="nav-icon">${icon}</span><span>${label}</span>`;
      button.addEventListener('click', () => this.show(view));
      nav.appendChild(button);
      this.buttons.set(view, button);
    }
    this.root.appendChild(nav);

    if (new URLSearchParams(location.search).get('storydebug') === '1') {
      const env = (import.meta as any).env || {};
      this.debugBadge = document.createElement('div');
      this.debugBadge.className = 'story-debug-badge';
      this.root.appendChild(this.debugBadge);
      const update = () => {
        const sha = String(env.VITE_BUILD_SHA || 'local').slice(0, 10);
        const branch = String(env.VITE_BUILD_BRANCH || 'local');
        const position = this.state.worldPosition(this.location);
        this.debugBadge!.textContent = `RPG BUILD · ${branch} · ${sha} · ${this.location} · ${position.x.toFixed(2)},${position.y.toFixed(2)} · ${this.state.story.quest} · HALL:${this.hallStatus}`;
      };
      window.addEventListener('town:guild-hall-status', (event) => {
        this.hallStatus = String((event as CustomEvent).detail?.status || 'UNKNOWN');
        update();
      });
      this.bus.on('location:change', update);
      this.bus.on('menu:change', update);
      this.bus.on('save:complete', update);
      update();
    }

    this.setLocation(this.location, false);
    this.show('none', false);
  }

  setLocation(location: WorldLocation, emit = true): void {
    this.location = location;
    this.root.dataset.location = location;
    const label = document.querySelector<HTMLElement>('#location');
    if (label) label.textContent = LOCATION_LABELS[location];
    if (emit) this.bus.emit('location:change', { location });
  }

  show(menu: MenuView, emit = true): void {
    this.menu = menu;
    this.root.dataset.menu = menu;
    document.querySelectorAll<HTMLElement>('[data-menu-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.menuPanel !== menu;
    });
    this.buttons.forEach((button, key) => button.classList.toggle('active', key === menu));
    if (emit) this.bus.emit('menu:change', { menu });
  }

  get currentMenu(): MenuView { return this.menu; }
  get currentLocation(): WorldLocation { return this.location; }
}
