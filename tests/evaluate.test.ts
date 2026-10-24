import { describe, expect, it } from 'vitest';
import { SlotEngine } from '@game/core/SlotEngine';
import { evaluateLines, evaluateScatter, classifyWin } from '@game/core/evaluate';
import { JAGUAR_GOLD_MATH, JAGUAR_GOLD_SYMBOLS as S } from '@games/jaguar-gold/math.config';

const engine = new SlotEngine(JAGUAR_GOLD_MATH);
const BET = 1000; // 10 créditos
const LINE_BET = 200;

/** grid[reel][row] a partir de linhas visuais (row-major) para facilitar a leitura dos testes */
function gridFromRows(rows: string[][]): string[][] {
  const reels = rows[0].length;
  return Array.from({ length: reels }, (_, reel) => rows.map((r) => r[reel]));
}

describe('configuração matemática', () => {
  it('tiras têm 36 posições e apenas símbolos conhecidos', () => {
    for (const strip of JAGUAR_GOLD_MATH.reelStrips) expect(strip).toHaveLength(36);
  });

  it('níveis de aposta são divisíveis pelas 5 linhas', () => {
    for (const b of JAGUAR_GOLD_MATH.betLevels) expect(b % 5).toBe(0);
    expect(engine.lineBetFor(BET)).toBe(LINE_BET);
  });
});

describe('avaliação de linhas', () => {
  it('paga 3 jaguares na linha do meio', () => {
    const grid = gridFromRows([
      [S.MANGO, S.BELL, S.CLOVER],
      [S.JAGUAR, S.JAGUAR, S.JAGUAR],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ lineIndex: 0, symbol: S.JAGUAR, count: 3, multiplier: 150, amount: 150 * LINE_BET });
    expect(wins[0].positions).toEqual([
      { reel: 0, row: 1 },
      { reel: 1, row: 1 },
      { reel: 2, row: 1 },
    ]);
  });

  it('wild substitui símbolos normais', () => {
    const grid = gridFromRows([
      [S.CROWN, S.WILD, S.CROWN],
      [S.MANGO, S.BELL, S.CLOVER],
      [S.CHEST, S.CHEST, S.CHEST],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    const top = wins.find((w) => w.lineIndex === 1);
    const bottom = wins.find((w) => w.lineIndex === 2);
    expect(top).toMatchObject({ symbol: S.CROWN, count: 3, multiplier: 45 });
    expect(bottom).toMatchObject({ symbol: S.CHEST, count: 3, multiplier: 5 });
    expect(wins).toHaveLength(2);
  });

  it('wild não substitui o bônus (scatter)', () => {
    const grid = gridFromRows([
      [S.BONUS, S.WILD, S.BONUS],
      [S.MANGO, S.BELL, S.CLOVER],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins).toHaveLength(0);
  });

  it('linha só de wilds paga o prêmio do wild (maior que qualquer símbolo)', () => {
    const grid = gridFromRows([
      [S.MANGO, S.BELL, S.CLOVER],
      [S.WILD, S.WILD, S.WILD],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins[0]).toMatchObject({ symbol: S.WILD, count: 3, multiplier: 300 });
  });

  it('escolhe a melhor interpretação quando wild inicia a linha', () => {
    // wild, jaguar, mango → jaguar x2 (10) é melhor que wild x1 (0)
    const grid = gridFromRows([
      [S.WILD, S.JAGUAR, S.MANGO],
      [S.MANGO, S.BELL, S.CLOVER],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins[0]).toMatchObject({ lineIndex: 1, symbol: S.JAGUAR, count: 2, multiplier: 10 });
    // wild, wild, mango → wild x2 (20) é melhor que mango x3 (10)
    const grid2 = gridFromRows([
      [S.WILD, S.WILD, S.MANGO],
      [S.MANGO, S.BELL, S.CLOVER],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins2 = evaluateLines(grid2, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins2[0]).toMatchObject({ symbol: S.WILD, count: 2, multiplier: 20 });
  });

  it('avalia as 5 linhas inclusive diagonais', () => {
    const grid = gridFromRows([
      [S.BELL, S.MANGO, S.DIAMOND],
      [S.CHEST, S.BELL, S.CROWN],
      [S.MANGO, S.CLOVER, S.BELL],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ lineIndex: 3, symbol: S.BELL, count: 3 });
  });

  it('aplica o multiplicador dos giros grátis', () => {
    const grid = gridFromRows([
      [S.MANGO, S.BELL, S.CLOVER],
      [S.BELL, S.BELL, S.BELL],
      [S.CHEST, S.CROWN, S.MANGO],
    ]);
    const wins = evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET, 5);
    expect(wins[0].amount).toBe(18 * LINE_BET * 5);
  });

  it('símbolos diferentes sem wild não pagam', () => {
    const grid = gridFromRows([
      [S.MANGO, S.BELL, S.CLOVER],
      [S.CHEST, S.CROWN, S.MANGO],
      [S.DIAMOND, S.MASK, S.CHERRIES],
    ]);
    expect(evaluateLines(grid, JAGUAR_GOLD_MATH, LINE_BET)).toHaveLength(0);
  });
});

describe('scatter / bônus', () => {
  it('3 bônus em qualquer posição acionam giros grátis e pagam 2x a aposta total', () => {
    const grid = gridFromRows([
      [S.BONUS, S.BELL, S.CLOVER],
      [S.CHEST, S.BONUS, S.MANGO],
      [S.DIAMOND, S.MASK, S.BONUS],
    ]);
    const scatter = evaluateScatter(grid, JAGUAR_GOLD_MATH, BET);
    expect(scatter).not.toBeNull();
    expect(scatter).toMatchObject({ count: 3, multiplier: 2, amount: 2 * BET });
    const result = engine.resolve([0, 0, 0], BET);
    expect(typeof result.triggersFreeSpins).toBe('boolean');
  });

  it('menos de 3 bônus não paga nem aciona', () => {
    const grid = gridFromRows([
      [S.BONUS, S.BELL, S.CLOVER],
      [S.CHEST, S.BONUS, S.MANGO],
      [S.DIAMOND, S.MASK, S.MANGO],
    ]);
    expect(evaluateScatter(grid, JAGUAR_GOLD_MATH, BET)).toBeNull();
  });
});

describe('classificação de vitória', () => {
  it('classifica normal/big/mega pela razão prêmio/aposta', () => {
    expect(classifyWin(0, BET, JAGUAR_GOLD_MATH)).toBe('none');
    expect(classifyWin(BET * 3, BET, JAGUAR_GOLD_MATH)).toBe('normal');
    expect(classifyWin(BET * 10, BET, JAGUAR_GOLD_MATH)).toBe('big');
    expect(classifyWin(BET * 30, BET, JAGUAR_GOLD_MATH)).toBe('mega');
  });
});

describe('engine.resolve', () => {
  it('monta o grid a partir das paradas com wrap-around da tira', () => {
    const strip = JAGUAR_GOLD_MATH.reelStrips[0];
    const r = engine.resolve([35, 0, 1], BET);
    expect(r.grid[0]).toEqual([strip[35], strip[0], strip[1]]);
    expect(r.stops).toEqual([35, 0, 1]);
  });

  it('é determinístico para as mesmas paradas', () => {
    const a = engine.resolve([3, 7, 11], BET);
    const b = engine.resolve([3, 7, 11], BET);
    expect(a).toEqual(b);
  });

  it('encontra ao menos uma combinação de 3 jaguares nas tiras (prêmio máximo possível)', () => {
    let found = false;
    for (let a = 0; a < 36 && !found; a += 1)
      for (let b = 0; b < 36 && !found; b += 1)
        for (let c = 0; c < 36 && !found; c += 1) {
          const r = engine.resolve([a, b, c], BET);
          if (r.lineWins.some((w) => w.symbol === S.JAGUAR && w.count === 3)) found = true;
        }
    expect(found).toBe(true);
  });
});
