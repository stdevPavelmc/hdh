/**
 * Persistent snippet storage on top of storage.local.
 *   { schemaVersion: 1, settings: {trigger, minChars}, snippets: [{id,name,tags,html,createdAt,updatedAt}] }
 * All writes are serialized so concurrent saves can't lose updates.
 */
import {
  DEFAULT_SETTINGS, EXPORT_FORMAT, EXPORT_VERSION,
  validateSnippet, validateSettings, validateImportEnvelope, normalizeKey,
} from "./validate.js";
import { sanitizeHtml } from "./sanitize.js";
import { visibleText } from "./html2text.js";

export const SCHEMA_VERSION = 1;
const deps = { sanitize: sanitizeHtml, htmlText: visibleText };

export function createStore({
  area = globalThis.messenger?.storage.local,
  now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID(),
} = {}) {
  let queue = Promise.resolve();
  /** Run fn after all previously queued writes; a failure doesn't block later writes. */
  function serial(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  }

  async function load() {
    const data = await area.get(["schemaVersion", "snippets", "settings"]);
    if (data.schemaVersion === undefined) {
      // First run (or pre-versioned data): stamp the current schema.
      await area.set({ schemaVersion: SCHEMA_VERSION });
    }
    return {
      snippets: Array.isArray(data.snippets) ? data.snippets : [],
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    };
  }

  return {
    async listSnippets() {
      return (await load()).snippets;
    },

    async getSettings() {
      return (await load()).settings;
    },

    saveSettings(input) {
      return serial(async () => {
        const result = validateSettings(input);
        if (result.ok) await area.set({ settings: result.value });
        return result;
      });
    },

    /** Create (no id) or update (existing id). @returns {{ok, errors, snippet?}} */
    saveSnippet(draft) {
      return serial(async () => {
        const { snippets } = await load();
        const current = draft?.id ? snippets.find((s) => s.id === draft.id) : undefined;
        if (draft?.id && !current) return { ok: false, errors: { id: "errSnippetNotFound" } };
        const result = validateSnippet(draft, snippets, deps);
        if (!result.ok) return result;
        const stamp = now();
        const snippet = current
          ? { ...current, ...result.value, id: current.id, updatedAt: stamp }
          : { ...result.value, id: uuid(), createdAt: stamp, updatedAt: stamp };
        const next = current
          ? snippets.map((s) => (s.id === current.id ? snippet : s))
          : [...snippets, snippet];
        await area.set({ snippets: next });
        return { ok: true, errors: {}, snippet };
      });
    },

    deleteSnippet(id) {
      return serial(async () => {
        const { snippets } = await load();
        const next = snippets.filter((s) => s.id !== id);
        if (next.length === snippets.length) return false;
        await area.set({ snippets: next });
        return true;
      });
    },

    /** Portable export: no local ids (stations match snippets by name). */
    async exportData() {
      const { snippets } = await load();
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: now(),
        snippets: snippets.map(({ name, tags, html, createdAt, updatedAt }) => ({
          name, tags, html, createdAt, updatedAt,
        })),
      };
    },

    /**
     * mode "merge": same name → imported one replaces local; others added.
     * mode "replace": local snippets are discarded (caller exports a backup first).
     * Invalid entries are skipped and reported; valid ones are still imported.
     * @returns {{ok:boolean, error?:string, summary?:{added:number, updated:number, skipped:Array}}}
     */
    importData(data, mode = "merge") {
      return serial(async () => {
        if (mode !== "merge" && mode !== "replace") return { ok: false, error: "errImportMode" };
        const envelope = validateImportEnvelope(data);
        if (!envelope.ok) return envelope;

        const { snippets } = await load();
        let collection = mode === "replace" ? [] : [...snippets];
        const seen = new Set();
        const summary = { added: 0, updated: 0, skipped: [] };
        const stamp = now();

        envelope.snippets.forEach((item, index) => {
          const name = normalizeKey(item?.name);
          if (name && seen.has(name)) {
            summary.skipped.push({ index, name, errors: { name: "errImportDuplicateInFile" } });
            return;
          }
          const existing = collection.find((s) => s.name === name);
          const result = validateSnippet(
            { id: existing?.id, name: item?.name, tags: item?.tags ?? [], html: item?.html },
            collection,
            deps,
          );
          if (!result.ok) {
            summary.skipped.push({ index, name: name || null, errors: result.errors });
            return;
          }
          seen.add(name);
          if (existing) {
            const updated = { ...existing, ...result.value, id: existing.id, updatedAt: stamp };
            collection = collection.map((s) => (s.id === existing.id ? updated : s));
            summary.updated++;
          } else {
            collection.push({ ...result.value, id: uuid(), createdAt: stamp, updatedAt: stamp });
            summary.added++;
          }
        });

        await area.set({ snippets: collection });
        return { ok: true, summary };
      });
    },
  };
}
