/**
 * Tipos da lógica matemática do caça-níquel.
 * Este módulo é independente de Phaser/DOM: pode ser testado em Node puro.
 * Todos os valores monetários (créditos fictícios) são inteiros em CENTAVOS de crédito.
 */

export type SymbolKind = 'normal' | 'wild' | 'scatter';

export interface SymbolDef {
  /** identificador estável usado em config, texturas e testes */
  id: string;
  /** nome exibido ao jogador (pt-BR) */
  name: string;
  kind: SymbolKind;
  /**
   * Prêmios por quantidade de símbolos iguais consecutivos da esquerda para a direita,
   * expressos como MULTIPLICADOR DA APOSTA POR LINHA (ex.: `{3: 100, 2: 8}`).
   * Para scatter, o multiplicador é sobre a APOSTA TOTAL.
   */
  pays: Readonly<Record<number, number>>;
}

/** Linha de pagamento: índice da linha (row) em cada rolo, da esquerda para a direita. */
export type Payline = readonly number[];

export interface FreeSpinsConfig {
  /** quantidade de scatters necessária para acionar */
  triggerCount: number;
  /** giros concedidos no acionamento */
  spinsAwarded: number;
  /** giros extras ao reacionar durante os giros grátis */
  retriggerSpins: number;
  /** multiplicador inicial dos giros grátis */
  startMultiplier: number;
  /** incremento do multiplicador após cada giro grátis vencedor */
  multiplierStep: number;
  /** teto do multiplicador */
  maxMultiplier: number;
}

export interface WinTiers {
  /** vitória "normal" a partir de X vezes a aposta total */
  big: number;
  /** vitória "mega" a partir de X vezes a aposta total */
  mega: number;
  /** "super prêmio" a partir de X vezes a aposta total */
  super: number;
}

export interface FullScreenConfig {
  /** multiplicador aplicado ao total das linhas quando as 9 posições mostram o mesmo símbolo (wild conta) */
  multiplier: number;
}

export interface SlotMathConfig {
  id: string;
  reels: number;
  rows: number;
  symbols: readonly SymbolDef[];
  paylines: readonly Payline[];
  /** tiras (strips) de cada rolo; a posição de parada é uniforme sobre a tira */
  reelStrips: readonly (readonly string[])[];
  freeSpins: FreeSpinsConfig;
  /** "tela cheia": 9 símbolos iguais multiplicam o prêmio das linhas (opcional) */
  fullScreen?: FullScreenConfig;
  /** teto do prêmio de uma rodada, em múltiplos da aposta total (prêmio máximo anunciado) */
  maxWinMultiple: number;
  winTiers: WinTiers;
  /** valores de aposta total permitidos, em centavos */
  betLevels: readonly number[];
  defaultBetIndex: number;
}

export interface Position {
  reel: number;
  row: number;
}

export interface LineWin {
  lineIndex: number;
  symbol: string;
  count: number;
  positions: Position[];
  /** multiplicador da aposta por linha */
  multiplier: number;
  /** valor em centavos já com multiplicador de giros grátis aplicado */
  amount: number;
}

export interface ScatterWin {
  symbol: string;
  count: number;
  positions: Position[];
  /** multiplicador da aposta total */
  multiplier: number;
  amount: number;
}

export type WinTier = 'none' | 'normal' | 'big' | 'mega' | 'super';

export interface FullScreenWin {
  /** símbolo que preencheu a tela (wilds contam como o símbolo) */
  symbol: string;
  multiplier: number;
  /** valor extra creditado além das linhas (linhas × (multiplicador − 1)), em centavos */
  bonusAmount: number;
}

export interface SpinResult {
  /** posição de parada de cada rolo na tira */
  stops: number[];
  /** grid[reel][row] = id do símbolo */
  grid: string[][];
  lineWins: LineWin[];
  scatterWin: ScatterWin | null;
  /** tela cheia (9 iguais), quando ocorre */
  fullScreen: FullScreenWin | null;
  /** total em centavos (linhas × tela cheia + scatter), já multiplicado e limitado ao teto */
  totalWin: number;
  /** total antes do teto (prêmio máximo) */
  grossWin: number;
  /** true quando o prêmio bateu no teto (prêmio máximo da rodada) */
  capped: boolean;
  /** multiplicador aplicado neste giro (1 no jogo base) */
  multiplier: number;
  /** aposta total em centavos usada no giro */
  bet: number;
  /** aposta por linha em centavos */
  lineBet: number;
  /** true se o giro acionou (ou reacionou) giros grátis */
  triggersFreeSpins: boolean;
  tier: WinTier;
}
