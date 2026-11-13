/**
 * Snippet search for the "/query" popup and the manager's search box.
 * Ranking tiers (lower is better):
 *   0  a tag starts with the query
 *   1  the name starts with the query
 *   2  a tag or the name contains the query
 *   3  fuzzy: query letters appear in order in a tag or the name, first letter matching
 * Case- and accent-insensitive ("espa" finds "español").
 */

/** Lowercase and strip diacritics. */
export function fold(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** True when every char of q appears in word in order and the first chars match. */
export function isSubsequence(q, word) {
  if (!q || !word || word[0] !== q[0]) return false;
  let i = 0;
  for (const ch of word) {
    if (ch === q[i] && ++i === q.length) return true;
  }
  return false;
}

function rankOf(snippet, q) {
  const tags = snippet.tags.map(fold);
  const name = fold(snippet.name);
  if (tags.some((t) => t.startsWith(q))) return 0;
  if (name.startsWith(q)) return 1;
  if (tags.some((t) => t.includes(q)) || name.includes(q)) return 2;
  if (tags.some((t) => isSubsequence(q, t)) || isSubsequence(q, name)) return 3;
  return -1;
}

/**
 * @param {Array<{name:string,tags:string[]}>} snippets
 * @param {string} query  text typed after the trigger
 * @param {{limit?: number, locale?: string}} [opts]
 * @returns snippets sorted best-first (all snippets by name when query is empty)
 */
export function searchSnippets(snippets, query, { limit = Infinity, locale } = {}) {
  const q = fold(query).trim();
  const byName = (a, b) => a.name.localeCompare(b.name, locale);
  if (!q) return [...snippets].sort(byName).slice(0, limit);

  const scored = [];
  for (const s of snippets) {
    const rank = rankOf(s, q);
    if (rank >= 0) {
      const exact = s.tags.some((t) => fold(t) === q) || fold(s.name) === q;
      scored.push({ s, rank, exact });
    }
  }
  scored.sort((a, b) => a.rank - b.rank || Number(b.exact) - Number(a.exact) || byName(a.s, b.s));
  return scored.slice(0, limit).map((x) => x.s);
}
