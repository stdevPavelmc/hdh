import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SRC, readJson } from "./helpers.js";

const manifest = readJson(join(SRC, "manifest.json"));
const en = readJson(join(SRC, "_locales/en/messages.json"));

describe("manifest.json", () => {
  it("is Manifest V3 with a fixed add-on id", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.browser_specific_settings.gecko.id).toBe("helpdesk-helper@chagod.local");
  });

  it("supports TB 128+ (incl. 140 ESR) with no upper version cap", () => {
    const gecko = manifest.browser_specific_settings.gecko;
    expect(gecko.strict_min_version).toBe("128.0");
    expect(gecko.strict_max_version).toBeUndefined();
  });

  it("does not use the compose_scripts key (TB 151+ only; would break 140 ESR)", () => {
    expect(manifest.compose_scripts).toBeUndefined();
  });

  it("does not use Experiment APIs (they break across TB versions)", () => {
    expect(manifest.experiment_apis).toBeUndefined();
  });

  it("references only files that exist", () => {
    const files = [
      ...manifest.background.scripts,
      ...Object.values(manifest.icons),
      manifest.action.default_icon,
      manifest.options_ui.page,
    ];
    for (const f of files) expect(existsSync(join(SRC, f)), f).toBe(true);
  });

  it("has every __MSG_*__ key defined in the default locale", () => {
    const keys = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(en[k]?.message, k).toBeTruthy();
  });

  it("defaults to English", () => {
    expect(manifest.default_locale).toBe("en");
  });
});

describe("compose scripts", () => {
  it("every script registered by the background exists, trigger.js before content.js", async () => {
    const { readText } = await import("./helpers.js");
    const src = readText(join(SRC, "background/background.js"));
    const list = JSON.parse(src.match(/COMPOSE_SCRIPTS = (\[[^\]]*\])/)[1]);
    expect(list).toEqual(["compose/trigger.js", "compose/content.js"]);
    for (const f of list) expect(existsSync(join(SRC, f)), f).toBe(true);
  });
});
