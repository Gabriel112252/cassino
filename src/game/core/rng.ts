/**
 * Geradores de números aleatórios usados pela lógica do jogo.
 * - CryptoRng: produção (Web Crypto / Node crypto), não previsível.
 * - SeededRng: testes e simulações determinísticas (mulberry32).
 *
 * A interface é propositalmente mínima para que a lógica nunca dependa da UI nem de estado externo.
 */
export interface Rng {
  /** número uniforme em [0, 1) */
  next(): number;
  /** inteiro uniforme em [0, maxExclusive) */
  int(maxExclusive: number): number;
}

function resolveCrypto(): Crypto | undefined {
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto?.getRandomValues) {
    return (globalThis as { crypto?: Crypto }).crypto;
  }
  return undefined;
}

export class CryptoRng implements Rng {
  private readonly buffer = new Uint32Array(64);
  private index = this.buffer.length;
  private readonly crypto = resolveCrypto();

  next(): number {
    if (!this.crypto) {
      // fallback extremamente improvável (ambiente sem Web Crypto)
      return Math.random();
    }
    if (this.index >= this.buffer.length) {
      this.crypto.getRandomValues(this.buffer);
      this.index = 0;
    }
    return this.buffer[this.index++] / 4294967296;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`int(): maxExclusive inválido: ${maxExclusive}`);
    }
    if (!this.crypto) {
      return Math.floor(Math.random() * maxExclusive);
    }
    // rejection sampling para eliminar viés de módulo
    const limit = 4294967296 - (4294967296 % maxExclusive);
    for (;;) {
      if (this.index >= this.buffer.length) {
        this.crypto.getRandomValues(this.buffer);
        this.index = 0;
      }
      const v = this.buffer[this.index++];
      if (v < limit) return v % maxExclusive;
    }
  }
}

/** mulberry32 — determinístico, rápido, suficiente para testes/simulações. */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`int(): maxExclusive inválido: ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }
}

/** RNG de teste que devolve paradas pré-definidas (útil para forçar um grid específico). */
export class FixedStopsRng implements Rng {
  private cursor = 0;

  constructor(private readonly values: number[]) {}

  next(): number {
    return 0;
  }

  int(maxExclusive: number): number {
    const v = this.values[this.cursor % this.values.length];
    this.cursor += 1;
    return ((v % maxExclusive) + maxExclusive) % maxExclusive;
  }
}
