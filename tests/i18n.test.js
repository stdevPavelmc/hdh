// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { applyI18n, uiLanguage } from "../src/lib/i18n.js";

const dict = { title: "Fragmentos", hint: "Buscar…", tip: "Ayuda" };
const getMessage = (k) => dict[k] ?? "";

describe("applyI18n", () => {
  it("sets textContent from data-i18n", () => {
    document.body.innerHTML = `<h1 data-i18n="title">Snippets</h1>`;
    applyI18n(document, getMessage);
    expect(document.querySelector("h1").textContent).toBe("Fragmentos");
  });

  it("sets attributes from data-i18n-attr", () => {
    document.body.innerHTML = `<input data-i18n-attr="placeholder:hint, title:tip">`;
    applyI18n(document, getMessage);
    const input = document.querySelector("input");
    expect(input.placeholder).toBe("Buscar…");
    expect(input.title).toBe("Ayuda");
  });

  it("keeps the original text when a key is missing", () => {
    document.body.innerHTML = `<p data-i18n="missing">Fallback</p>`;
    applyI18n(document, getMessage);
    expect(document.querySelector("p").textContent).toBe("Fallback");
  });
});

describe("uiLanguage", () => {
  it.each([["es-ES", "es"], ["es_AR", "es"], ["en-US", "en"], ["de", "de"], ["", "en"]])(
    "%s → %s",
    (input, expected) => expect(uiLanguage(() => input)).toBe(expected),
  );
});
