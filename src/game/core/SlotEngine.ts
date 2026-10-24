import type { Rng } from './rng';
import { classifyWin, evaluateLines, evaluateScatter, gridFromStops } from './evaluate';
import type { SlotMathConfig, SpinResult } from './types';

export interface SpinOptions {
  /** aposta total em centavos */
  bet: number;
  /** multiplicador de prêmio (giros grátis). Padrão 1. */
  multiplier?: number;
}

/**
 * Motor matemático: sorteia as paradas, monta o grid e calcula as premiações.
 * Não conhece UI, carteira, nem tempo. O resultado é calculado ANTES de qualquer animação.
 *
 * Garantias:
 * - o sorteio é uniforme sobre as tiras configuradas; nenhuma informação sobre saldo,
 *   histórico ou perfil do jogador entra aqui;
 * - a mesma sequência de RNG produz sempre o mesmo resultado (testável).
 */
export class SlotEngine {
  constructor(readonly config: SlotMathConfig) {
    validateConfig(config);
  }

  get lines(): number {
    return this.config.paylines.length;
  }

  lineBetFor(bet: number): number {
    return Math.floor(bet / this.lines);
  }

  spin(rng: Rng, options: SpinOptions): SpinResult {
    const bet = options.bet;
    if (!Number.isInteger(bet) || bet <= 0) throw new RangeError(`aposta inválida: ${bet}`);
    const multiplier = Math.max(1, Math.floor(options.multiplier ?? 1));
    const stops = this.config.reelStrips.map((strip) => rng.int(strip.length));
    return this.resolve(stops, bet, multiplier);
  }

  /** Resolve um giro a partir de paradas conhecidas (usado em testes e replays). */
  resolve(stops: number[], bet: number, multiplier = 1): SpinResult {
    const grid = gridFromStops(stops, this.config);
    const lineBet = this.lineBetFor(bet);
    const lineWins = evaluateLines(grid, this.config, lineBet, multiplier);
    const scatterWin = evaluateScatter(grid, this.config, bet, multiplier);
    const totalWin = lineWins.reduce((acc, w) => acc + w.amount, 0) + (scatterWin?.amount ?? 0);
    const triggersFreeSpins = !!scatterWin && scatterWin.count >= this.config.freeSpins.triggerCount;
    return {
      stops: [...stops],
      grid,
      lineWins,
      scatterWin,
      totalWin,
      multiplier,
      bet,
      lineBet,
      triggersFreeSpins,
      tier: classifyWin(totalWin, bet, this.config),
    };
  }
}

export function validateConfig(config: SlotMathConfig): void {
  if (config.reelStrips.length !== config.reels) {
    throw new Error(`config ${config.id}: esperado ${config.reels} tiras, recebido ${config.reelStrips.length}`);
  }
  const ids = new Set(config.symbols.map((s) => s.id));
  config.reelStrips.forEach((strip, i) => {
    if (strip.length < config.rows) throw new Error(`tira ${i} menor que o número de linhas`);
    for (const id of strip) {
      if (!ids.has(id)) throw new Error(`tira ${i} contém símbolo desconhecido "${id}"`);
    }
  });
  config.paylines.forEach((line, i) => {
    if (line.length !== config.reels) throw new Error(`linha ${i} deve ter ${config.reels} posições`);
    for (const row of line) {
      if (row < 0 || row >= config.rows) throw new Error(`linha ${i} com row fora do grid`);
    }
  });
  if (config.betLevels.length === 0) throw new Error('betLevels vazio');
  for (const b of config.betLevels) {
    if (!Number.isInteger(b) || b <= 0) throw new Error(`nível de aposta inválido: ${b}`);
    if (b % config.paylines.length !== 0) {
      throw new Error(`aposta ${b} não é divisível pelo número de linhas (${config.paylines.length})`);
    }
  }
  if (config.symbols.filter((s) => s.kind === 'scatter').length > 1) throw new Error('apenas um scatter é suportado');
}
