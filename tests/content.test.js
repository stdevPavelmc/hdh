// @vitest-environment jsdom
// Runs the real compose scripts (trigger.js + content.js) inside a fresh iframe per test,
// with a fake `messenger` and a recording document.execCommand.
import { describe, it, expect, vi, afterEach } from "vitest";
import { join } from "node:path";
import { SRC, readText } from "./helpers.js";

const TRIGGER_SRC = readText(join(SRC, "compose/trigger.js"));
const CONTENT_SRC = readText(join(SRC, "compose/content.js"));

const ITEMS = [
  { id: "1", name: "greet-en", tags: ["greet"], html: "Hello,<br><b>Support</b>", text: "Hello,\nSupport", preview: "Hello, Support" },
  { id: "2", name: "greet-es", tags: ["greet"], html: "Hola,<br><b>Soporte</b>", text: "Hola,\nSoporte & <co>", preview: "Hola, Soporte" },
];

const flush = () => new Promise((r) => setTimeout(r, 0));
let frame;

async function setup({ config = {}, items = ITEMS, bodyHtml = "" } = {}) {
  frame = document.createElement("iframe");
  document.body.append(frame);
  const win = frame.contentWindow;
  const doc = win.document;
  doc.body.innerHTML = bodyHtml;
  doc.body.contentEditable = "true";

  const listeners = [];
  const runtime = {
    sendMessage: vi.fn(async (msg) => {
      if (msg.cmd === "hdh:init") {
        return { trigger: "/", minChars: 3, isPlainText: false, strings: { noMatch: "No match", hint: "hint" }, ...config };
      }
      if (msg.cmd === "hdh:search") return { items: items.filter((i) => i.tags.some((t) => t.startsWith(msg.query))) };
      return null;
    }),
    onMessage: { addListener: (fn) => listeners.push(fn) },
  };
  win.messenger = { runtime };

  const inserted = [];
  doc.execCommand = vi.fn((cmd, _ui, value) => {
    const range = win.getSelection().getRangeAt(0);
    inserted.push({ cmd, value, replaced: range.toString() });
    range.deleteContents();
    range.insertNode(doc.createTextNode(`[${value}]`));
    return true;
  });

  win.eval(TRIGGER_SRC);
  win.eval(CONTENT_SRC);
  await flush();

  /** Simulate typing: set the text of the body and put the caret at the end. */
  async function type(text) {
    doc.body.textContent = text;
    const node = doc.body.firstChild;
    const range = doc.createRange();
    range.setStart(node, text.length);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    doc.body.dispatchEvent(new win.InputEvent("input", { bubbles: true }));
    await flush();
  }

  function key(k, opts = {}) {
    const e = new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts });
    doc.body.dispatchEvent(e);
    return e;
  }

  const host = () => doc.getElementById("hdh-popup");
  const shownItems = () => [...(host()?.shadowRoot.querySelectorAll(".item") ?? [])].map((li) => li.querySelector(".name").textContent);
  const selected = () => host()?.shadowRoot.querySelector(".item.sel .name")?.textContent;
  const message = (msg) => Promise.all(listeners.map((fn) => fn(msg)));

  return { win, doc, runtime, inserted, type, key, host, shownItems, selected, message };
}

afterEach(() => frame?.remove());

describe("compose script", () => {
  it("opens the list for /gre at a word start and asks for the query", async () => {
    const c = await setup();
    await c.type("Hi /gre");
    expect(c.runtime.sendMessage).toHaveBeenCalledWith({ cmd: "hdh:search", query: "gre" });
    expect(c.shownItems()).toEqual(["greet-en", "greet-es"]);
    expect(c.selected()).toBe("greet-en");
    // The popup is outside <body>, so it is never part of the editable content.
    expect(c.host().parentNode).toBe(c.doc.documentElement);
  });

  it.each(["and/gre", "Hi /gr", "Hi / gre"])("does not open for %j", async (text) => {
    const c = await setup();
    await c.type(text);
    expect(c.host()).toBeNull();
  });

  it("Enter inserts the highlighted snippet in place of the trigger text", async () => {
    const c = await setup();
    await c.type("Hi /gre");
    expect(c.key("Enter").defaultPrevented).toBe(true);
    expect(c.inserted).toEqual([{ cmd: "insertHTML", value: ITEMS[0].html, replaced: "/gre" }]);
    expect(c.doc.body.textContent).toBe(`Hi [${ITEMS[0].html}]`);
    expect(c.host()).toBeNull();
  });

  it("↓ then Tab inserts the second snippet; ↑ wraps around", async () => {
    const c = await setup();
    await c.type("/gre");
    c.key("ArrowDown");
    expect(c.selected()).toBe("greet-es");
    c.key("ArrowDown");
    expect(c.selected()).toBe("greet-en");
    c.key("ArrowUp");
    expect(c.selected()).toBe("greet-es");
    c.key("Tab");
    expect(c.inserted[0].value).toBe(ITEMS[1].html);
  });

  it("Space inserts when there are matches", async () => {
    const c = await setup();
    await c.type("/gre");
    expect(c.key(" ").defaultPrevented).toBe(true);
    expect(c.inserted).toHaveLength(1);
  });

  it("with no matches shows a hint and lets Space through", async () => {
    const c = await setup();
    await c.type("/xyz");
    expect(c.host().shadowRoot.querySelector(".empty").textContent).toBe("No match “xyz”");
    expect(c.key(" ").defaultPrevented).toBe(false);
    expect(c.host()).toBeNull();
    expect(c.inserted).toEqual([]);
  });

  it("Esc closes without inserting", async () => {
    const c = await setup();
    await c.type("/gre");
    expect(c.key("Escape").defaultPrevented).toBe(true);
    expect(c.host()).toBeNull();
    expect(c.inserted).toEqual([]);
  });

  it.each([
    ["Control", { ctrlKey: true }],
    ["s", { ctrlKey: true }],
    ["Enter", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["s", { metaKey: true }],
  ])("closes on shortcut %s %j and doesn't block it", async (k, mods) => {
    const c = await setup();
    await c.type("/gre");
    expect(c.key(k, mods).defaultPrevented).toBe(false);
    expect(c.host()).toBeNull();
    expect(c.inserted).toEqual([]);
  });

  it.each(["ArrowLeft", "Home", "F10", "PageDown"])("closes on non-typing key %s", async (k) => {
    const c = await setup();
    await c.type("/gre");
    c.key(k);
    expect(c.host()).toBeNull();
  });

  it.each(["Shift", "Dead", "Backspace"])("stays open on %s", async (k) => {
    const c = await setup();
    await c.type("/gre");
    c.key(k);
    expect(c.host()).not.toBeNull();
  });

  it("closes when the mouse leaves the editor and on blur", async () => {
    const c = await setup();
    await c.type("/gre");
    c.doc.documentElement.dispatchEvent(new c.win.MouseEvent("mouseleave"));
    expect(c.host()).toBeNull();
    await c.type("/gre");
    c.win.dispatchEvent(new c.win.Event("blur"));
    expect(c.host()).toBeNull();
  });

  it("closes when the token is no longer at the caret", async () => {
    const c = await setup();
    await c.type("/gre");
    await c.type("/gre done");
    expect(c.host()).toBeNull();
  });

  it("closes by itself after 15 s without typing", async () => {
    const c = await setup();
    await c.type("/gre");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      c.key("Shift"); // re-arms the idle timer under fake timers
      vi.advanceTimersByTime(14_000);
      expect(c.host()).not.toBeNull();
      vi.advanceTimersByTime(1_500);
      expect(c.host()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("plain-text windows get escaped text with <br> line breaks", async () => {
    const c = await setup({ config: { isPlainText: true } });
    await c.type("/gre");
    c.key("ArrowDown");
    c.key("Enter");
    expect(c.inserted[0].value).toBe("Hola,<br>Soporte &amp; &lt;co&gt;");
  });

  it("uses the configured trigger and minimum length", async () => {
    const c = await setup({ config: { trigger: ";;", minChars: 2 } });
    await c.type("/gre");
    expect(c.host()).toBeNull();
    await c.type("x ;;gr");
    expect(c.shownItems()).toEqual(["greet-en", "greet-es"]);
  });

  it("applies new settings pushed by the background", async () => {
    const c = await setup();
    await c.message({ cmd: "hdh:config", config: { trigger: "#", minChars: 1 } });
    await c.type("#g");
    expect(c.shownItems()).toHaveLength(2);
  });

  it("removes leftover popup elements on load and on cleanup requests", async () => {
    const c = await setup({ bodyHtml: '<div id="hdh-popup" data-hdh="hdh-popup"></div>text' });
    expect(c.doc.querySelectorAll("[data-hdh]")).toHaveLength(0);
    await c.type("/gre");
    expect(c.host()).not.toBeNull();
    await c.message({ cmd: "hdh:cleanup" });
    expect(c.doc.querySelectorAll("[data-hdh]")).toHaveLength(0);
  });

  it("clicking an item inserts it", async () => {
    const c = await setup();
    await c.type("/gre");
    c.host().shadowRoot.querySelectorAll(".item")[1].click();
    expect(c.inserted[0].value).toBe(ITEMS[1].html);
  });
});
