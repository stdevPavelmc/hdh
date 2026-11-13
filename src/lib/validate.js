/**
 * Validation rules for snippet names, tags, bodies, settings and import files.
 * Error values are i18n message keys (see _locales/<lang>/messages.json).
 */

export const KEY_MAX_LENGTH = 32;
export const MAX_TAGS = 20;
export const BODY_MAX_LENGTH = 100_000;
export const EXPORT_FORMAT = "helpdesk-helper-snippets";
export const EXPORT_VERSION = 1;

/** One word of letters/digits (any language, so "español" is fine); "-" only between parts. */
export const KEY_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const DEFAULT_SETTINGS = Object.freeze({ trigger: "/", minChars: 3 });

/** Canonical form of a name/tag: trimmed, NFC, lowercase. */
export function normalizeKey(value) {
  return String(value ?? "").trim().normalize("NFC").toLowerCase();
}

/** @returns {string|null} i18n error key, or null when valid. Expects a normalized key. */
export function keyError(key) {
  if (!key) return "errKeyRequired";
  if ([...key].length > KEY_MAX_LENGTH) return "errKeyTooLong";
  if (/\s/u.test(key)) return "errKeySpaces";
  if (key.includes("_")) return "errKeyUnderscore";
  if (!KEY_RE.test(key)) return "errKeyInvalid";
  return null;
}

/** Split free user input ("info, spanish  product") into normalized tags, deduplicated. */
export function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? "").split(/[\s,;]+/u);
  return [...new Set(list.map(normalizeKey).filter(Boolean))];
}

/**
 * Validate a snippet draft against the existing collection.
 * `sanitize` (html → safe html) and `htmlText` (html → visible text) are injected so this
 * module stays DOM-free.
 * @returns {{ ok: boolean, errors: Record<string,string>, value?: object }}
 */
export function validateSnippet(draft, existing, { sanitize, htmlText }) {
  const errors = {};
  const name = normalizeKey(draft?.name);
  const nameErr = keyError(name);
  if (nameErr) errors.name = nameErr;
  else if (existing.some((s) => s.name === name && s.id !== draft.id)) errors.name = "errNameDuplicate";

  const tags = parseTags(draft?.tags ?? []);
  const badTag = tags.find((t) => keyError(t));
  if (badTag) errors.tags = keyError(badTag);
  else if (tags.length > MAX_TAGS) errors.tags = "errTooManyTags";

  const html = sanitize(String(draft?.html ?? ""));
  if (!htmlText(html).trim()) errors.html = "errBodyRequired";
  else if (html.length > BODY_MAX_LENGTH) errors.html = "errBodyTooLarge";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, errors, value: { id: draft.id, name, tags, html } };
}

/** @returns {{ ok: boolean, errors: Record<string,string>, value?: object }} */
export function validateSettings(input) {
  const errors = {};
  const trigger = String(input?.trigger ?? DEFAULT_SETTINGS.trigger).trim();
  // 1–3 symbols, no letters/digits/whitespace (those would fire while typing normal words).
  if (!/^[^\p{L}\p{N}\s]{1,3}$/u.test(trigger)) errors.trigger = "errTriggerInvalid";
  const minChars = Number(input?.minChars ?? DEFAULT_SETTINGS.minChars);
  if (!Number.isInteger(minChars) || minChars < 1 || minChars > 5) errors.minChars = "errMinCharsRange";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, errors, value: { trigger, minChars } };
}

/**
 * Check the envelope of an import file (snippets themselves are validated one by one later).
 * @returns {{ ok: boolean, error?: string, snippets?: object[] }}
 */
export function validateImportEnvelope(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "errImportNotJson" };
  if (data.format !== EXPORT_FORMAT) return { ok: false, error: "errImportFormat" };
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > EXPORT_VERSION) {
    return { ok: false, error: "errImportVersion" };
  }
  if (!Array.isArray(data.snippets)) return { ok: false, error: "errImportFormat" };
  return { ok: true, snippets: data.snippets };
}
