/**
 * Promise-based modal built on a single <dialog id="dlg">.
 *   const r = await ask({ title, message, details, fields, buttons, validate });
 *   r.button → id of the pressed button, or null for Esc / close
 *   r.values → { fieldId: value }
 * validate(values, button) may be async and returns null (ok) or { fieldId: i18nKey }.
 */
import { t } from "../lib/i18n.js";

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

export function ask({ title, message = [], details = [], fields = [], buttons, validate = null, cancelId = "cancel" }) {
  const dlg = document.getElementById("dlg");
  return new Promise((resolve) => {
    const form = el("form", { noValidate: true });
    form.append(el("h2", { textContent: title }));
    for (const p of [].concat(message)) form.append(el("p", { textContent: p }));
    if (details.length) form.append(el("ul", { className: "details" }, ...details.map((d) => el("li", { textContent: d }))));

    const inputs = {};
    const errors = {};
    for (const f of fields) {
      const id = `dlg-f-${f.id}`;
      let input;
      if (f.type === "select") {
        input = el("select", { id }, ...f.options.map((o) => el("option", { value: String(o.value), textContent: o.label })));
        input.value = String(f.value);
      } else {
        input = el("input", { id, value: f.value ?? "", autocomplete: "off", spellcheck: false });
        if (f.maxLength) input.maxLength = f.maxLength;
        if (f.placeholder) input.placeholder = f.placeholder;
      }
      inputs[f.id] = input;
      errors[f.id] = el("p", { className: "error", role: "alert" });
      form.append(el("div", { className: "field" },
        el("label", { htmlFor: id, textContent: f.label }),
        input,
        f.hint ? el("p", { className: "hint", textContent: f.hint }) : null,
        errors[f.id]));
    }

    const row = el("div", { className: "actions" });
    for (const b of buttons) {
      row.append(el("button", { type: "submit", value: b.id, className: b.kind || "", textContent: b.label }));
    }
    form.append(row);

    const values = () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
    let done = false;
    const finish = (button) => {
      if (done) return;
      done = true;
      dlg.close();
      resolve({ button, values: values() });
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.submitter?.value ?? buttons[0].id;
      if (validate && button !== cancelId) {
        const errs = await validate(values(), button);
        for (const [k, p] of Object.entries(errors)) p.textContent = errs?.[k] ? t(errs[k]) : "";
        if (errs && Object.keys(errs).length) {
          inputs[Object.keys(errs)[0]]?.focus();
          return;
        }
      }
      finish(button === cancelId ? null : button);
    });
    dlg.oncancel = (e) => { // Esc
      e.preventDefault();
      finish(null);
    };

    dlg.replaceChildren(form);
    dlg.showModal();
    (Object.values(inputs)[0] ?? row.querySelector(".primary") ?? row.firstChild)?.focus();
  });
}
