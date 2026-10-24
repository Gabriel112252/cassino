import Phaser from 'phaser';
import type { ReelWindow } from '../layout';
import { Reel, REEL_TIMINGS_NORMAL, REEL_TIMINGS_TURBO, type ReelTimings } from './Reel';

export interface SpinSchedule {
  /** atraso entre o início de cada rolo (ms) */
  startStaggerMs: number;
  /** tempo de giro do primeiro rolo antes de pedir a parada (ms) */
  baseSpinMs: number;
  /** atraso adicional da parada de cada rolo seguinte (ms) */
  stopStaggerMs: number;
  /** tempo extra de giro do último rolo durante a antecipação do bônus (ms) */
  anticipationMs: number;
  timings: ReelTimings;
}

export const SCHEDULE_NORMAL: SpinSchedule = {
  startStaggerMs: 95,
  baseSpinMs: 850,
  stopStaggerMs: 330,
  anticipationMs: 1500,
  timings: REEL_TIMINGS_NORMAL,
};

export const SCHEDULE_TURBO: SpinSchedule = {
  startStaggerMs: 40,
  baseSpinMs: 330,
  stopStaggerMs: 130,
  anticipationMs: 900,
  timings: REEL_TIMINGS_TURBO,
};

export interface ReelSetEvents {
  onReelStart?: (index: number) => void;
  onReelStop?: (index: number, isLast: boolean) => void;
  onAnticipationStart?: (reelIndex: number) => void;
  onAnticipationEnd?: (reelIndex: number) => void;
}

/** Conjunto dos 3 rolos: coordena início escalonado, paradas em sequência e antecipação. */
export class ReelSet {
  readonly reels: Reel[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private resolveSpin: (() => void) | null = null;
  private stopped = 0;
  private currentResult: string[][] | null = null;
  private stopRequested = false;
  private anticipating = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    strips: readonly (readonly string[])[],
    initialGrid: string[][],
    depth: number,
    private readonly events: ReelSetEvents = {},
  ) {
    strips.forEach((strip, i) => {
      const reel = new Reel(scene, i, strip, initialGrid[i], depth);
      reel.onStopped(() => this.handleReelStopped(i));
      this.reels.push(reel);
    });
  }

  layout(windows: ReelWindow[]): void {
    windows.forEach((w, i) => this.reels[i].layout(w));
  }

  update(deltaMs: number): void {
    for (const r of this.reels) r.update(deltaMs);
  }

  get isSpinning(): boolean {
    return this.reels.some((r) => r.isSpinning) || this.resolveSpin !== null;
  }

  /**
   * Gira todos os rolos e para cada um no resultado informado (grid[reel][row]).
   * Resolve quando o último rolo terminou o bounce.
   */
  spin(grid: string[][], schedule: SpinSchedule, anticipateLastReel = false): Promise<void> {
    if (this.isSpinning) return Promise.reject(new Error('rolos já estão girando'));
    this.clearTimers();
    this.currentResult = grid;
    this.stopped = 0;
    this.stopRequested = false;
    this.anticipating = -1;

    return new Promise<void>((resolve) => {
      this.resolveSpin = resolve;
      this.reels.forEach((reel, i) => {
        reel.setTimings(schedule.timings);
        reel.clearPresentation();
        this.timers.push(
          this.scene.time.delayedCall(i * schedule.startStaggerMs, () => {
            reel.spin();
            this.events.onReelStart?.(i);
          }),
        );
        const last = i === this.reels.length - 1;
        let stopAt = schedule.baseSpinMs + i * schedule.stopStaggerMs;
        if (last && anticipateLastReel) stopAt += schedule.anticipationMs;
        this.timers.push(
          this.scene.time.delayedCall(stopAt, () => {
            if (this.stopRequested) return;
            reel.stop(grid[i]);
          }),
        );
        if (last && anticipateLastReel) {
          // a antecipação começa quando o penúltimo rolo para
          this.timers.push(
            this.scene.time.delayedCall(schedule.baseSpinMs + (i - 1) * schedule.stopStaggerMs + 350, () => {
              if (this.stopRequested || this.stopped >= this.reels.length) return;
              this.anticipating = i;
              this.events.onAnticipationStart?.(i);
            }),
          );
        }
      });
    });
  }

  /** Parada rápida: todos os rolos ainda girando param já, em sequência curta. */
  stopNow(): void {
    if (!this.currentResult || this.stopRequested) return;
    this.stopRequested = true;
    this.clearTimers();
    if (this.anticipating >= 0) {
      this.events.onAnticipationEnd?.(this.anticipating);
      this.anticipating = -1;
    }
    let extra = 0;
    this.reels.forEach((reel, i) => {
      if (reel.isSpinning) {
        reel.stop((this.currentResult as string[][])[i], extra);
        extra += 1.5;
      }
    });
  }

  private handleReelStopped(index: number): void {
    this.stopped += 1;
    const isLast = this.stopped >= this.reels.length;
    if (this.anticipating === index) {
      this.events.onAnticipationEnd?.(index);
      this.anticipating = -1;
    }
    this.events.onReelStop?.(index, isLast);
    if (isLast) {
      const resolve = this.resolveSpin;
      this.resolveSpin = null;
      this.currentResult = null;
      this.clearTimers();
      resolve?.();
    }
  }

  private clearTimers(): void {
    for (const t of this.timers) t.remove(false);
    this.timers = [];
  }

  clearPresentation(): void {
    for (const r of this.reels) r.clearPresentation();
  }

  destroy(): void {
    this.clearTimers();
    for (const r of this.reels) r.destroy();
  }
}
