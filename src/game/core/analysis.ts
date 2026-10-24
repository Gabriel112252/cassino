import { SeededRng, type Rng } from './rng';
import type { SlotEngine } from './SlotEngine';

export interface BaseGameStats {
  combinations: number;
  /** retorno esperado do jogo base (linhas + scatter) por aposta, ex.: 0.86 */
  rtp: number;
  /** probabilidade de qualquer prêmio > 0 */
  hitFrequency: number;
  /** probabilidade de acionar os giros grátis */
  triggerProbability: number;
  /** maior prêmio possível em múltiplos da aposta total */
  maxWinMultiple: number;
}

export interface FreeSpinsStats {
  trials: number;
  /** valor esperado do bônus completo (com reacionamentos), em múltiplos da aposta total */
  expectedMultiple: number;
  averageSpins: number;
  averageMultiplierAtEnd: number;
}

export interface RtpReport {
  base: BaseGameStats;
  freeSpins: FreeSpinsStats;
  /** RTP total = base + P(trigger) * EV(bônus) */
  totalRtp: number;
}

/** Enumera TODAS as combinações de parada (exato, sem amostragem). */
export function computeBaseGameStats(engine: SlotEngine, bet = engine.config.betLevels[0]): BaseGameStats {
  const strips = engine.config.reelStrips;
  const lens = strips.map((s) => s.length);
  const total = lens.reduce((a, b) => a * b, 1);
  let sumWin = 0;
  let hits = 0;
  let triggers = 0;
  let maxWin = 0;
  const stops = new Array<number>(strips.length).fill(0);

  const walk = (reel: number): void => {
    if (reel === strips.length) {
      const r = engine.resolve(stops, bet, 1);
      sumWin += r.totalWin;
      if (r.totalWin > 0) hits += 1;
      if (r.triggersFreeSpins) triggers += 1;
      if (r.totalWin > maxWin) maxWin = r.totalWin;
      return;
    }
    for (let i = 0; i < lens[reel]; i += 1) {
      stops[reel] = i;
      walk(reel + 1);
    }
  };
  walk(0);

  return {
    combinations: total,
    rtp: sumWin / total / bet,
    hitFrequency: hits / total,
    triggerProbability: triggers / total,
    maxWinMultiple: maxWin / bet,
  };
}

/** Simula a rodada de giros grátis completa (multiplicador crescente + reacionamentos). */
export function simulateFreeSpins(engine: SlotEngine, trials = 20000, rng: Rng = new SeededRng(1234), bet = engine.config.betLevels[0]): FreeSpinsStats {
  const cfg = engine.config.freeSpins;
  let totalWin = 0;
  let totalSpins = 0;
  let totalMult = 0;
  for (let t = 0; t < trials; t += 1) {
    let remaining = cfg.spinsAwarded;
    let multiplier = cfg.startMultiplier;
    let guard = 0;
    while (remaining > 0 && guard < 500) {
      guard += 1;
      remaining -= 1;
      totalSpins += 1;
      const r = engine.spin(rng, { bet, multiplier });
      totalWin += r.totalWin;
      if (r.totalWin > 0) multiplier = Math.min(cfg.maxMultiplier, multiplier + cfg.multiplierStep);
      if (r.triggersFreeSpins) remaining += cfg.retriggerSpins;
    }
    totalMult += multiplier;
  }
  return {
    trials,
    expectedMultiple: totalWin / trials / bet,
    averageSpins: totalSpins / trials,
    averageMultiplierAtEnd: totalMult / trials,
  };
}

export function computeRtpReport(engine: SlotEngine, trials = 20000): RtpReport {
  const base = computeBaseGameStats(engine);
  const freeSpins = simulateFreeSpins(engine, trials);
  return {
    base,
    freeSpins,
    totalRtp: base.rtp + base.triggerProbability * freeSpins.expectedMultiple,
  };
}
