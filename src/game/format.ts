/** Formata centavos de crédito no padrão brasileiro: 123456 → "1.234,56". */
export function formatCredits(cents: number, options: { decimals?: boolean } = {}): string {
  const decimals = options.decimals ?? true;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!decimals) return `${sign}${wholeStr}`;
  return `${sign}${wholeStr},${frac.toString().padStart(2, '0')}`;
}

/** "x3" / "x10" para multiplicadores inteiros, "x1,5" para fracionários. */
export function formatMultiplier(mult: number): string {
  return `x${Number.isInteger(mult) ? mult : mult.toString().replace('.', ',')}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
