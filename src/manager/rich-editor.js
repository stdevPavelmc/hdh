/**
 * Minimal rich-text editor on a contenteditable element with a toolbar of
 * <button data-cmd="bold|italic|underline|insertUnorderedList|insertOrderedList|createLink|unlink|removeFormat">.
 * Output is always run through the sanitizer, and pasted content is sanitized on the way in.
 */
import { sanitizeHtml } from "../lib/sanitize.js";

/** Replace an element's content with (already sanitized) HTML without assigning innerHTML. */
export function setHtml(el, html) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  el.replaceChildren(...doc.body.childNodes);
}

export class RichEditor {
  /**
   * @param {HTMLElement} el        contenteditable element
   * @param {HTMLElement} toolbar   container of [data-cmd] buttons
   * @param {{onInput?: () => void, askLink?: (selectedText: string) => Promise<string|null>}} opts
   */
  constructor(el, toolbar, { onInput = () => {}, askLink = async () => null } = {}) {
    this.el = el;
    this.onInput = onInput;
    this.askLink = askLink;

    el.addEventListener("focus", () => {
      // Produce <b>/<i>/<u> instead of style="" spans (styles are stripped by the sanitizer),
      // and plain line-like <div>s on Enter.
      document.execCommand("styleWithCSS", false, false);
      document.execCommand("defaultParagraphSeparator", false, "div");
    });
    el.addEventListener("input", () => onInput());
    el.addEventListener("paste", (e) => this.#onPaste(e));
    el.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) e.preventDefault(); // no dropped files/images
    });

    toolbar.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-cmd]")) e.preventDefault(); // keep the selection in the editor
    });
    toolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cmd]");
      if (btn) this.exec(btn.dataset.cmd);
    });
  }

  get html() {
    return sanitizeHtml(this.el.innerHTML);
  }

  set html(value) {
    setHtml(this.el, sanitizeHtml(value));
  }

  focus() {
    this.el.focus();
  }

  async exec(cmd) {
    this.el.focus();
    if (cmd === "createLink") {
      await this.#insertLink();
    } else {
      document.execCommand(cmd, false, null);
    }
    this.onInput();
  }

  async #insertLink() {
    const sel = window.getSelection();
    const range = sel.rangeCount && this.el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const url = await this.askLink(range ? range.toString() : "");
    if (!url) return;
    this.el.focus();
    if (range) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (range && !range.collapsed) {
      document.execCommand("createLink", false, url);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = url.replace(/^(mailto|tel):/i, "");
      document.execCommand("insertHTML", false, a.outerHTML);
    }
  }

  #onPaste(e) {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const html = data.getData("text/html");
    if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
    else document.execCommand("insertText", false, data.getData("text/plain"));
    this.onInput();
  }
}
