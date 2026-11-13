import { describe, it, expect } from "vitest";
import {
  normalizeKey, keyError, parseTags, validateSnippet, validateSettings,
  validateImportEnvelope, KEY_MAX_LENGTH,
} from "../src/lib/validate.js";

// DOM-free stand-ins for the injected helpers.
const deps = { sanitize: (h) => h, htmlText: (h) => h.replace(/<[^>]*>/g, "") };

describe("normalizeKey", () => {
  it("trims, lowercases and NFC-normalizes", () => {
    expect(normalizeKey("  Info-Spanish ")).toBe("info-spanish");
    expect(normalizeKey("español")).toBe("español"); // decomposed ñ → composed
  });
});

describe("keyError (names and tags)", () => {
  it.each(["info", "info-spanish", "greet2", "español", "a-b-c", "x".repeat(KEY_MAX_LENGTH)])(
    "accepts %s", (k) => expect(keyError(k)).toBeNull(),
  );
  it.each([
    ["", "errKeyRequired"],
    ["info spanish", "errKeySpaces"],
    ["info_spanish", "errKeyUnderscore"],
    ["-info", "errKeyInvalid"],
    ["info-", "errKeyInvalid"],
    ["info--es", "errKeyInvalid"],
    ["info.es", "errKeyInvalid"],
    ["/info", "errKeyInvalid"],
    ["x".repeat(KEY_MAX_LENGTH + 1), "errKeyTooLong"],
  ])("rejects %j with %s", (k, err) => expect(keyError(k)).toBe(err));
});

describe("parseTags", () => {
  it("splits on spaces/commas/semicolons, normalizes and dedupes", () => {
    expect(parseTags("Info, product;  INFO greet")).toEqual(["info", "product", "greet"]);
  });
  it("accepts arrays", () => {
    expect(parseTags([" A ", "a", "b"])).toEqual(["a", "b"]);
  });
  it("returns [] for empty input", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});

describe("validateSnippet", () => {
  const existing = [{ id: "1", name: "greet-en", tags: ["greet"], html: "Hi" }];

  it("returns the normalized value when valid", () => {
    const r = validateSnippet({ name: " Info-ES ", tags: "info spanish", html: "<b>Hola</b>" }, existing, deps);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ id: undefined, name: "info-es", tags: ["info", "spanish"], html: "<b>Hola</b>" });
  });

  it("allows snippets without tags", () => {
    expect(validateSnippet({ name: "x", tags: [], html: "y" }, existing, deps).ok).toBe(true);
  });

  it("rejects duplicate names, but not when editing the same snippet", () => {
    expect(validateSnippet({ name: "GREET-EN", html: "x" }, existing, deps).errors.name).toBe("errNameDuplicate");
    expect(validateSnippet({ id: "1", name: "greet-en", html: "x" }, existing, deps).ok).toBe(true);
  });

  it("reports the first invalid tag", () => {
    expect(validateSnippet({ name: "x", tags: ["ok", "not_ok"], html: "y" }, [], deps).errors.tags)
      .toBe("errKeyUnderscore");
  });

  it("rejects bodies that are empty after sanitizing", () => {
    const r = validateSnippet({ name: "x", html: "<p> </p>" }, [], deps);
    expect(r.errors.html).toBe("errBodyRequired");
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`);
    expect(validateSnippet({ name: "x", tags, html: "y" }, [], deps).errors.tags).toBe("errTooManyTags");
  });

  it("collects several errors at once", () => {
    const r = validateSnippet({ name: "", tags: ["a b"], html: "" }, [], deps);
    expect(r.errors).toEqual({ name: "errKeyRequired", tags: "errKeySpaces", html: "errBodyRequired" });
  });
});

describe("validateSettings", () => {
  it.each(["/", "\\", ";;", "#", "//"])("accepts trigger %j", (trigger) => {
    expect(validateSettings({ trigger, minChars: 3 }).ok).toBe(true);
  });
  it.each(["", "a", "1", " ", "/ /", "////"])("rejects trigger %j", (trigger) => {
    expect(validateSettings({ trigger, minChars: 3 }).errors.trigger).toBe("errTriggerInvalid");
  });
  it.each([0, 6, 2.5, "x"])("rejects minChars %j", (minChars) => {
    expect(validateSettings({ trigger: "/", minChars }).errors.minChars).toBe("errMinCharsRange");
  });
  it("fills defaults", () => {
    expect(validateSettings({}).value).toEqual({ trigger: "/", minChars: 3 });
  });
});

describe("validateImportEnvelope", () => {
  const good = { format: "helpdesk-helper-snippets", version: 1, snippets: [] };
  it("accepts a valid export", () => expect(validateImportEnvelope(good).ok).toBe(true));
  it.each([
    [null, "errImportNotJson"],
    [[], "errImportNotJson"],
    [{ ...good, format: "other" }, "errImportFormat"],
    [{ ...good, version: 2 }, "errImportVersion"],
    [{ ...good, version: "1" }, "errImportVersion"],
    [{ ...good, snippets: {} }, "errImportFormat"],
  ])("rejects %j", (data, error) => expect(validateImportEnvelope(data).error).toBe(error));
});
