/**
 * Chip-style tag field. Space, comma, semicolon or Enter commit the typed tag;
 * Backspace on an empty field removes the last chip. Invalid text stays in the field
 * (so it can be corrected) and is reported through onError(i18nKey | null).
 */
import { keyError, parseTags, MAX_TAGS } from "../lib/validate.js";

const COMMIT_KEYS = new Set([" ", ",", ";", "Enter"]);

export class TagInput {
  constructor(root, {
    inputId = "",
    placeholder = "",
    removeLabel = (tag) => `Remove ${tag}`,
    onChange = () => {},
    onError = () => {},
  } = {}) {
    this.root = root;
    this.removeLabel = removeLabel;
    this.onChange = onChange;
    this.onError = onError;
    this._tags = [];

    root.classList.add("tag-input");
    this.chips = document.createElement("span");
    this.chips.className = "chips";
    this.input = document.createElement("input");
    Object.assign(this.input, { id: inputId, placeholder, autocomplete: "off", spellcheck: false });
    root.append(this.chips, this.input);

    root.addEventListener("click", (e) => {
      if (e.target === root || e.target === this.chips) this.input.focus();
    });
    this.input.addEventListener("keydown", (e) => this.#onKeyDown(e));
    this.input.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (/[\s,;]/.test(text)) {
        e.preventDefault();
        this.input.value += text;
        this.commit();
      }
    });
    this.input.addEventListener("blur", () => this.commit());
    this.input.addEventListener("input", () => {
      // Separators that arrive without a keydown (IME, on-screen keyboards, autofill).
      if (/[\s,;]/.test(this.input.value)) {
        this.commit();
        return;
      }
      this.onError(null);
      this.onChange();
    });
  }

  get tags() {
    return [...this._tags];
  }

  set tags(list) {
    this._tags = parseTags(list);
    this.input.value = "";
    this.#render();
  }

  /** Text typed but not yet turned into a chip. */
  get pending() {
    return this.input.value.trim();
  }

  focus() {
    this.input.focus();
  }

  /** Turn the typed text into chips. @returns {string|null} i18n error key for leftover invalid text. */
  commit() {
    const parts = parseTags(this.input.value.replace(/(^|[\s,;])#+/g, "$1")); // "#info" → "info"
    if (!parts.length) {
      this.input.value = "";
      return null;
    }
    const bad = [];
    let error = null;
    for (const tag of parts) {
      const err = keyError(tag);
      if (err) {
        bad.push(tag);
        error ??= err;
      } else if (!this._tags.includes(tag)) {
        if (this._tags.length >= MAX_TAGS) {
          bad.push(tag);
          error ??= "errTooManyTags";
        } else {
          this._tags.push(tag);
        }
      }
    }
    this.input.value = bad.join(" ");
    this.#render();
    this.onChange();
    this.onError(error);
    return error;
  }

  remove(tag) {
    this._tags = this._tags.filter((t) => t !== tag);
    this.#render();
    this.onChange();
  }

  #onKeyDown(e) {
    if (COMMIT_KEYS.has(e.key)) {
      e.preventDefault(); // never type separators; Enter must not submit the form
      if (this.input.value.trim()) this.commit();
    } else if (e.key === "Backspace" && !this.input.value && this._tags.length) {
      e.preventDefault();
      this.remove(this._tags[this._tags.length - 1]);
    }
  }

  #render() {
    this.chips.replaceChildren(...this._tags.map((tag) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = tag;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-remove";
      btn.textContent = "×";
      btn.setAttribute("aria-label", this.removeLabel(tag));
      btn.title = this.removeLabel(tag);
      btn.addEventListener("click", () => {
        this.remove(tag);
        this.input.focus();
      });
      chip.append(btn);
      return chip;
    }));
  }
}
