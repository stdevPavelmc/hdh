import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { SRC, readJson, readText, listFiles } from "./helpers.js";

const LOCALES = ["en", "es"];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, readJson(join(SRC, "_locales", l, "messages.json"))]),
);

describe("locales", () => {
  it("es has exactly the same keys as en", () => {
    expect(Object.keys(messages.es).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it.each(LOCALES)("%s has a non-empty message for every key", (l) => {
    for (const [key, entry] of Object.entries(messages[l])) {
      expect(typeof entry.message, `${l}.${key}`).toBe("string");
      expect(entry.message.trim(), `${l}.${key}`).not.toBe("");
    }
  });

  it("es uses the same placeholders as en", () => {
    for (const [key, entry] of Object.entries(messages.en)) {
      const names = (e) => Object.keys(e.placeholders || {}).sort();
      expect(names(messages.es[key]), key).toEqual(names(entry));
    }
  });

  it("every data-i18n key used in HTML pages exists", () => {
    for (const file of listFiles(SRC, ".html")) {
      const html = readText(file);
      const keys = [
        ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
        ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
          .flatMap((m) => m[1].split(",").map((p) => p.split(":")[1]?.trim())),
      ];
      for (const k of keys) expect(messages.en[k], `${file}: ${k}`).toBeDefined();
    }
  });
});

describe("error messages", () => {
  it("every err* key used in src/lib exists in every locale", () => {
    const used = new Set(
      listFiles(join(SRC, "lib"), ".js").flatMap((f) =>
        [...readText(f).matchAll(/"(err[A-Z]\w+)"/g)].map((m) => m[1])),
    );
    expect(used.size).toBeGreaterThan(5);
    for (const l of LOCALES) for (const k of used) expect(messages[l][k], `${l}.${k}`).toBeDefined();
  });
});
