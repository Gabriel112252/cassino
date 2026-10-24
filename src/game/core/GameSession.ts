import { Emitter } from './Emitter';
import type { Rng } from './rng';
import { CryptoRng } from './rng';
import type { SlotEngine } from './SlotEngine';
import type { SpinResult } from './types';
import type { DemoWallet } from '@wallet/DemoWallet';

export type SessionState = 'idle' | 'spinning';

export interface FreeSpinsState {
  active: boolean;
  remaining: number;
  played: number;
  awarded: number;
  multiplier: number;
  totalWin: number;
  /** aposta travada durante os giros grátis (centavos) */
  bet: number;
}

export interface RoundOutcome {
  roundId: string;
  result: SpinResult;
  freeSpin: boolean;
  balanceAfterDebit: number;
  freeSpins: FreeSpinsState;
}

export interface RoundSettlement {
  roundId: string;
  totalWin: number;
  balance: number;
  freeSpinsStarted: boolean;
  freeSpinsRetriggered: boolean;
  freeSpinsEnded: boolean;
  /** total acumulado dos giros grátis quando a rodada bônus termina */
  freeSpinsTotal: number;
  freeSpins: FreeSpinsState;
  nextIsFreeSpin: boolean;
}

export type SpinBlockReason = 'spinning' | 'insufficient-balance';

export interface SessionEvents extends Record<string, unknown> {
  state: SessionState;
  balance: number;
  bet: number;
  freeSpins: FreeSpinsState;
  roundStarted: RoundOutcome;
  roundSettled: RoundSettlement;
}

export interface GameSessionOptions {
  rng?: Rng;
  now?: () => number;
}

/**
 * Orquestra engine + carteira em uma máquina de estados simples.
 *
 * Regras garantidas aqui (e cobertas por testes):
 * - não há giros concorrentes: `startSpin` só funciona em `idle`;
 * - a aposta é debitada UMA vez por rodada, antes do resultado;
 * - o resultado é calculado ANTES de qualquer animação (a cena só o reproduz);
 * - o prêmio é creditado UMA vez, ao concluir a rodada;
 * - giros grátis não debitam e travam a aposta;
 * - nada aqui lê saldo/histórico para influenciar o RNG.
 */
export class GameSession {
  readonly events = new Emitter<SessionEvents>();
  private rng: Rng;
  private readonly now: () => number;
  private _state: SessionState = 'idle';
  private betIndex: number;
  private freeSpins: FreeSpinsState = emptyFreeSpins();
  private current: RoundOutcome | null = null;
  private roundCounter = 0;

  constructor(
    readonly engine: SlotEngine,
    readonly wallet: DemoWallet,
    options: GameSessionOptions = {},
  ) {
    this.rng = options.rng ?? new CryptoRng();
    this.now = options.now ?? (() => Date.now());
    const levels = engine.config.betLevels;
    const saved = wallet.betIndex;
    this.betIndex = saved >= 0 && saved < levels.length ? saved : engine.config.defaultBetIndex;
    wallet.onChange(() => this.events.emit('balance', wallet.balance));
  }

  // ------------------------------------------------------------------ estado

  get state(): SessionState {
    return this._state;
  }

  get balance(): number {
    return this.wallet.balance;
  }

  get bet(): number {
    return this.freeSpins.active ? this.freeSpins.bet : this.engine.config.betLevels[this.betIndex];
  }

  get betLevelIndex(): number {
    return this.betIndex;
  }

  get freeSpinsState(): FreeSpinsState {
    return { ...this.freeSpins };
  }

  get currentRound(): RoundOutcome | null {
    return this.current;
  }

  get isSpinning(): boolean {
    return this._state === 'spinning';
  }

  /** Troca o RNG (apenas para testes/ferramentas de desenvolvimento). */
  setRng(rng: Rng): void {
    this.rng = rng;
  }

  // ------------------------------------------------------------------ aposta

  canChangeBet(): boolean {
    return this._state === 'idle' && !this.freeSpins.active;
  }

  setBetIndex(index: number): boolean {
    if (!this.canChangeBet()) return false;
    const levels = this.engine.config.betLevels;
    if (index < 0 || index >= levels.length) return false;
    this.betIndex = index;
    this.wallet.setBetIndex(index);
    this.events.emit('bet', this.bet);
    return true;
  }

  nextBet(): boolean {
    return this.setBetIndex(this.betIndex + 1);
  }

  prevBet(): boolean {
    return this.setBetIndex(this.betIndex - 1);
  }

  // ------------------------------------------------------------------ giro

  canSpin(): { ok: true } | { ok: false; reason: SpinBlockReason } {
    if (this._state !== 'idle') return { ok: false, reason: 'spinning' };
    if (!this.freeSpins.active && !this.wallet.canAfford(this.bet)) return { ok: false, reason: 'insufficient-balance' };
    return { ok: true };
  }

  /**
   * Inicia uma rodada: debita (se não for giro grátis), sorteia e devolve o resultado completo.
   * Lança erro se já houver giro em andamento ou saldo insuficiente.
   */
  startSpin(): RoundOutcome {
    const check = this.canSpin();
    if (!check.ok) throw new Error(`giro bloqueado: ${check.reason}`);

    const roundId = this.newRoundId();
    const freeSpin = this.freeSpins.active;
    const bet = this.bet;

    if (freeSpin) {
      if (!this.wallet.registerFreeRound(roundId, 'giro grátis')) throw new Error('rodada duplicada');
    } else if (!this.wallet.debit(bet, roundId, 'aposta')) {
      throw new Error('débito recusado');
    }

    this.setState('spinning');
    const multiplier = freeSpin ? this.freeSpins.multiplier : 1;
    const result = this.engine.spin(this.rng, { bet, multiplier });
    const outcome: RoundOutcome = {
      roundId,
      result,
      freeSpin,
      balanceAfterDebit: this.wallet.balance,
      freeSpins: this.freeSpinsState,
    };
    this.current = outcome;
    this.events.emit('roundStarted', outcome);
    return outcome;
  }

  /** Conclui a rodada em andamento: credita o prêmio (uma vez) e atualiza giros grátis. */
  completeSpin(roundId: string): RoundSettlement {
    const round = this.current;
    if (!round || round.roundId !== roundId) throw new Error(`rodada desconhecida: ${roundId}`);
    if (this._state !== 'spinning') throw new Error('nenhum giro em andamento');

    const { result, freeSpin } = round;
    const fs = this.freeSpins;
    const cfg = this.engine.config.freeSpins;

    let freeSpinsStarted = false;
    let freeSpinsRetriggered = false;
    let freeSpinsEnded = false;
    let freeSpinsTotal = 0;

    this.wallet.credit(result.totalWin, roundId, freeSpin ? 'prêmio (giro grátis)' : 'prêmio');

    if (freeSpin) {
      fs.remaining = Math.max(0, fs.remaining - 1);
      fs.played += 1;
      fs.totalWin += result.totalWin;
      if (result.totalWin > 0) fs.multiplier = Math.min(cfg.maxMultiplier, fs.multiplier + cfg.multiplierStep);
      if (result.triggersFreeSpins) {
        fs.remaining += cfg.retriggerSpins;
        fs.awarded += cfg.retriggerSpins;
        freeSpinsRetriggered = true;
      }
      if (fs.remaining === 0) {
        freeSpinsEnded = true;
        freeSpinsTotal = fs.totalWin;
        this.freeSpins = emptyFreeSpins();
      }
    } else if (result.triggersFreeSpins) {
      this.freeSpins = {
        active: true,
        remaining: cfg.spinsAwarded,
        awarded: cfg.spinsAwarded,
        played: 0,
        multiplier: cfg.startMultiplier,
        totalWin: 0,
        bet: result.bet,
      };
      freeSpinsStarted = true;
    }

    this.wallet.recordSpin({
      roundId,
      at: this.now(),
      bet: result.bet,
      win: result.totalWin,
      freeSpin,
      multiplier: result.multiplier,
      grid: result.grid,
      triggeredFreeSpins: result.triggersFreeSpins,
    });

    this.current = null;
    this.setState('idle');
    const settlement: RoundSettlement = {
      roundId,
      totalWin: result.totalWin,
      balance: this.wallet.balance,
      freeSpinsStarted,
      freeSpinsRetriggered,
      freeSpinsEnded,
      freeSpinsTotal,
      freeSpins: this.freeSpinsState,
      nextIsFreeSpin: this.freeSpins.active,
    };
    this.events.emit('freeSpins', this.freeSpinsState);
    this.events.emit('roundSettled', settlement);
    return settlement;
  }

  /** Reinicia os créditos fictícios (apenas em idle, fora dos giros grátis). */
  resetCredits(): boolean {
    if (this._state !== 'idle' || this.freeSpins.active) return false;
    this.wallet.reset();
    return true;
  }

  // ------------------------------------------------------------------ interno

  private setState(state: SessionState): void {
    if (this._state === state) return;
    this._state = state;
    this.events.emit('state', state);
  }

  private newRoundId(): string {
    this.roundCounter += 1;
    const rand = Math.floor(this.rng.next() * 0xffffff).toString(36);
    return `${this.now().toString(36)}-${this.roundCounter.toString(36)}-${rand}`;
  }
}

export function emptyFreeSpins(): FreeSpinsState {
  return { active: false, remaining: 0, played: 0, awarded: 0, multiplier: 1, totalWin: 0, bet: 0 };
}
