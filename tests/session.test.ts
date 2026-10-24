import { describe, expect, it } from 'vitest';
import { GameSession } from '@game/core/GameSession';
import { SlotEngine } from '@game/core/SlotEngine';
import { FixedStopsRng, SeededRng } from '@game/core/rng';
import type { SpinResult } from '@game/core/types';
import { JAGUAR_GOLD_MATH } from '@games/jaguar-gold/math.config';
import { DemoWallet } from '@wallet/DemoWallet';
import { MemoryStorage } from '@wallet/storage';

const engine = new SlotEngine(JAGUAR_GOLD_MATH);

/** procura paradas que satisfaçam um predicado (para forçar cenários sem alterar a engine) */
function findStops(pred: (r: SpinResult) => boolean): number[] {
  for (let a = 0; a < 36; a += 1)
    for (let b = 0; b < 36; b += 1)
      for (let c = 0; c < 36; c += 1) {
        const r = engine.resolve([a, b, c], 1000);
        if (pred(r)) return [a, b, c];
      }
  throw new Error('cenário não encontrado');
}

const LOSING = findStops((r) => r.totalWin === 0 && !r.triggersFreeSpins);
const WINNING = findStops((r) => r.totalWin > 0 && !r.triggersFreeSpins && r.scatterWin === null);
const TRIGGER = findStops((r) => r.triggersFreeSpins);

function makeSession(stops: number[][], balance = 1000_00) {
  const wallet = new DemoWallet({ storage: new MemoryStorage(), initialBalance: balance });
  const rng = new FixedStopsRng(stops.flat());
  const session = new GameSession(engine, wallet, { rng, now: () => 123 });
  return { wallet, session };
}

describe('GameSession', () => {
  it('debita antes do resultado e credita ao concluir, uma única vez', () => {
    const { session, wallet } = makeSession([WINNING]);
    expect(session.bet).toBe(1000);
    const round = session.startSpin();
    expect(session.state).toBe('spinning');
    expect(wallet.balance).toBe(1000_00 - 1000);
    expect(round.result.totalWin).toBeGreaterThan(0);
    expect(round.balanceAfterDebit).toBe(wallet.balance);

    const settled = session.completeSpin(round.roundId);
    expect(session.state).toBe('idle');
    expect(settled.totalWin).toBe(round.result.totalWin);
    expect(wallet.balance).toBe(1000_00 - 1000 + round.result.totalWin);
    expect(() => session.completeSpin(round.roundId)).toThrow(); // não liquida duas vezes
    expect(wallet.balance).toBe(1000_00 - 1000 + round.result.totalWin);
    expect(wallet.spins).toHaveLength(1);
  });

  it('não permite giros concorrentes', () => {
    const { session } = makeSession([LOSING, LOSING]);
    const round = session.startSpin();
    expect(session.canSpin()).toEqual({ ok: false, reason: 'spinning' });
    expect(() => session.startSpin()).toThrow();
    session.completeSpin(round.roundId);
    expect(session.canSpin()).toEqual({ ok: true });
  });

  it('bloqueia o giro com saldo insuficiente e nunca fica negativo', () => {
    const { session, wallet } = makeSession([LOSING, LOSING], 1500);
    const r1 = session.startSpin();
    session.completeSpin(r1.roundId);
    expect(wallet.balance).toBe(500);
    expect(session.canSpin()).toEqual({ ok: false, reason: 'insufficient-balance' });
    expect(() => session.startSpin()).toThrow();
    expect(wallet.balance).toBe(500);
  });

  it('troca de aposta só em idle e persiste o nível', () => {
    const { session, wallet } = makeSession([LOSING]);
    expect(session.nextBet()).toBe(true);
    expect(session.bet).toBe(2000);
    expect(wallet.betIndex).toBe(2);
    const round = session.startSpin();
    expect(session.nextBet()).toBe(false);
    session.completeSpin(round.roundId);
    expect(session.setBetIndex(99)).toBe(false);
    expect(session.prevBet()).toBe(true);
    expect(session.bet).toBe(1000);
  });

  it('aciona giros grátis, não debita durante o bônus e aplica multiplicador crescente', () => {
    // 1 giro que aciona + 10 giros grátis (alternando vencedor/perdedor) + 1 giro normal
    const stops = [TRIGGER, ...Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? WINNING : LOSING)), LOSING];
    const { session, wallet } = makeSession(stops);
    const trigger = session.startSpin();
    expect(trigger.result.triggersFreeSpins).toBe(true);
    const settled = session.completeSpin(trigger.roundId);
    expect(settled.freeSpinsStarted).toBe(true);
    expect(settled.nextIsFreeSpin).toBe(true);
    expect(session.freeSpinsState).toMatchObject({ active: true, remaining: 10, multiplier: 2, bet: 1000 });
    expect(session.canChangeBet()).toBe(false);

    const balanceBefore = wallet.balance;
    let expectedMult = 2;
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      const round = session.startSpin();
      expect(round.freeSpin).toBe(true);
      expect(round.result.multiplier).toBe(expectedMult);
      expect(round.balanceAfterDebit).toBe(wallet.balance); // sem débito
      const s = session.completeSpin(round.roundId);
      total += round.result.totalWin;
      if (round.result.totalWin > 0) expectedMult = Math.min(10, expectedMult + 1);
      if (i < 9) expect(s.freeSpinsEnded).toBe(false);
      else {
        expect(s.freeSpinsEnded).toBe(true);
        expect(s.freeSpinsTotal).toBe(total);
      }
    }
    expect(wallet.balance).toBe(balanceBefore + total);
    expect(session.freeSpinsState.active).toBe(false);
    expect(session.canChangeBet()).toBe(true);
    // a rodada seguinte volta a debitar
    const normal = session.startSpin();
    expect(normal.freeSpin).toBe(false);
    expect(wallet.balance).toBe(balanceBefore + total - 1000);
    session.completeSpin(normal.roundId);
  });

  it('reaciona giros grátis durante o bônus', () => {
    const stops = [TRIGGER, TRIGGER, ...Array.from({ length: 14 }, () => LOSING)];
    const { session } = makeSession(stops);
    const t = session.startSpin();
    session.completeSpin(t.roundId);
    const r = session.startSpin();
    const s = session.completeSpin(r.roundId);
    expect(s.freeSpinsRetriggered).toBe(true);
    expect(session.freeSpinsState.remaining).toBe(9 + 5);
    expect(session.freeSpinsState.awarded).toBe(15);
  });

  it('reinício de créditos só em idle fora do bônus', () => {
    const { session, wallet } = makeSession([LOSING]);
    const round = session.startSpin();
    expect(session.resetCredits()).toBe(false);
    session.completeSpin(round.roundId);
    expect(session.resetCredits()).toBe(true);
    expect(wallet.balance).toBe(1000_00);
  });

  it('o resultado não depende de saldo ou histórico (mesma semente ⇒ mesmo resultado)', () => {
    const run = (balance: number) => {
      const wallet = new DemoWallet({ storage: new MemoryStorage(), initialBalance: balance });
      const session = new GameSession(engine, wallet, { rng: new SeededRng(42), now: () => 1 });
      const grids: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        const round = session.startSpin();
        grids.push(round.result.grid.flat().join(','));
        session.completeSpin(round.roundId);
      }
      return grids;
    };
    expect(run(1000_00)).toEqual(run(50_000_00));
  });

  it('emite eventos de rodada e estado', () => {
    const { session } = makeSession([WINNING]);
    const events: string[] = [];
    session.events.on('state', (s) => events.push(`state:${s}`));
    session.events.on('roundStarted', () => events.push('started'));
    session.events.on('roundSettled', () => events.push('settled'));
    const round = session.startSpin();
    session.completeSpin(round.roundId);
    expect(events).toEqual(['state:spinning', 'started', 'state:idle', 'settled']);
  });
});
