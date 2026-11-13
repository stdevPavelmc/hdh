/**
 * Convert (sanitized) snippet HTML to plain text for plain-text compose windows.
 *   <br>             → line break
 *   <p>, <h1-3>      → paragraph (blank line before and after)
 *   <ul>/<ol><li>    → "- item" / "1. item", nested lists indented
 *   <a href=x>t</a>  → "t <x>" (just "t" when the text already is the address)
 *   <blockquote>     → lines prefixed with "> "
 * Needs a DOM (DOMParser).
 */

const PARAGRAPH = new Set(["P", "H1", "H2", "H3"]);
const BLOCK = new Set(["DIV", "PRE", "UL", "OL"]);

class Buffer {
  constructor() { this.text = ""; }
  get atLineStart() { return this.text === "" || this.text.endsWith("\n"); }
  push(s) { this.text += s; }
  newline() { if (!this.atLineStart) this.text += "\n"; }
  blankLine() { this.newline(); if (this.text && !this.text.endsWith("\n\n")) this.text += "\n"; }
}

function linkSuffix(a) {
  const href = (a.getAttribute("href") || "").trim();
  if (!href) return "";
  const text = a.textContent.trim();
  const bare = href.replace(/^mailto:|^tel:/i, "");
  if (text === href || text === bare || `${text}/` === href) return "";
  return ` <${href}>`;
}

function walk(node, buf, ctx) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3 /* TEXT */) {
      let t = ctx.pre ? child.data : child.data.replace(/\s+/g, " ");
      if (!ctx.pre && buf.atLineStart) t = t.trimStart();
      buf.push(t);
      continue;
    }
    if (child.nodeType !== 1 /* ELEMENT */) continue;
    const tag = child.nodeName;
    if (tag === "BR") {
      buf.push("\n");
    } else if (tag === "HR") {
      buf.newline();
      buf.push("----\n");
    } else if (tag === "A") {
      walk(child, buf, ctx);
      buf.push(linkSuffix(child));
    } else if (tag === "LI") {
      buf.newline();
      const list = child.parentNode;
      const marker = list?.nodeName === "OL"
        ? `${[...list.children].filter((c) => c.nodeName === "LI").indexOf(child) + 1}. `
        : "- ";
      buf.push("  ".repeat(Math.max(0, ctx.depth - 1)) + marker);
      walk(child, buf, { ...ctx, inItem: true });
      buf.newline();
    } else if (tag === "UL" || tag === "OL") {
      buf.newline();
      walk(child, buf, { ...ctx, depth: ctx.depth + 1, inItem: false });
      buf.newline();
    } else if (tag === "BLOCKQUOTE") {
      buf.newline();
      const inner = new Buffer();
      walk(child, inner, ctx);
      const quoted = tidy(inner.text).split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
      buf.push(quoted + "\n");
    } else if (PARAGRAPH.has(tag) && ctx.inItem) {
      walk(child, buf, ctx); // <li><p>x</p></li> → "- x"
    } else if (PARAGRAPH.has(tag)) {
      buf.blankLine(); // separated from whatever came before…
      walk(child, buf, ctx);
      buf.blankLine(); // …and from what follows
    } else if (BLOCK.has(tag)) {
      buf.newline();
      walk(child, buf, { ...ctx, pre: ctx.pre || tag === "PRE" });
      buf.newline();
    } else {
      walk(child, buf, ctx);
    }
  }
}

function tidy(text) {
  return text
    .replace(/[ \t]+\n/g, "\n") // trailing spaces
    .replace(/\n{3,}/g, "\n\n") // at most one blank line
    .replace(/^\n+|\n+$/g, ""); // no leading/trailing blank lines
}

function parse(html) {
  return new DOMParser().parseFromString(`<!doctype html><body>${html ?? ""}</body>`, "text/html").body;
}

export function htmlToText(html) {
  const buf = new Buffer();
  walk(parse(html), buf, { depth: 0, pre: false });
  return tidy(buf.text);
}

/** Visible text only (used to reject snippets whose body is empty after sanitizing). */
export function visibleText(html) {
  return parse(html).textContent ?? "";
}
