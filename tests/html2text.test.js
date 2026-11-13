// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { htmlToText, visibleText } from "../src/lib/html2text.js";

describe("htmlToText", () => {
  it("converts <br> to line breaks and drops formatting", () => {
    expect(htmlToText("Hola,<br><br>Gracias por contactar con <b>soporte</b>."))
      .toBe("Hola,\n\nGracias por contactar con soporte.");
  });

  it("separates paragraphs with a blank line", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
  });

  it("renders unordered and ordered lists", () => {
    expect(htmlToText("<p>Items:</p><ul><li>A</li><li>B</li></ul>")).toBe("Items:\n\n- A\n- B");
    expect(htmlToText("<ol><li>A</li><li>B</li></ol>")).toBe("1. A\n2. B");
  });

  it("keeps <li><p>…</p></li> on the bullet line", () => {
    expect(htmlToText("<ul><li><p>A</p></li><li><p>B</p></li></ul>")).toBe("- A\n- B");
  });

  it("puts a blank line between a list and a following paragraph", () => {
    expect(htmlToText("<ul><li>A</li></ul><p>After</p>")).toBe("- A\n\nAfter");
  });

  it("indents nested lists", () => {
    expect(htmlToText("<ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul>")).toBe("- A\n  - A1\n- B");
  });

  it("appends link targets unless the text already is the target", () => {
    expect(htmlToText('More at <a href="https://example.com">our site</a>.'))
      .toBe("More at our site <https://example.com>.");
    expect(htmlToText('<a href="https://example.com">https://example.com</a>')).toBe("https://example.com");
    expect(htmlToText('<a href="mailto:a@b.com">a@b.com</a>')).toBe("a@b.com");
  });

  it("quotes blockquotes", () => {
    expect(htmlToText("<blockquote>Line 1<br>Line 2</blockquote>After")).toBe("> Line 1\n> Line 2\nAfter");
  });

  it("collapses source whitespace but keeps <pre>", () => {
    expect(htmlToText("<p>  a \n   b  </p>")).toBe("a b");
    expect(htmlToText("<pre>a\n  b</pre>")).toBe("a\n  b");
  });

  it("matches the spike's info-product snippet", () => {
    const html = '<p>Here is the product information:</p><ul><li>Item <i>one</i></li><li>Item two</li></ul><p>More at <a href="https://example.com">example.com</a>.</p>';
    expect(htmlToText(html)).toBe(
      "Here is the product information:\n\n- Item one\n- Item two\n\nMore at example.com <https://example.com>.",
    );
  });
});

describe("visibleText", () => {
  it("returns only text", () => expect(visibleText("<p><b>a</b> b</p>")).toBe("a b"));
  it("is empty for markup-only bodies", () => expect(visibleText("<p><br></p>").trim()).toBe(""));
});
