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
    { id: S.WILD, name: 'Wild', kind: 'wild', pays: { 3: 200, 2: 10 } },
    { id: S.JAGUAR, name: 'Jaguar Dourado', kind: 'normal', pays: { 3: 125, 2: 8 } },
    { id: S.MASK, name: 'Máscara Ancestral', kind: 'normal', pays: { 3: 60, 2: 4 } },
    { id: S.CROWN, name: 'Coroa', kind: 'normal', pays: { 3: 40, 2: 2 } },
    { id: S.DIAMOND, name: 'Diamante', kind: 'normal', pays: { 3: 25, 2: 2 } },
    { id: S.BELL, name: 'Sino Dourado', kind: 'normal', pays: { 3: 16, 2: 1 } },
    { id: S.CLOVER, name: 'Trevo', kind: 'normal', pays: { 3: 12, 2: 1 } },
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
  // Cada rolo (36 posições) tem uma TRINCA de cada símbolo pagante: é isso que torna possível a
  // "tela cheia" (9 iguais) — o SUPER PRÊMIO (prêmio das 5 linhas × 10). Entre as trincas ficam
  // símbolos avulsos, o Wild e dois Bônus (nunca adjacentes, no máximo um por janela).
  reelStrips: [
    // rolo 1
    [
      S.JAGUAR, S.JAGUAR, S.JAGUAR, S.CHERRIES, S.MANGO, S.MANGO, S.MANGO, S.BONUS, S.DIAMOND, S.DIAMOND, S.DIAMOND, S.CHEST,
      S.CROWN, S.CROWN, S.CROWN, S.WILD, S.CLOVER, S.CLOVER, S.CLOVER, S.BELL, S.MASK, S.MASK, S.MASK, S.BONUS,
      S.BELL, S.BELL, S.BELL, S.MANGO, S.CHERRIES, S.CHERRIES, S.CHERRIES, S.DIAMOND, S.CHEST, S.CHEST, S.CHEST, S.CLOVER,
    ],
    // rolo 2
    [
      S.CHERRIES, S.CHERRIES, S.CHERRIES, S.MANGO, S.CROWN, S.CROWN, S.CROWN, S.WILD, S.BELL, S.BELL, S.BELL, S.BONUS,
      S.JAGUAR, S.JAGUAR, S.JAGUAR, S.CLOVER, S.CHEST, S.CHEST, S.CHEST, S.DIAMOND, S.CLOVER, S.CLOVER, S.CLOVER, S.BONUS,
      S.MANGO, S.MANGO, S.MANGO, S.CHERRIES, S.MASK, S.MASK, S.MASK, S.BELL, S.DIAMOND, S.DIAMOND, S.DIAMOND, S.CHEST,
    ],
    // rolo 3
    [
      S.CLOVER, S.CLOVER, S.CLOVER, S.DIAMOND, S.CHEST, S.CHEST, S.CHEST, S.BONUS, S.MASK, S.MASK, S.MASK, S.MANGO,
      S.CHERRIES, S.CHERRIES, S.CHERRIES, S.WILD, S.DIAMOND, S.DIAMOND, S.DIAMOND, S.CLOVER, S.JAGUAR, S.JAGUAR, S.JAGUAR, S.BELL,
      S.BELL, S.BELL, S.BELL, S.CHEST, S.MANGO, S.MANGO, S.MANGO, S.BONUS, S.CROWN, S.CROWN, S.CROWN, S.CHERRIES,
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
  // SUPER PRÊMIO: tela cheia com o mesmo símbolo multiplica o prêmio das linhas por 10
  fullScreen: { multiplier: 10 },
  // prêmio máximo anunciado: 2.500× a aposta (tela cheia de jaguares nos giros grátis chega ao teto)
  maxWinMultiple: 2500,
  winTiers: {
    big: 10,
    mega: 30,
    super: 100,
  },
  // centavos de crédito: 5, 10, 20, 50, 100, 200 créditos (todos divisíveis por 5 linhas)
  betLevels: [500, 1000, 2000, 5000, 10000, 20000],
  defaultBetIndex: 1,
};

/**
 * Números divulgados ao jogador (tela de carregamento, tabela de pagamentos, README).
 * Verificados por tests/rtp.test.ts contra a enumeração exata do jogo base + simulação do bônus.
 * Demonstração com créditos fictícios: RTP teórico, NÃO certificado.
 */
export const JAGUAR_GOLD_INFO = {
  /** retorno teórico total (%) */
  rtpPercent: 95.5,
  /** fração de giros com algum prêmio (%) */
  hitFrequencyPercent: 27,
  /** 1 em N giros aciona os giros grátis */
  bonusOneIn: 216,
  /** 1 em N giros dá tela cheia (super prêmio ×10) */
  fullScreenOneIn: 2600,
  /** 1 em N giros é Big Win (≥ 10×) / Mega Win (≥ 30×) / Super (≥ 100×) */
  bigOneIn: 75,
  megaOneIn: 676,
  superOneIn: 2750,
  /** maior prêmio possível no jogo base, em múltiplos da aposta (tela cheia de jaguares) */
  maxBaseWinMultiple: 1250,
  /** prêmio máximo de uma rodada (teto), em múltiplos da aposta */
  maxWinMultiple: JAGUAR_GOLD_MATH.maxWinMultiple,
  volatility: 'alta' as const,
};
