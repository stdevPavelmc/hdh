// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { ROOT, readJson } from "./helpers.js";
import { createStore } from "../src/lib/store.js";

function memoryArea() {
  let data = {};
  return {
    async get(keys) {
      return Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    async set(obj) {
      data = { ...data, ...structuredClone(obj) };
    },
  };
}

describe("examples/starter-snippets.json", () => {
  it("imports cleanly with nothing skipped and nothing altered by the sanitizer", async () => {
    const file = readJson(join(ROOT, "examples/starter-snippets.json"));
    const store = createStore({ area: memoryArea() });
    const result = await store.importData(file, "replace");
    expect(result.summary).toEqual({ added: file.snippets.length, updated: 0, skipped: [] });
    const stored = await store.listSnippets();
    expect(stored.map((s) => s.html)).toEqual(file.snippets.map((s) => s.html));
  });
});
