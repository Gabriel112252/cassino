/**
 * Nível de qualidade gráfica. Em aparelhos muito fracos (poucos núcleos/memória) reduzimos as
 * camadas de efeito em tela cheia (névoa, raios) para manter os rolos fluidos.
 * Pode ser forçado pela URL: `?fx=low` ou `?fx=high`.
 */
export type Quality = 'high' | 'low';

let cached: Quality | undefined;

export function detectQuality(): Quality {
  if (cached) return cached;
  cached = 'high';
  if (typeof window === 'undefined') return cached;
  try {
    const param = new URLSearchParams(window.location.search).get('fx');
    if (param === 'low' || param === 'high') {
      cached = param;
      return cached;
    }
    const nav = window.navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    if (cores <= 2 || memory <= 2) cached = 'low';
  } catch {
    /* mantém 'high' */
  }
  return cached;
}
