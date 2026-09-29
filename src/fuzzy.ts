// Typo tolerance. Deterministic and fast: plain edit distance, no AI.

/**
 * Edit distance where swapping two neighbouring letters counts as one edit
 * (so "trinagle" is 1 away from "triangle"). Gives up early past `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { rows[0][j] = j; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i][j] = d;
      best = Math.min(best, d);
    }
    if (i > 0 && best > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** How many typos a word of this length may contain. */
export function allowedTypos(word: string): number {
  return word.length <= 2 ? 0 : word.length <= 4 ? 1 : 2;
}

/**
 * The single closest word in `vocabulary`, if it's close enough.
 * Ties are broken in favour of words of the same length, then words with the
 * same letters ("form" → "from", not "for"; "cso" → "cos", not "csc").
 * Returns null when it's still a tie (too ambiguous to guess).
 */
export function closest(word: string, vocabulary: readonly string[], max = allowedTypos(word)): string | null {
  const sorted = (s: string) => [...s].sort().join('');
  const score = (candidate: string, dist: number) =>
    dist * 4 + (candidate.length === word.length ? 0 : 2) + (sorted(candidate) === sorted(word) ? 0 : 1);

  let best: string | null = null;
  let bestScore = Infinity;
  let tie = false;
  for (const candidate of new Set(vocabulary)) {
    const d = editDistance(word, candidate, max);
    if (d > max) continue;
    const sc = score(candidate, d);
    if (sc < bestScore) { best = candidate; bestScore = sc; tie = false; }
    else if (sc === bestScore) tie = true;
  }
  return tie ? null : best;
}
