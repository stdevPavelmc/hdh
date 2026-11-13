// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildPopupItems, MAX_RESULTS } from "../src/lib/popup-items.js";

const snip = (name, tags, html) => ({ id: name, name, tags, html, createdAt: "", updatedAt: "" });

describe("buildPopupItems", () => {
  const list = [
    snip("greet-en", ["greet"], "Hello,<br><br>Thanks for contacting <b>support</b>."),
    snip("info", ["info"], '<p>See <a href="https://example.com">our site</a></p><ul><li>a</li></ul>'),
  ];

  it("returns ranked items with html, plain text and a one-line preview", () => {
    const [item] = buildPopupItems(list, "gre");
    expect(item).toEqual({
      id: "greet-en",
      name: "greet-en",
      tags: ["greet"],
      html: "Hello,<br><br>Thanks for contacting <b>support</b>.",
      text: "Hello,\n\nThanks for contacting support.",
      preview: "Hello, Thanks for contacting support.",
    });
  });

  it("converts links and lists for plain-text windows", () => {
    expect(buildPopupItems(list, "info")[0].text).toBe("See our site <https://example.com>\n\n- a");
  });

  it("limits the number of results", () => {
    const many = Array.from({ length: 20 }, (_, i) => snip(`n${String(i).padStart(2, "0")}`, ["same"], "x"));
    expect(buildPopupItems(many, "same")).toHaveLength(MAX_RESULTS);
  });

  it("returns nothing for an empty query", () => {
    expect(buildPopupItems(list, "  ")).toEqual([]);
  });
});
