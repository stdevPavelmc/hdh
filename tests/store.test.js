// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createStore, SCHEMA_VERSION } from "../src/lib/store.js";

function fakeArea(initial = {}) {
  let data = structuredClone(initial);
  return {
    dump: () => structuredClone(data),
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    async set(obj) {
      data = { ...data, ...structuredClone(obj) };
    },
  };
}

let area, store, n;
beforeEach(() => {
  area = fakeArea();
  n = 0;
  store = createStore({ area, now: () => "2026-11-13T00:00:00.000Z", uuid: () => `id-${++n}` });
});

const draft = (name, tags = [], html = "<b>Hi</b>") => ({ name, tags, html });

describe("store: snippets", () => {
  it("starts empty with default settings and stamps the schema version", async () => {
    expect(await store.listSnippets()).toEqual([]);
    expect(await store.getSettings()).toEqual({ trigger: "/", minChars: 3 });
    expect(area.dump().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("creates, updates and deletes", async () => {
    const created = await store.saveSnippet(draft("Greet-EN", "greet english"));
    expect(created.ok).toBe(true);
    expect(created.snippet).toMatchObject({ id: "id-1", name: "greet-en", tags: ["greet", "english"] });

    const updated = await store.saveSnippet({ id: "id-1", name: "greet-en", tags: ["greet"], html: "Hello" });
    expect(updated.snippet).toMatchObject({ id: "id-1", tags: ["greet"], html: "Hello", createdAt: created.snippet.createdAt });
    expect(await store.listSnippets()).toHaveLength(1);

    expect(await store.deleteSnippet("id-1")).toBe(true);
    expect(await store.deleteSnippet("id-1")).toBe(false);
    expect(await store.listSnippets()).toEqual([]);
  });

  it("sanitizes HTML before storing", async () => {
    const r = await store.saveSnippet(draft("x", [], '<p onclick="evil()">ok</p><script>bad()</script>'));
    expect(r.snippet.html).toBe("<p>ok</p>");
  });

  it("rejects invalid drafts without writing", async () => {
    const r = await store.saveSnippet(draft("info spanish"));
    expect(r).toMatchObject({ ok: false, errors: { name: "errKeySpaces" } });
    expect(area.dump().snippets).toBeUndefined();
  });

  it("rejects updates to a missing id", async () => {
    expect((await store.saveSnippet({ id: "nope", ...draft("x") })).errors.id).toBe("errSnippetNotFound");
  });

  it("serializes concurrent writes (no lost updates)", async () => {
    await Promise.all(["a", "b", "c", "d"].map((name) => store.saveSnippet(draft(name))));
    expect((await store.listSnippets()).map((s) => s.name).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("enforces unique names", async () => {
    await store.saveSnippet(draft("dup"));
    expect((await store.saveSnippet(draft("DUP"))).errors.name).toBe("errNameDuplicate");
  });
});

describe("store: settings", () => {
  it("saves valid settings and rejects invalid ones", async () => {
    expect((await store.saveSettings({ trigger: ";;", minChars: 2 })).ok).toBe(true);
    expect(await store.getSettings()).toEqual({ trigger: ";;", minChars: 2 });
    expect((await store.saveSettings({ trigger: "a", minChars: 2 })).ok).toBe(false);
    expect(await store.getSettings()).toEqual({ trigger: ";;", minChars: 2 });
  });
});

describe("store: export / import", () => {
  const file = (snippets) => ({ format: "helpdesk-helper-snippets", version: 1, snippets });

  it("exports without local ids", async () => {
    await store.saveSnippet(draft("greet", ["hello"]));
    const data = await store.exportData();
    expect(data).toMatchObject({ format: "helpdesk-helper-snippets", version: 1 });
    expect(data.snippets).toEqual([
      { name: "greet", tags: ["hello"], html: "<b>Hi</b>", createdAt: expect.any(String), updatedAt: expect.any(String) },
    ]);
    expect(data.snippets[0].id).toBeUndefined();
  });

  it("round-trips export → import(replace) into another station", async () => {
    await store.saveSnippet(draft("a", ["x"]));
    await store.saveSnippet(draft("b", ["y"]));
    const exported = JSON.parse(JSON.stringify(await store.exportData()));

    const other = createStore({ area: fakeArea(), uuid: () => crypto.randomUUID() });
    const r = await other.importData(exported, "replace");
    expect(r.summary).toEqual({ added: 2, updated: 0, skipped: [] });
    expect((await other.listSnippets()).map((s) => [s.name, s.tags])).toEqual([["a", ["x"]], ["b", ["y"]]]);
  });

  it("merge: same name is replaced (keeping the local id), new ones added", async () => {
    await store.saveSnippet(draft("keep", [], "local"));
    await store.saveSnippet(draft("shared", [], "old"));
    const r = await store.importData(file([
      { name: "Shared", tags: ["t"], html: "new" },
      { name: "fresh", tags: [], html: "f" },
    ]), "merge");
    expect(r.summary).toEqual({ added: 1, updated: 1, skipped: [] });
    const list = await store.listSnippets();
    expect(list.map((s) => [s.id, s.name, s.html])).toEqual([
      ["id-1", "keep", "local"], ["id-2", "shared", "new"], ["id-3", "fresh", "f"],
    ]);
  });

  it("replace: discards local snippets", async () => {
    await store.saveSnippet(draft("local"));
    await store.importData(file([{ name: "remote", html: "r" }]), "replace");
    expect((await store.listSnippets()).map((s) => s.name)).toEqual(["remote"]);
  });

  it("skips and reports invalid entries and in-file duplicates, imports the rest", async () => {
    const r = await store.importData(file([
      { name: "ok", html: "fine" },
      { name: "bad name", html: "x" },
      { name: "OK", html: "again" },
      { name: "empty", html: "<p></p>" },
      null,
    ]), "merge");
    expect(r.summary.added).toBe(1);
    expect(r.summary.skipped).toEqual([
      { index: 1, name: "bad name", errors: { name: "errKeySpaces" } },
      { index: 2, name: "ok", errors: { name: "errImportDuplicateInFile" } },
      { index: 3, name: "empty", errors: { html: "errBodyRequired" } },
      { index: 4, name: null, errors: expect.objectContaining({ name: "errKeyRequired" }) },
    ]);
  });

  it("sanitizes imported HTML (import files are untrusted)", async () => {
    await store.importData(file([{ name: "x", html: '<a href="javascript:alert(1)">click</a><img src=x onerror=alert(1)>' }]));
    expect((await store.listSnippets())[0].html).toBe("<a>click</a>");
  });

  it("rejects foreign files and leaves data untouched", async () => {
    await store.saveSnippet(draft("mine"));
    expect(await store.importData({ some: "json" }, "replace")).toEqual({ ok: false, error: "errImportFormat" });
    expect((await store.listSnippets()).map((s) => s.name)).toEqual(["mine"]);
  });

  it("rejects unknown modes", async () => {
    expect((await store.importData(file([]), "append")).error).toBe("errImportMode");
  });
});
