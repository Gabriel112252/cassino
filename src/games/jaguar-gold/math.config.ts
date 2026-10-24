import type { SlotMathConfig } from '@game/core/types';

/**
 * Configuração matemática do JAGUAR GOLD (jogo DEMONSTRATIVO).
 *
 * - 3 rolos x 3 linhas, 5 linhas de pagamento.
 * - Prêmios de linha = multiplicador x aposta POR LINHA (aposta total / 5).
 * - Prêmio do BÔNUS (scatter) = multiplicador x aposta TOTAL + aciona giros grátis.
 * - WILD substitui todos os símbolos, exceto BÔNUS.
 *
 * O RTP teórico é calculado por `tests/rtp.test.ts` (enumeração exata do jogo base + simulação dos giros grátis).
 * Não é um RTP certificado nem um jogo regulamentado: é uma demonstração com créditos fictícios.
 */

export const JAGUAR_GOLD_SYMBOLS = {
  JAGUAR: 'jaguar',
  MASK: 'mask',
  CROWN: 'crown',
  DIAMOND: 'diamond',
  BELL: 'bell',
  CLOVER: 'clover',
  MANGO: 'mango',
  CHERRIES: 'cherries',
  CHEST: 'chest',
  WILD: 'wild',
  BONUS: 'bonus',
} as const;

const S = JAGUAR_GOLD_SYMBOLS;

export const JAGUAR_GOLD_MATH: SlotMathConfig = {
  id: 'jaguar-gold',
  reels: 3,
  rows: 3,
  symbols: [
    { id: S.WILD, name: 'Wild', kind: 'wild', pays: { 3: 300, 2: 20 } },
    { id: S.JAGUAR, name: 'Jaguar Dourado', kind: 'normal', pays: { 3: 150, 2: 10 } },
    { id: S.MASK, name: 'Máscara Ancestral', kind: 'normal', pays: { 3: 70, 2: 4 } },
    { id: S.CROWN, name: 'Coroa', kind: 'normal', pays: { 3: 45, 2: 3 } },
    { id: S.DIAMOND, name: 'Diamante', kind: 'normal', pays: { 3: 28, 2: 2 } },
    { id: S.BELL, name: 'Sino Dourado', kind: 'normal', pays: { 3: 18 } },
    { id: S.CLOVER, name: 'Trevo', kind: 'normal', pays: { 3: 12 } },
    { id: S.MANGO, name: 'Manga', kind: 'normal', pays: { 3: 10 } },
    { id: S.CHERRIES, name: 'Cerejas', kind: 'normal', pays: { 3: 8 } },
    { id: S.CHEST, name: 'Baú do Tesouro', kind: 'normal', pays: { 3: 5 } },
    // scatter: multiplicador da aposta TOTAL
    { id: S.BONUS, name: 'Bônus (Giros Grátis)', kind: 'scatter', pays: { 3: 2 } },
  ],
  // row de cada rolo (0 = topo). Ordem: 3 horizontais + 2 diagonais.
  paylines: [
    [1, 1, 1], // linha 1 — meio
    [0, 0, 0], // linha 2 — topo
    [2, 2, 2], // linha 3 — base
    [0, 1, 2], // linha 4 — diagonal descendente
    [2, 1, 0], // linha 5 — diagonal ascendente
  ],
  reelStrips: [
    // rolo 1 (36)
    [
      S.MANGO, S.BELL, S.CHERRIES, S.CLOVER, S.CROWN, S.MANGO, S.DIAMOND, S.CHEST, S.BONUS, S.JAGUAR, S.CLOVER, S.BELL,
      S.MASK, S.MANGO, S.WILD, S.CHERRIES, S.DIAMOND, S.CLOVER, S.CHEST, S.BELL, S.MANGO, S.CROWN, S.CHERRIES, S.MASK,
      S.CLOVER, S.BONUS, S.DIAMOND, S.MANGO, S.BELL, S.CHEST, S.CHERRIES, S.CROWN, S.JAGUAR, S.CLOVER, S.MASK, S.DIAMOND,
    ],
    // rolo 2 (36)
    [
      S.CHERRIES, S.MANGO, S.CLOVER, S.BELL, S.WILD, S.DIAMOND, S.MANGO, S.CROWN, S.CLOVER, S.CHEST, S.BELL, S.JAGUAR,
      S.MANGO, S.BONUS, S.MASK, S.CLOVER, S.DIAMOND, S.BELL, S.CHEST, S.MANGO, S.BONUS, S.CROWN, S.CHERRIES, S.CLOVER,
      S.WILD, S.DIAMOND, S.MASK, S.MANGO, S.BELL, S.CHEST, S.JAGUAR, S.CLOVER, S.CROWN, S.CHERRIES, S.MASK, S.DIAMOND,
    ],
    // rolo 3 (36)
    [
      S.CLOVER, S.CHERRIES, S.MANGO, S.DIAMOND, S.BELL, S.CHEST, S.MANGO, S.CROWN, S.BONUS, S.CLOVER, S.JAGUAR, S.BELL,
      S.MANGO, S.MASK, S.DIAMOND, S.CHERRIES, S.WILD, S.CLOVER, S.CHEST, S.BELL, S.MANGO, S.CROWN, S.CHERRIES, S.MASK,
      S.CLOVER, S.DIAMOND, S.BONUS, S.MANGO, S.BELL, S.CHEST, S.CHERRIES, S.CROWN, S.JAGUAR, S.CLOVER, S.MASK, S.DIAMOND,
    ],
  ],
  freeSpins: {
    triggerCount: 3,
    spinsAwarded: 10,
    retriggerSpins: 5,
    startMultiplier: 2,
    multiplierStep: 1,
    maxMultiplier: 10,
  },
  winTiers: {
    big: 10,
    mega: 30,
  },
  // centavos de crédito: 5, 10, 20, 50, 100, 200 créditos (todos divisíveis por 5 linhas)
  betLevels: [500, 1000, 2000, 5000, 10000, 20000],
  defaultBetIndex: 1,
};
