/**
 * Localize a page from _locales/<lang>/messages.json.
 *   <h1 data-i18n="managerTitle"></h1>                       → textContent
 *   <input data-i18n-attr="placeholder:searchHint,title:x">  → attributes
 * Thunderbird picks the locale from its UI language and falls back to default_locale (en).
 */
export function applyI18n(root = document, getMessage = (k) => messenger.i18n.getMessage(k)) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const text = getMessage(el.dataset.i18n);
    if (text) el.textContent = text;
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(",")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      const text = attr && key ? getMessage(key) : "";
      if (text) el.setAttribute(attr, text);
    }
  }
}

/** "es-ES" → "es"; used for <html lang> and locale-aware sorting. */
export function uiLanguage(getUILanguage = () => messenger.i18n.getUILanguage()) {
  return (getUILanguage() || "en").split(/[-_]/)[0].toLowerCase();
}

/** Translate a message key with optional substitutions ($1, $2… placeholders). Falls back to the key. */
export function t(key, ...subs) {
  return messenger.i18n.getMessage(key, subs.map(String)) || key;
}
