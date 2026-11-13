import { describe, it, expect } from "vitest";
import { searchSnippets, fold, isSubsequence } from "../src/lib/search.js";

const S = (name, ...tags) => ({ name, tags });
const snippets = [
  S("greet-en", "greet", "greeting", "english"),
  S("greet-es", "greet", "spanish", "español"),
  S("info-product", "info", "product"),
  S("info-spanish", "info-spanish"),
  S("regards", "closing"),
  S("progress-update", "status"),
];
const names = (r) => r.map((s) => s.name);

describe("fold / isSubsequence", () => {
  it("folds case and accents", () => expect(fold("EspAÑól")).toBe("espanol"));
  it("matches letters in order with same first letter", () => {
    expect(isSubsequence("gret", "greeting")).toBe(true);
    expect(isSubsequence("rgt", "greeting")).toBe(false);
    expect(isSubsequence("gtr", "greeting")).toBe(false);
  });
});

describe("searchSnippets", () => {
  it("tier 0: tag prefix (then weaker 'contains' matches)", () => {
    // "progress-update" contains "gre" → listed after the tag-prefix matches
    expect(names(searchSnippets(snippets, "gre"))).toEqual(["greet-en", "greet-es", "progress-update"]);
  });

  it("tier 1: name prefix when no tag matches", () => {
    expect(names(searchSnippets(snippets, "regar"))).toEqual(["regards"]);
  });

  it("ranks tag prefix above name prefix", () => {
    const list = [S("status-old", "misc"), S("zzz", "status")];
    expect(names(searchSnippets(list, "stat"))).toEqual(["zzz", "status-old"]);
  });

  it("tier 2: contains (tag or name)", () => {
    expect(names(searchSnippets(snippets, "spani"))).toEqual(["greet-es", "info-spanish"]);
    expect(names(searchSnippets(snippets, "duct"))).toEqual(["info-product"]);
  });

  it("tier 3: fuzzy – /gret finds greeting", () => {
    expect(names(searchSnippets(snippets, "gret"))).toEqual(["greet-en", "greet-es"]);
  });

  it("puts prefix matches before fuzzy ones", () => {
    // "pro" = prefix of tag "product"; "progress-update" name prefix → tier 1
    expect(names(searchSnippets(snippets, "pro"))).toEqual(["info-product", "progress-update"]);
  });

  it("is accent-insensitive in both directions", () => {
    expect(names(searchSnippets(snippets, "espa"))).toEqual(["greet-es"]);
    expect(names(searchSnippets([S("x", "espanol")], "españ"))).toEqual(["x"]);
  });

  it("supports hyphenated queries", () => {
    expect(names(searchSnippets(snippets, "info-sp"))).toEqual(["info-spanish"]);
  });

  it("ranks exact matches first within a tier", () => {
    const list = [S("a", "infos"), S("b", "info")];
    expect(names(searchSnippets(list, "info"))).toEqual(["b", "a"]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchSnippets(snippets, "xyz")).toEqual([]);
  });

  it("returns everything by name for an empty query, and honours limit", () => {
    expect(searchSnippets(snippets, "").length).toBe(snippets.length);
    expect(names(searchSnippets(snippets, "", { limit: 2 }))).toEqual(["greet-en", "greet-es"]);
  });
});
