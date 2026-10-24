import Phaser from 'phaser';
import { formatCredits } from '@game/format';

/**
 * Contador animado de créditos: interpola do valor atual até o alvo com easing e
 * formata no padrão brasileiro. Usado no saldo, no "último prêmio" e nos painéis de Big Win.
 */
export class CounterText {
  private current: number;
  private tween?: Phaser.Tweens.Tween;
  private resolver?: () => void;
  private readonly proxy = { value: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: { setText(text: string): unknown },
    initial = 0,
    private readonly onUpdate?: (value: number) => void,
    private readonly formatter: (v: number) => string = (v) => formatCredits(v),
  ) {
    this.current = initial;
    this.proxy.value = initial;
    this.target.setText(this.formatter(initial));
  }

  get value(): number {
    return this.current;
  }

  /** Define imediatamente, sem animação. */
  set(value: number): void {
    this.cancel();
    this.current = value;
    this.proxy.value = value;
    this.target.setText(this.formatter(value));
    this.onUpdate?.(value);
  }

  /** Anima até o valor. Resolve quando terminar (ou imediatamente se já estiver lá). */
  animateTo(value: number, duration = 900, ease = 'Cubic.easeOut'): Promise<void> {
    if (value === this.current && !this.tween) return Promise.resolve();
    this.cancel();
    const from = this.proxy.value;
    this.current = value;
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.tween = this.scene.tweens.add({
        targets: this.proxy,
        value: { from, to: value },
        duration,
        ease,
        onUpdate: () => {
          this.target.setText(this.formatter(Math.round(this.proxy.value)));
          this.onUpdate?.(Math.round(this.proxy.value));
        },
        onComplete: () => this.finish(),
      });
    });
  }

  /** Pula a animação para o valor final (e resolve a promise pendente). */
  finish(): void {
    const v = this.current;
    this.tween?.stop();
    this.tween = undefined;
    this.proxy.value = v;
    this.target.setText(this.formatter(v));
    this.onUpdate?.(v);
    const r = this.resolver;
    this.resolver = undefined;
    r?.();
  }

  get isAnimating(): boolean {
    return !!this.tween;
  }

  private cancel(): void {
    this.tween?.stop();
    this.tween = undefined;
    const r = this.resolver;
    this.resolver = undefined;
    r?.();
  }
}
