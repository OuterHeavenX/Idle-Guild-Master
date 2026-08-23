export type CombatStyle = 'melee' | 'heal' | 'projectile' | 'spell' | 'enemy';
export type EventMap = {
  'combat:damage': { sourceId: string; targetId: string; amount: number; crit: boolean; style?: CombatStyle };
  'combat:heal': { sourceId: string; targetId: string; amount: number };
  'combat:status': { targetId: string; status: 'burn' | 'freeze'; active: boolean };
  'combat:enemy-spawn': { enemyId: string; name: string; level: number; wave: number };
  'combat:enemy-death': { enemyId: string; wave: number; zoneLevel: number };
  'combat:hero-down': { heroId: string; zoneLevel: number; wave: number };
  'combat:party-defeated': { zoneLevel: number; wave: number; recoveryTicks: number };
  'combat:party-recovered': { zoneLevel: number };
  'combat:active-skill': { heroId: string; skillName: string; cooldownTicks: number };
  'input:active-skill': { heroId: string };
  'loot:drop': { itemName: string; rarity: string; gold?: number; shards?: number };
  'progress:zone-ready': { zoneLevel: number };
  'progress:zone-complete': { zoneLevel: number; gold: number; shards: number };
  'view:change': { view: string };
  'location:change': { location: string };
  'menu:change': { menu: string };
  'story:gate-denied': { destination: 'dungeon'; reason: string };
  'save:complete': undefined;
  'raid:phase': { phase: number };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<Handler<any>>>();
  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
    return () => set.delete(handler);
  }
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}
