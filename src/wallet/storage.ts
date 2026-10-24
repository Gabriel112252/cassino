/** Abstração de persistência para a carteira (localStorage no navegador, memória em testes). */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
  }

  remove(key: string): void {
    this.map.delete(key);
  }
}

/** localStorage com proteção: modo privado/cota cheia nunca derruba o jogo. */
export class BrowserStorage implements KeyValueStorage {
  private readonly fallback = new MemoryStorage();

  private get store(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage;
    } catch {
      return null;
    }
  }

  get(key: string): string | null {
    try {
      const s = this.store;
      return s ? s.getItem(key) : this.fallback.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  set(key: string, value: string): void {
    try {
      const s = this.store;
      if (s) s.setItem(key, value);
      else this.fallback.set(key, value);
    } catch {
      this.fallback.set(key, value);
    }
  }

  remove(key: string): void {
    try {
      const s = this.store;
      if (s) s.removeItem(key);
      else this.fallback.remove(key);
    } catch {
      this.fallback.remove(key);
    }
  }
}

export function createDefaultStorage(): KeyValueStorage {
  return typeof window !== 'undefined' ? new BrowserStorage() : new MemoryStorage();
}
