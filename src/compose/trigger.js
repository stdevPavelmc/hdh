/* Help Desk Helper – trigger detection for the compose editor (classic script).
 * Loaded before content.js; exposes globalThis.HDHTrigger. Kept DOM-only so it can be unit tested. */
(() => {
  "use strict";

  // Elements that start a new line: text before them doesn't "touch" the trigger.
  const BOUNDARY = new Set([
    "BR", "P", "DIV", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6",
    "TD", "TH", "TR", "TABLE", "BODY", "HTML", "HR",
  ]);
  const SPACE_RE = /[\s\u00a0]/;

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** /(^|space)<trigger>(query of ≥ minChars letters/digits/-)$/ */
  function makeMatcher(trigger, minChars) {
    return new RegExp(`(^|[\\s\\u00a0])${escapeRe(trigger)}([\\p{L}\\p{N}-]{${minChars},})$`, "u");
  }

  /** The character visually just before `node`, or "\n" at a line/block boundary. */
  function charBeforeNode(node) {
    let n = node;
    while (n) {
      for (let prev = n.previousSibling; prev; prev = prev.previousSibling) {
        if (prev.nodeType === 3) {
          if (prev.data.length) return prev.data.slice(-1);
        } else if (prev.nodeType === 1) {
          if (BOUNDARY.has(prev.nodeName)) return "\n";
          const text = prev.textContent;
          if (text) return text.slice(-1);
        }
      }
      n = n.parentNode;
      if (!n || n.nodeType !== 1 || BOUNDARY.has(n.nodeName)) return "\n";
    }
    return "\n";
  }

  /**
   * Find "<trigger><query>" ending at the caret.
   * @returns {{node: Text, start: number, end: number, query: string} | null}
   *   start/end delimit the trigger + query inside `node`.
   */
  function findToken(selection, matcher) {
    if (!selection || !selection.isCollapsed || !selection.anchorNode) return null;
    const node = selection.anchorNode;
    if (node.nodeType !== 3) return null;
    const end = selection.anchorOffset;
    const m = node.data.slice(0, end).match(matcher);
    if (!m) return null;
    const start = m.index + m[1].length;
    // Trigger at the very start of this text node: look at what precedes the node
    // (e.g. "<b>word</b>/info" must not fire, "<br>/info" must).
    if (start === 0 && !SPACE_RE.test(charBeforeNode(node))) return null;
    return { node, start, end, query: m[2] };
  }

  globalThis.HDHTrigger = { makeMatcher, findToken, charBeforeNode };
})();
