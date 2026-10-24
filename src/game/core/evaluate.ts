import type { FullScreenWin, LineWin, Position, ScatterWin, SlotMathConfig, SymbolDef, WinTier } from './types';

/** Indexa os símbolos por id para consultas O(1). */
export function symbolIndex(config: SlotMathConfig): Map<string, SymbolDef> {
  const map = new Map<string, SymbolDef>();
  for (const s of config.symbols) map.set(s.id, s);
  return map;
}

function payFor(def: SymbolDef | undefined, count: number): number {
  if (!def) return 0;
  return def.pays[count] ?? 0;
}

/**
 * Avalia as linhas de pagamento de um grid.
 * grid[reel][row]; símbolos "wild" substituem qualquer símbolo normal (nunca scatter).
 * Retorna vitórias em centavos JÁ multiplicadas por `multiplier`.
 */
export function evaluateLines(
  grid: string[][],
  config: SlotMathConfig,
  lineBet: number,
  multiplier = 1,
): LineWin[] {
  const symbols = symbolIndex(config);
  const wins: LineWin[] = [];

  config.paylines.forEach((line, lineIndex) => {
    const ids = line.map((row, reel) => grid[reel][row]);
    const defs = ids.map((id) => symbols.get(id));

    // quantidade de wilds consecutivos a partir da esquerda
    let wildRun = 0;
    while (wildRun < defs.length && defs[wildRun]?.kind === 'wild') wildRun += 1;

    // primeiro símbolo "normal" (candidato a pagar com ajuda de wilds)
    let candidate: SymbolDef | undefined;
    for (const d of defs) {
      if (d && d.kind === 'normal') {
        candidate = d;
        break;
      }
      if (d && d.kind === 'scatter') break; // scatter interrompe a linha
    }

    let candidateRun = 0;
    if (candidate) {
      for (const d of defs) {
        if (d && (d.id === candidate.id || d.kind === 'wild')) candidateRun += 1;
        else break;
      }
    }

    const wildDef = defs[0]?.kind === 'wild' ? defs[0] : undefined;
    const candidatePay = candidate ? payFor(candidate, candidateRun) : 0;
    const wildPay = wildDef ? payFor(wildDef, wildRun) : 0;

    let symbol: SymbolDef | undefined;
    let count = 0;
    let mult = 0;
    if (candidatePay >= wildPay && candidatePay > 0) {
      symbol = candidate;
      count = candidateRun;
      mult = candidatePay;
    } else if (wildPay > 0) {
      symbol = wildDef;
      count = wildRun;
      mult = wildPay;
    }

    if (symbol && mult > 0) {
      const positions: Position[] = [];
      for (let reel = 0; reel < count; reel += 1) positions.push({ reel, row: line[reel] });
      wins.push({
        lineIndex,
        symbol: symbol.id,
        count,
        positions,
        multiplier: mult,
        amount: Math.round(mult * lineBet) * multiplier,
      });
    }
  });

  return wins;
}

/** Conta scatters em qualquer posição e devolve o prêmio (em centavos, já multiplicado). */
export function evaluateScatter(
  grid: string[][],
  config: SlotMathConfig,
  totalBet: number,
  multiplier = 1,
): ScatterWin | null {
  const scatter = config.symbols.find((s) => s.kind === 'scatter');
  if (!scatter) return null;
  const positions: Position[] = [];
  grid.forEach((column, reel) => {
    column.forEach((id, row) => {
      if (id === scatter.id) positions.push({ reel, row });
    });
  });
  const count = positions.length;
  if (count === 0) return null;
  const mult = payFor(scatter, count);
  if (count < config.freeSpins.triggerCount && mult === 0) return null;
  return {
    symbol: scatter.id,
    count,
    positions,
    multiplier: mult,
    amount: Math.round(mult * totalBet) * multiplier,
  };
}

/**
 * "Tela cheia": as 9 posições mostram o mesmo símbolo (wilds completam; scatter não conta).
 * Devolve o símbolo e o bônus = total das linhas × (multiplicador − 1).
 */
export function evaluateFullScreen(grid: string[][], config: SlotMathConfig, lineTotal: number): FullScreenWin | null {
  const fs = config.fullScreen;
  if (!fs || fs.multiplier <= 1 || lineTotal <= 0) return null;
  const symbols = symbolIndex(config);
  let symbol: string | null = null;
  let wilds = 0;
  for (const column of grid) {
    for (const id of column) {
      const def = symbols.get(id);
      if (!def || def.kind === 'scatter') return null;
      if (def.kind === 'wild') {
        wilds += 1;
        continue;
      }
      if (symbol === null) symbol = id;
      else if (symbol !== id) return null;
    }
  }
  const total = config.reels * config.rows;
  if (wilds === total) symbol = config.symbols.find((s) => s.kind === 'wild')?.id ?? null;
  if (symbol === null) return null;
  return { symbol, multiplier: fs.multiplier, bonusAmount: lineTotal * (fs.multiplier - 1) };
}

export function classifyWin(totalWin: number, totalBet: number, config: SlotMathConfig): WinTier {
  if (totalWin <= 0) return 'none';
  const ratio = totalWin / totalBet;
  if (ratio >= config.winTiers.super) return 'super';
  if (ratio >= config.winTiers.mega) return 'mega';
  if (ratio >= config.winTiers.big) return 'big';
  return 'normal';
}

/** Monta o grid visível a partir das paradas (stops) de cada tira. */
export function gridFromStops(stops: number[], config: SlotMathConfig): string[][] {
  return config.reelStrips.map((strip, reel) => {
    const stop = stops[reel];
    const column: string[] = [];
    for (let row = 0; row < config.rows; row += 1) {
      column.push(strip[(stop + row) % strip.length]);
    }
    return column;
  });
}
