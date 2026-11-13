/**
 * HTML allowlist for snippet bodies. Everything stored or imported goes through here:
 * import files are untrusted input, and snippet HTML is inserted into outgoing mail.
 * Needs a DOM (extension pages / background event page / jsdom in tests).
 */
import DOMPurify from "../vendor/purify.es.mjs";

export const ALLOWED_TAGS = [
  "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
  "ul", "ol", "li", "a", "blockquote", "pre", "code", "h1", "h2", "h3", "hr",
];
export const ALLOWED_ATTR = ["href", "title"];
/** Links may only point to web, mail or phone targets (no javascript:, data:, file:, relative). */
export const SAFE_URL_RE = /^(?:https?|mailto|tel):/i;

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(String(html ?? ""), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URL_RE,
    KEEP_CONTENT: true, // unknown wrappers (<font>, <section>…) are unwrapped, text kept
  }).trim();
}
