export type EventMap = {
  'combat:damage': { sourceId: string; targetId: string; amount: number; crit: boolean };
  'combat:heal': { sourceId: string; targetId: string; amount: number };
  'loot:drop': { itemName: string; rarity: string };
  'view:change': { view: string };
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
