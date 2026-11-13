// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { SRC, readText } from "./helpers.js";

let T;
beforeAll(() => {
  window.eval(readText(join(SRC, "compose/trigger.js")));
  T = window.HDHTrigger;
});

/** Render html into body, put the caret at the "|" marker, return findToken's result. */
function tokenAt(html, { trigger = "/", minChars = 3, collapsed = true } = {}) {
  document.body.innerHTML = html.replace("|", '<span id="caret"></span>');
  const marker = document.getElementById("caret");
  const prev = marker.previousSibling;
  const sel = window.getSelection();
  const range = document.createRange();
  if (prev?.nodeType === 3) range.setStart(prev, prev.data.length);
  else range.setStartBefore(marker);
  marker.remove();
  if (prev?.nodeType === 3 && prev.nextSibling?.nodeType === 3) prev.parentNode.normalize();
  if (!collapsed) range.setStart(range.startContainer, 0);
  sel.removeAllRanges();
  sel.addRange(range);
  return T.findToken(sel, T.makeMatcher(trigger, minChars));
}

describe("findToken", () => {
  it("finds /query after a space", () => {
    const tok = tokenAt("Hi /info|");
    expect(tok).toMatchObject({ start: 3, end: 8, query: "info" });
  });

  it("finds /query at the start of the body", () => {
    expect(tokenAt("/greet|")?.query).toBe("greet");
  });

  it("accepts hyphens and accented letters in the query", () => {
    expect(tokenAt("x /info-españ|")?.query).toBe("info-españ");
  });

  it("accepts a non-breaking space before the trigger", () => {
    expect(tokenAt("Hi /info|")?.query).toBe("info");
  });

  it("works with the caret in the middle of the text", () => {
    expect(tokenAt("Hi /info| and more")?.query).toBe("info");
  });

  it.each([
    ["and/info|", "slash inside a word"],
    ["https://abc.com/test|", "URL"],
    ["Hi /in|", "fewer than minChars letters"],
    ["Hi /info more|", "caret not at the end of the token"],
    ["Hi / info|", "space after the trigger"],
    ["<b>word</b>/info|", "previous inline element ends with a letter"],
  ])("ignores %s (%s)", (html) => {
    expect(tokenAt(html)).toBeNull();
  });

  it("treats a <br> or block before the text as a line start", () => {
    expect(tokenAt("line<br>/info|")?.query).toBe("info");
    expect(tokenAt("<p>first</p><p>/info|</p>")?.query).toBe("info");
  });

  it("looks through inline parents for the preceding character", () => {
    expect(tokenAt("word <b>/info|</b>")?.query).toBe("info");
    expect(tokenAt("word<b>/info|</b>")).toBeNull();
  });

  it("ignores non-collapsed selections", () => {
    expect(tokenAt("Hi /info|", { collapsed: false })).toBeNull();
  });

  it("supports custom triggers with regex characters and min length", () => {
    expect(tokenAt("Hi ;;in|", { trigger: ";;", minChars: 2 })?.query).toBe("in");
    expect(tokenAt("Hi \\info|", { trigger: "\\" })?.query).toBe("info");
    expect(tokenAt("Hi /info|", { trigger: "\\" })).toBeNull();
    expect(tokenAt("Hi .x|", { trigger: ".", minChars: 1 })?.query).toBe("x");
  });
});
