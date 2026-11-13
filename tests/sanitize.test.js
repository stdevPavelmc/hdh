// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../src/lib/sanitize.js";

describe("sanitizeHtml", () => {
  it("keeps allowed formatting", () => {
    const html = '<p>Hi <b>there</b> <i>x</i> <u>y</u></p><ul><li>one</li></ul><a href="https://example.com">link</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes scripts, event handlers and styles", () => {
    expect(sanitizeHtml('<p onclick="x()">a</p><script>alert(1)</script><style>p{}</style>')).toBe("<p>a</p>");
    expect(sanitizeHtml('<b style="color:red">a</b>')).toBe("<b>a</b>");
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "/relative", "vbscript:x"])(
    "drops unsafe href %s",
    (href) => expect(sanitizeHtml(`<a href="${href}">x</a>`)).toBe("<a>x</a>"),
  );

  it.each(["https://a.com", "http://a.com", "mailto:a@b.com", "tel:+34600000000"])(
    "keeps safe href %s",
    (href) => expect(sanitizeHtml(`<a href="${href}">x</a>`)).toBe(`<a href="${href}">x</a>`),
  );

  it("unwraps unknown elements but keeps their text", () => {
    expect(sanitizeHtml('<font color="red">red</font>')).toBe("red");
  });

  it("removes images, iframes and forms (no remote content / tracking)", () => {
    expect(sanitizeHtml('<img src="https://t.co/p.gif"><iframe src="x"></iframe><form><input></form>ok')).toBe("ok");
  });

  it("handles empty input", () => {
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
