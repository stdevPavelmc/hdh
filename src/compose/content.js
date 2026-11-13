/* Help Desk Helper – compose editor script (classic script; trigger.js is loaded first).
 *
 * Typing "<trigger><query>" at the start of a word opens a list of matching snippets;
 * ↑/↓ choose, Enter/Tab/Space insert (replacing the trigger text), Esc closes.
 *
 * The popup lives inside the editor document, which is also the message body. Thunderbird
 * saves the whole document and has no "before save" event, so the popup is closed as early
 * as possible (see PLAN.md §5b): on any shortcut key, non-typing key, mouse leaving the
 * editor, blur, hidden window and after 15 s idle. The background also asks us to clean up
 * before sending and repairs any draft that still caught it.
 */
(() => {
  "use strict";
  if (window.__hdhLoaded) return;
  window.__hdhLoaded = true;

  const api = globalThis.messenger ?? globalThis.browser;
  const { makeMatcher, findToken } = globalThis.HDHTrigger;

  const HOST_ID = "hdh-popup";
  const IDLE_MS = 15_000;
  // Keys that don't move the caret or leave the word: the popup stays open.
  const KEEP_OPEN_KEYS = new Set([
    "Shift", "CapsLock", "Dead", "Backspace", "Process", "Compose", "AltGraph", "Unidentified",
  ]);

  let config = {
    trigger: "/",
    minChars: 3,
    isPlainText: false,
    strings: { noMatch: "No snippets match", hint: "" },
  };
  let matcher = makeMatcher(config.trigger, config.minChars);
  let popup = null; // { host, list, token, items, index }
  let seq = 0; // discards stale search responses
  let idleTimer = null;

  const send = (msg) => api.runtime.sendMessage(msg).catch(() => null);

  /* ------------------------------------------------------------ config */
  function bodyLooksPlain() {
    const body = document.body;
    return !!body && getComputedStyle(body).whiteSpace.startsWith("pre");
  }

  function applyConfig(c) {
    if (!c) return;
    config = { ...config, ...c, strings: { ...config.strings, ...(c.strings || {}) } };
    // The compose API has reported isPlainText=false for plain-text windows; trust either signal.
    config.isPlainText = Boolean(c.isPlainText) || bodyLooksPlain();
    matcher = makeMatcher(config.trigger, config.minChars);
  }

  /* ------------------------------------------------------------- popup */
  const STYLE = `
    :host { all: initial; }
    .box {
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #fff; color: #1b1b1f; border: 1px solid #c4c7ce; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,.22); width: 340px; max-width: calc(100vw - 16px);
      overflow: hidden;
    }
    .list { max-height: 260px; overflow-y: auto; padding: 4px 0; margin: 0; list-style: none; }
    .item { padding: 5px 10px; cursor: pointer; }
    .item.sel { background: #1f62cf; color: #fff; }
    .name { font-weight: 600; }
    .tags { font-size: 11px; opacity: .75; margin-left: 6px; }
    .preview { font-size: 12px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { padding: 6px 10px; font-style: italic; opacity: .75; }
    .hint { font-size: 11px; opacity: .65; padding: 4px 10px; border-top: 1px solid rgba(127,127,127,.25); }
    @media (prefers-color-scheme: dark) {
      .box { background: #2b2a33; color: #ececf1; border-color: #4a4a55; }
      .item.sel { background: #6ea2ff; color: #0b1220; }
    }`;

  function build() {
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-hdh", HOST_ID);
    host.setAttribute("contenteditable", "false");
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; left: 0; top: 0;";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const box = document.createElement("div");
    box.className = "box";
    const list = document.createElement("ul");
    list.className = "list";
    list.setAttribute("role", "listbox");
    box.append(list);
    if (config.strings.hint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = config.strings.hint;
      box.append(hint);
    }
    root.append(style, box);

    host.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the editor
    list.addEventListener("click", (e) => {
      const li = e.composedPath().find((n) => n.classList?.contains("item"));
      if (li && popup) {
        popup.index = Number(li.dataset.i);
        insertSelected();
      }
    });
    list.addEventListener("mousemove", (e) => {
      const li = e.composedPath().find((n) => n.classList?.contains("item"));
      if (li && popup && popup.index !== Number(li.dataset.i)) {
        popup.index = Number(li.dataset.i);
        render();
      }
    });
    // Outside <body>, so it is never part of the editable content.
    document.documentElement.appendChild(host);
    return { host, list };
  }

  function render() {
    const { list, items, index, token } = popup;
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = `${config.strings.noMatch} “${token.query}”`;
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...items.map((item, i) => {
      const li = document.createElement("li");
      li.className = "item" + (i === index ? " sel" : "");
      li.dataset.i = String(i);
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === index));
      const head = document.createElement("div");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.name;
      const tags = document.createElement("span");
      tags.className = "tags";
      tags.textContent = item.tags.map((t) => `#${t}`).join(" ");
      head.append(name, tags);
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = item.preview;
      li.append(head, preview);
      return li;
    }));
    list.children[index]?.scrollIntoView?.({ block: "nearest" });
  }

  function position(token) {
    const range = document.createRange();
    range.setStart(token.node, token.start);
    range.setEnd(token.node, token.end);
    const rect = range.getBoundingClientRect?.() ?? { left: 0, top: 0, bottom: 0 };
    const width = 340;
    const height = popup.host.getBoundingClientRect?.().height || 300;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 4;
    const top = below + height > window.innerHeight && rect.top - height - 4 > 0 ? rect.top - height - 4 : below;
    popup.host.style.left = `${left}px`;
    popup.host.style.top = `${top}px`;
  }

  function show(token, items) {
    if (!popup) popup = { ...build(), index: 0 };
    if (popup.token?.query !== token.query) popup.index = 0;
    popup.token = token;
    popup.items = items;
    popup.index = Math.min(popup.index, Math.max(0, items.length - 1));
    render();
    position(token);
  }

  function close() {
    seq++; // ignore searches still in flight
    clearTimeout(idleTimer);
    if (!popup) return;
    popup.host.remove();
    popup = null;
  }

  /** Remove any popup element left in the document (e.g. from a draft saved while it was open). */
  function sweep() {
    for (const el of document.querySelectorAll(`#${HOST_ID}, [data-hdh="${HOST_ID}"]`)) {
      if (!popup || el !== popup.host) el.remove();
    }
  }

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(close, IDLE_MS);
  }

  /* --------------------------------------------------------- insertion */
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function insertSelected() {
    const item = popup?.items[popup.index];
    const token = popup?.token;
    close();
    if (!item || !token?.node.isConnected) return;
    // The trigger text must still be where we found it.
    if (!token.node.data.slice(token.start, token.end).startsWith(config.trigger)) return;

    const range = document.createRange();
    range.setStart(token.node, token.start);
    range.setEnd(token.node, token.end);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // insertHTML in both modes (verified in the spike: one undo step, works in plain-text
    // windows too). Plain-text windows get our own text conversion as escaped lines.
    const html = config.isPlainText ? escapeHtml(item.text).replace(/\r?\n/g, "<br>") : item.html;
    document.execCommand("insertHTML", false, html);
  }

  /* ------------------------------------------------------------ search */
  async function update() {
    const token = findToken(window.getSelection(), matcher);
    if (!token) {
      close();
      return;
    }
    const mine = ++seq;
    const res = await send({ cmd: "hdh:search", query: token.query });
    if (mine !== seq) return; // superseded or closed meanwhile
    const fresh = findToken(window.getSelection(), matcher);
    if (!fresh || fresh.query !== token.query) return;
    show(fresh, res?.items ?? []);
  }

  /* ------------------------------------------------------------ events */
  function onKeyDown(e) {
    if (!popup) return;
    armIdle();
    // Shortcuts (Ctrl+S save, Ctrl+Enter send, Alt menus…) close the popup before
    // Thunderbird acts on them, so it can't end up in a draft or a sent message.
    if (e.ctrlKey || e.metaKey || e.altKey) {
      close();
      return;
    }
    const hasItems = popup.items.length > 0;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        if (!hasItems) {
          close();
          return;
        }
        popup.index = (popup.index + (e.key === "ArrowDown" ? 1 : -1) + popup.items.length) % popup.items.length;
        render();
        break;
      case "Enter":
      case "Tab":
      case " ":
        if (!hasItems) {
          close();
          return; // typed normally
        }
        insertSelected();
        break;
      case "Escape":
        close();
        break;
      default:
        // Printable characters re-filter via the input event; anything else
        // (←/→/Home/End/PageUp/F-keys…) moves away from the word: close.
        if (e.key.length > 1 && !KEEP_OPEN_KEYS.has(e.key)) close();
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("input", (e) => {
    if (e.isComposing) return;
    armIdle();
    update();
  }, true);
  document.addEventListener("compositionend", () => update(), true);
  window.addEventListener("blur", close);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) close();
  });
  // Heading for the toolbar (Save/Send buttons, menus): close before the click lands.
  document.documentElement.addEventListener("mouseleave", close);
  document.addEventListener("mousedown", (e) => {
    if (popup && !e.composedPath().includes(popup.host)) close();
  }, true);

  api.runtime.onMessage.addListener((msg) => {
    if (msg?.cmd === "hdh:cleanup") {
      close();
      sweep();
      return Promise.resolve(true);
    }
    if (msg?.cmd === "hdh:config") {
      applyConfig(msg.config);
      close();
    }
    return undefined;
  });

  sweep();
  send({ cmd: "hdh:init" }).then(applyConfig);
})();
