/** Safe nested property read for untrusted JSON. */
export function dig(value: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** Seed text is data, not instructions: strip control/markup characters and cap length. */
export function sanitizeText(input: string, max: number): string {
  return input
    .replace(/[\u0000-\u001f\u007f<>`{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Loose title comparison: case, accents, punctuation, "The", and (year) suffixes ignored. */
export function normName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}
