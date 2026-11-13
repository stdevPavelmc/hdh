// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TagInput } from "../src/manager/tag-input.js";

let root, ti, onError, onChange;
const key = (k) => {
  const e = new KeyboardEvent("keydown", { key: k, cancelable: true, bubbles: true });
  ti.input.dispatchEvent(e);
  return e;
};
const type = (text) => {
  ti.input.value += text;
  ti.input.dispatchEvent(new Event("input"));
};
const chips = () => [...root.querySelectorAll(".chip")].map((c) => c.firstChild.textContent);

beforeEach(() => {
  document.body.innerHTML = `<div id="t"></div>`;
  root = document.getElementById("t");
  onError = vi.fn();
  onChange = vi.fn();
  ti = new TagInput(root, { inputId: "tags-in", onError, onChange, removeLabel: (t) => `Remove ${t}` });
});

describe("TagInput", () => {
  it("commits on Space, comma, semicolon and Enter, normalizing case", () => {
    for (const [word, k] of [["Info", " "], ["product", ","], ["es", ";"], ["greet", "Enter"]]) {
      type(word);
      const e = key(k);
      expect(e.defaultPrevented).toBe(true);
    }
    expect(chips()).toEqual(["info", "product", "es", "greet"]);
    expect(ti.tags).toEqual(["info", "product", "es", "greet"]);
    expect(ti.input.value).toBe("");
  });

  it("commits when a separator arrives via an input event (IME / on-screen keyboard)", () => {
    type("alpha beta,");
    expect(chips()).toEqual(["alpha", "beta"]);
    type("bad_tag ");
    expect(ti.input.value).toBe("bad_tag");
    expect(onError).toHaveBeenLastCalledWith("errKeyUnderscore");
  });

  it("prevents Enter from submitting even when empty", () => {
    expect(key("Enter").defaultPrevented).toBe(true);
    expect(chips()).toEqual([]);
  });

  it("keeps invalid text in the field and reports the error", () => {
    type("info_spanish");
    key(" ");
    expect(chips()).toEqual([]);
    expect(ti.input.value).toBe("info_spanish");
    expect(onError).toHaveBeenLastCalledWith("errKeyUnderscore");
  });

  it("strips a leading # and ignores duplicates", () => {
    type("#info");
    key(" ");
    type("INFO");
    key(" ");
    expect(chips()).toEqual(["info"]);
  });

  it("allows hyphenated tags", () => {
    type("info-spanish");
    key(" ");
    expect(chips()).toEqual(["info-spanish"]);
  });

  it("Backspace on an empty field removes the last tag", () => {
    ti.tags = ["a", "b"];
    expect(key("Backspace").defaultPrevented).toBe(true);
    expect(chips()).toEqual(["a"]);
  });

  it("Backspace with text does not remove tags", () => {
    ti.tags = ["a"];
    type("x");
    expect(key("Backspace").defaultPrevented).toBe(false);
    expect(chips()).toEqual(["a"]);
  });

  it("commits pending text on blur", () => {
    type("pending");
    ti.input.dispatchEvent(new Event("blur"));
    expect(ti.tags).toEqual(["pending"]);
  });

  it("removes a tag with its × button (accessible label)", () => {
    ti.tags = ["a", "b"];
    const btn = root.querySelector('[aria-label="Remove a"]');
    btn.click();
    expect(ti.tags).toEqual(["b"]);
    expect(onChange).toHaveBeenCalled();
  });

  it("setter normalizes and clears pending text", () => {
    type("leftover");
    ti.tags = ["B", "b", " c "];
    expect(ti.tags).toEqual(["b", "c"]);
    expect(ti.pending).toBe("");
  });

  it("stops at 20 tags", () => {
    ti.tags = Array.from({ length: 20 }, (_, i) => `t${i}`);
    type("one-more");
    expect(ti.commit()).toBe("errTooManyTags");
    expect(ti.tags).toHaveLength(20);
  });
});
