export interface PlayerInputCallbacks {
  onMove(x: number, y: number): void;
  onAttack(): void;
  onBlock(active: boolean): void;
  onInteract(): void;
  onMenu(): void;
  combatActive(): boolean;
}

export class PlayerInputController {
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private touchMove = { x: 0, y: 0 };
  private suspended = false;
  private disposers: Array<() => void> = [];

  constructor(
    private joystick: HTMLElement,
    private knob: HTMLElement,
    private callbacks: PlayerInputCallbacks,
  ) {
    this.bind();
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    if (value) this.reset();
    else this.emitMove();
  }

  reset(): void {
    if (this.pointerId !== null && this.joystick.hasPointerCapture?.(this.pointerId)) {
      try { this.joystick.releasePointerCapture(this.pointerId); } catch { /* pointer already released */ }
    }
    this.pointerId = null;
    this.touchMove = { x: 0, y: 0 };
    this.keys.clear();
    this.knob.style.transform = '';
    this.callbacks.onMove(0, 0);
    this.callbacks.onBlock(false);
  }

  destroy(): void {
    this.reset();
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  private bind(): void {
    const on = (target: Window | Document | HTMLElement, type: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, options);
      this.disposers.push(() => target.removeEventListener(type, fn, options));
    };

    on(this.joystick, 'pointerdown', ((event: PointerEvent) => {
      if (this.suspended || this.pointerId !== null) return;
      event.preventDefault();
      this.pointerId = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.moveJoystick(event);
    }) as EventListener);
    on(this.joystick, 'pointermove', ((event: PointerEvent) => this.moveJoystick(event)) as EventListener);
    on(this.joystick, 'pointerup', ((event: PointerEvent) => this.endJoystick(event)) as EventListener);
    on(this.joystick, 'pointercancel', ((event: PointerEvent) => this.endJoystick(event)) as EventListener);

    on(window, 'keydown', ((event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'escape' && !event.repeat) { event.preventDefault(); this.callbacks.onMenu(); return; }
      if (this.suspended) return;
      if ((key === 'j' || event.code === 'Space') && this.callbacks.combatActive()) {
        event.preventDefault();
        if (!event.repeat) this.callbacks.onAttack();
        return;
      }
      if ((key === 'shift' || key === 'k') && this.callbacks.combatActive()) {
        event.preventDefault();
        this.keys.add(key);
        this.callbacks.onBlock(true);
        return;
      }
      if (key === 'e' && !event.repeat) { event.preventDefault(); this.callbacks.onInteract(); return; }
      if (this.isMoveKey(key)) { event.preventDefault(); this.keys.add(key); this.emitMove(); }
    }) as EventListener);
    on(window, 'keyup', ((event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'shift' || key === 'k') {
        this.keys.delete(key);
        if (!this.keys.has('shift') && !this.keys.has('k')) this.callbacks.onBlock(false);
      }
      if (this.isMoveKey(key)) { this.keys.delete(key); this.emitMove(); }
    }) as EventListener);
    on(window, 'blur', (() => this.reset()) as EventListener);
    on(document, 'visibilitychange', (() => { if (document.hidden) this.reset(); }) as EventListener);
  }

  private moveJoystick(event: PointerEvent): void {
    if (this.suspended || event.pointerId !== this.pointerId) return;
    const rect = this.joystick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * 0.32;
    const length = Math.hypot(dx, dy);
    const raw = Math.min(1, length / radius);
    const deadZone = 0.14;
    if (raw < deadZone) this.touchMove = { x: 0, y: 0 };
    else {
      const magnitude = (raw - deadZone) / (1 - deadZone);
      this.touchMove = { x: dx / (length || 1) * magnitude, y: dy / (length || 1) * magnitude };
    }
    this.knob.style.transform = `translate(${this.touchMove.x * radius}px,${this.touchMove.y * radius}px)`;
    this.emitMove();
  }

  private endJoystick(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.touchMove = { x: 0, y: 0 };
    this.knob.style.transform = '';
    this.emitMove();
  }

  private emitMove(): void {
    if (this.suspended) { this.callbacks.onMove(0, 0); return; }
    if (Math.hypot(this.touchMove.x, this.touchMove.y) > 0) {
      this.callbacks.onMove(this.touchMove.x, this.touchMove.y);
      return;
    }
    const x = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    const y = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    const length = Math.hypot(x, y) || 1;
    this.callbacks.onMove(x / length, y / length);
  }

  private isMoveKey(key: string): boolean {
    return ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key);
  }
}
