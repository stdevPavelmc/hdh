/**
 * Build the result list sent to the compose popup. Each item carries everything needed to
 * insert it synchronously (the keydown that inserts can't wait for another round trip).
 */
import { searchSnippets } from "./search.js";
import { htmlToText } from "./html2text.js";

export const MAX_RESULTS = 8;
const PREVIEW_LENGTH = 90;

export function buildPopupItems(snippets, query, { limit = MAX_RESULTS, locale } = {}) {
  if (!String(query ?? "").trim()) return [];
  return searchSnippets(snippets, query, { limit, locale }).map((s) => {
    const text = htmlToText(s.html);
    return {
      id: s.id,
      name: s.name,
      tags: s.tags,
      html: s.html, // already sanitized when stored
      text, // plain-text version for plain-text compose windows
      preview: text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH),
    };
  });
}
