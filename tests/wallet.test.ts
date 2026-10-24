import { describe, expect, it } from 'vitest';
import { DemoWallet } from '@wallet/DemoWallet';
import { MemoryStorage } from '@wallet/storage';

function wallet(balance = 1000_00) {
  return new DemoWallet({ storage: new MemoryStorage(), initialBalance: balance, now: () => 1_700_000_000_000 });
}

describe('DemoWallet (créditos fictícios)', () => {
  it('começa com 1.000 créditos por padrão', () => {
    expect(wallet().balance).toBe(1000_00);
  });

  it('debita a aposta e credita o prêmio uma única vez por rodada', () => {
    const w = wallet();
    expect(w.debit(10_00, 'r1')).toBe(true);
    expect(w.balance).toBe(990_00);
    expect(w.debit(10_00, 'r1')).toBe(false); // mesma rodada: não cobra duas vezes
    expect(w.balance).toBe(990_00);
    expect(w.credit(50_00, 'r1')).toBe(true);
    expect(w.credit(50_00, 'r1')).toBe(false); // crédito duplicado é ignorado
    expect(w.balance).toBe(1040_00);
  });

  it('nunca deixa o saldo negativo', () => {
    const w = wallet(5_00);
    expect(w.canAfford(10_00)).toBe(false);
    expect(w.debit(10_00, 'r1')).toBe(false);
    expect(w.balance).toBe(5_00);
    expect(w.debit(5_00, 'r2')).toBe(true);
    expect(w.balance).toBe(0);
    expect(w.debit(1, 'r3')).toBe(false);
    expect(w.balance).toBe(0);
  });

  it('rejeita valores inválidos', () => {
    const w = wallet();
    expect(() => w.debit(-1, 'x')).toThrow();
    expect(() => w.debit(1.5, 'x')).toThrow();
    expect(() => w.credit(-10, 'x')).toThrow();
  });

  it('giro grátis não debita mas impede registro duplicado', () => {
    const w = wallet();
    expect(w.registerFreeRound('f1')).toBe(true);
    expect(w.registerFreeRound('f1')).toBe(false);
    expect(w.balance).toBe(1000_00);
    expect(w.credit(30_00, 'f1')).toBe(true);
    expect(w.balance).toBe(1030_00);
  });

  it('persiste e restaura o estado (inclusive rodadas já liquidadas)', () => {
    const storage = new MemoryStorage();
    const a = new DemoWallet({ storage });
    a.debit(10_00, 'r1');
    a.credit(25_00, 'r1');
    a.setBetIndex(3);
    a.recordSpin({ roundId: 'r1', at: 1, bet: 10_00, win: 25_00, freeSpin: false, multiplier: 1, grid: [['a']], triggeredFreeSpins: false });

    const b = new DemoWallet({ storage });
    expect(b.balance).toBe(1015_00);
    expect(b.betIndex).toBe(3);
    expect(b.spins).toHaveLength(1);
    expect(b.credit(25_00, 'r1')).toBe(false); // não credita de novo após recarregar
    expect(b.balance).toBe(1015_00);
  });

  it('ignora dados corrompidos no storage', () => {
    const storage = new MemoryStorage();
    storage.set('cassino.demo-wallet.v1', '{not json');
    expect(new DemoWallet({ storage }).balance).toBe(1000_00);
    storage.set('cassino.demo-wallet.v1', JSON.stringify({ version: 1, balance: 'abc' }));
    expect(new DemoWallet({ storage }).balance).toBe(1000_00);
  });

  it('reinicia os créditos e limita o histórico', () => {
    const w = new DemoWallet({ storage: new MemoryStorage(), maxSpins: 3 });
    w.debit(10_00, 'r1');
    w.reset();
    expect(w.balance).toBe(1000_00);
    for (let i = 0; i < 5; i += 1) {
      w.recordSpin({ roundId: `s${i}`, at: i, bet: 1, win: 0, freeSpin: false, multiplier: 1, grid: [], triggeredFreeSpins: false });
    }
    expect(w.spins).toHaveLength(3);
    expect(w.spins[0].roundId).toBe('s4'); // mais recente primeiro
    w.clearHistory();
    expect(w.spins).toHaveLength(0);
  });

  it('notifica ouvintes em cada alteração', () => {
    const w = wallet();
    let calls = 0;
    const off = w.onChange(() => {
      calls += 1;
    });
    w.debit(1_00, 'r1');
    w.credit(0, 'r1');
    off();
    w.debit(1_00, 'r2');
    expect(calls).toBe(2);
  });
});
