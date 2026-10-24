import { createDefaultStorage, type KeyValueStorage } from './storage';

/**
 * Carteira DEMONSTRATIVA de créditos fictícios.
 *
 * NÃO existe dinheiro real, depósito, saque, PIX, cartão ou qualquer integração financeira.
 * A carteira é uma pilha de centavos de crédito virtual persistida em localStorage, separada
 * da engine do jogo para que futuras evoluções não misturem matemática do jogo com saldo.
 *
 * Garantias:
 * - o saldo nunca fica negativo (débito insuficiente é recusado);
 * - um mesmo roundId nunca é debitado duas vezes nem creditado duas vezes (idempotência);
 * - toda operação gera um registro no histórico local (limitado).
 */

export interface WalletEntry {
  id: string;
  /** 'debit' = aposta, 'credit' = prêmio, 'reset' = reinício, 'free' = giro grátis (sem débito) */
  type: 'debit' | 'credit' | 'reset' | 'free';
  amount: number;
  balanceAfter: number;
  at: number;
  note?: string;
}

export interface SpinHistoryEntry {
  roundId: string;
  at: number;
  bet: number;
  win: number;
  freeSpin: boolean;
  multiplier: number;
  /** resumo compacto do grid (reel-major) para exibição no histórico */
  grid: string[][];
  triggeredFreeSpins: boolean;
}

export interface WalletSnapshot {
  version: 1;
  balance: number;
  betIndex: number;
  entries: WalletEntry[];
  spins: SpinHistoryEntry[];
  settledRounds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WalletOptions {
  storage?: KeyValueStorage;
  storageKey?: string;
  initialBalance?: number;
  maxEntries?: number;
  maxSpins?: number;
  now?: () => number;
}

export type WalletListener = (wallet: DemoWallet) => void;

export class DemoWallet {
  readonly initialBalance: number;
  private readonly storage: KeyValueStorage;
  private readonly storageKey: string;
  private readonly maxEntries: number;
  private readonly maxSpins: number;
  private readonly now: () => number;
  private snapshot: WalletSnapshot;
  private readonly debited = new Set<string>();
  private readonly credited = new Set<string>();
  private readonly listeners = new Set<WalletListener>();

  constructor(options: WalletOptions = {}) {
    this.storage = options.storage ?? createDefaultStorage();
    this.storageKey = options.storageKey ?? 'cassino.demo-wallet.v1';
    this.initialBalance = options.initialBalance ?? 1000_00;
    this.maxEntries = options.maxEntries ?? 200;
    this.maxSpins = options.maxSpins ?? 50;
    this.now = options.now ?? (() => Date.now());
    this.snapshot = this.load();
    for (const id of this.snapshot.settledRounds) {
      this.debited.add(id);
      this.credited.add(id);
    }
  }

  // ------------------------------------------------------------------ leitura

  get balance(): number {
    return this.snapshot.balance;
  }

  get betIndex(): number {
    return this.snapshot.betIndex;
  }

  get entries(): readonly WalletEntry[] {
    return this.snapshot.entries;
  }

  get spins(): readonly SpinHistoryEntry[] {
    return this.snapshot.spins;
  }

  canAfford(amount: number): boolean {
    return amount >= 0 && this.snapshot.balance >= amount;
  }

  hasDebited(roundId: string): boolean {
    return this.debited.has(roundId);
  }

  hasCredited(roundId: string): boolean {
    return this.credited.has(roundId);
  }

  // ------------------------------------------------------------------ escrita

  /**
   * Debita a aposta de uma rodada. Devolve false (sem alterar nada) se o saldo for insuficiente
   * ou se a rodada já tiver sido debitada.
   */
  debit(amount: number, roundId: string, note?: string): boolean {
    assertAmount(amount);
    if (this.debited.has(roundId)) return false;
    if (!this.canAfford(amount)) return false;
    this.debited.add(roundId);
    this.snapshot.balance -= amount;
    this.push({ id: roundId, type: 'debit', amount, balanceAfter: this.snapshot.balance, at: this.now(), note });
    this.persist();
    return true;
  }

  /** Marca uma rodada grátis (sem débito) como iniciada; impede crédito duplicado depois. */
  registerFreeRound(roundId: string, note?: string): boolean {
    if (this.debited.has(roundId)) return false;
    this.debited.add(roundId);
    this.push({ id: roundId, type: 'free', amount: 0, balanceAfter: this.snapshot.balance, at: this.now(), note });
    this.persist();
    return true;
  }

  /** Credita o prêmio de uma rodada (uma única vez por roundId). */
  credit(amount: number, roundId: string, note?: string): boolean {
    assertAmount(amount);
    if (this.credited.has(roundId)) return false;
    this.credited.add(roundId);
    this.snapshot.settledRounds.push(roundId);
    if (this.snapshot.settledRounds.length > this.maxEntries) {
      this.snapshot.settledRounds.splice(0, this.snapshot.settledRounds.length - this.maxEntries);
    }
    if (amount > 0) {
      this.snapshot.balance += amount;
      this.push({ id: roundId, type: 'credit', amount, balanceAfter: this.snapshot.balance, at: this.now(), note });
    }
    this.persist();
    return true;
  }

  recordSpin(entry: SpinHistoryEntry): void {
    this.snapshot.spins.unshift(entry);
    if (this.snapshot.spins.length > this.maxSpins) this.snapshot.spins.length = this.maxSpins;
    this.persist();
  }

  setBetIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0) return;
    this.snapshot.betIndex = index;
    this.persist();
  }

  /** Reinicia os créditos fictícios para o saldo inicial. */
  reset(): void {
    this.snapshot.balance = this.initialBalance;
    this.push({ id: `reset-${this.now()}`, type: 'reset', amount: this.initialBalance, balanceAfter: this.initialBalance, at: this.now() });
    this.persist();
  }

  clearHistory(): void {
    this.snapshot.spins = [];
    this.snapshot.entries = [];
    this.persist();
  }

  onChange(listener: WalletListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------------ interno

  private push(entry: WalletEntry): void {
    this.snapshot.entries.unshift(entry);
    if (this.snapshot.entries.length > this.maxEntries) this.snapshot.entries.length = this.maxEntries;
  }

  private persist(): void {
    this.snapshot.updatedAt = this.now();
    try {
      this.storage.set(this.storageKey, JSON.stringify(this.snapshot));
    } catch {
      /* persistência é best-effort */
    }
    for (const l of this.listeners) l(this);
  }

  private load(): WalletSnapshot {
    const fresh: WalletSnapshot = {
      version: 1,
      balance: this.initialBalance,
      betIndex: -1,
      entries: [],
      spins: [],
      settledRounds: [],
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    try {
      const raw = this.storage.get(this.storageKey);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw) as Partial<WalletSnapshot>;
      if (parsed.version !== 1 || typeof parsed.balance !== 'number' || !Number.isFinite(parsed.balance)) return fresh;
      return {
        ...fresh,
        ...parsed,
        balance: Math.max(0, Math.round(parsed.balance)),
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        spins: Array.isArray(parsed.spins) ? parsed.spins : [],
        settledRounds: Array.isArray(parsed.settledRounds) ? parsed.settledRounds : [],
      };
    } catch {
      return fresh;
    }
  }
}

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`valor inválido: ${amount}`);
}
