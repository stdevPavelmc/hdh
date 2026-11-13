/* Help Desk Helper – snippet manager (opened as a Thunderbird tab / options page). */
import { applyI18n, uiLanguage, t } from "../lib/i18n.js";
import { createStore } from "../lib/store.js";
import { searchSnippets } from "../lib/search.js";
import { keyError, normalizeKey, validateImportEnvelope } from "../lib/validate.js";
import { htmlToText } from "../lib/html2text.js";
import { SAFE_URL_RE } from "../lib/sanitize.js";
import { TagInput } from "./tag-input.js";
import { RichEditor } from "./rich-editor.js";
import { ask } from "./dialogs.js";

const $ = (id) => document.getElementById(id);
const store = createStore();
const lang = uiLanguage();

const state = {
  snippets: [],
  settings: { trigger: "/", minChars: 3 },
  editing: false,
  currentId: null, // id of the snippet in the form; null = new snippet
  baseline: "", // snapshot of the form when it was loaded/saved (dirty check)
  submitted: false, // show "required" errors only after the first save attempt
};

let tags;
let editor;

/* ------------------------------------------------------------------ status */
let statusTimer;
function setStatus(text, isError = false) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("error", isError);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (el.textContent = ""), 6000);
}

/* -------------------------------------------------------------------- list */
function renderList() {
  const query = $("search").value;
  const results = searchSnippets(state.snippets, query, { locale: lang });
  const total = state.snippets.length;

  $("count").textContent = query.trim()
    ? t("listCountFiltered", results.length, total)
    : t("listCount", total);
  $("count").hidden = total === 0;

  const empty = $("list-empty");
  empty.hidden = results.length > 0;
  empty.textContent = total === 0 ? t("listEmpty") : t("listNoResults");

  $("list").replaceChildren(...results.map((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "snippet-item";
    btn.dataset.id = s.id;
    btn.setAttribute("aria-current", String(state.editing && s.id === state.currentId));

    const name = document.createElement("span");
    name.className = "snippet-name";
    name.textContent = s.name;
    const tagRow = document.createElement("span");
    tagRow.className = "snippet-tags";
    tagRow.append(...s.tags.map((tag) => Object.assign(document.createElement("span"), { textContent: tag })));
    const preview = document.createElement("span");
    preview.className = "snippet-preview";
    preview.textContent = htmlToText(s.html).replace(/\s+/g, " ").trim().slice(0, 120);

    btn.append(name, ...(s.tags.length ? [tagRow] : []), preview);
    btn.addEventListener("click", () => openSnippet(s.id));
    const li = document.createElement("li");
    li.append(btn);
    return li;
  }));
}

function renderWelcome() {
  const { trigger, minChars } = state.settings;
  $("welcome-howto").textContent = t("welcomeHowTo", trigger, minChars, `${trigger}info`);
}

async function refresh() {
  [state.snippets, state.settings] = await Promise.all([store.listSnippets(), store.getSettings()]);
  renderList();
  renderWelcome();
}

/* ------------------------------------------------------------------ editor */
function snapshot() {
  return JSON.stringify([normalizeKey($("f-name").value), tags.tags, tags.pending, editor.html]);
}

function isDirty() {
  return state.editing && snapshot() !== state.baseline;
}

async function confirmDiscard() {
  if (!isDirty()) return true;
  const r = await ask({
    title: t("unsavedTitle"),
    message: t("unsavedConfirm"),
    buttons: [
      { id: "discard", label: t("btnDiscard"), kind: "danger solid" },
      { id: "cancel", label: t("btnCancel") },
    ],
  });
  return r.button === "discard";
}

function showError(field, code) {
  $(`err-${field}`).textContent = code ? t(code) : "";
  const input = field === "name" ? $("f-name") : field === "tags" ? tags.input : $("f-body");
  input.setAttribute("aria-invalid", String(Boolean(code)));
}

function clearErrors() {
  for (const f of ["name", "tags", "html"]) showError(f, null);
}

function checkName() {
  const raw = $("f-name").value;
  const name = normalizeKey(raw);
  let err = keyError(name);
  if (!err && state.snippets.some((s) => s.name === name && s.id !== state.currentId)) err = "errNameDuplicate";
  showError("name", raw.trim() || state.submitted ? err : null);
  return err;
}

function updatePreview() {
  $("plain-text").textContent = htmlToText(editor.html);
}

function loadForm(snippet) {
  state.editing = true;
  state.currentId = snippet?.id ?? null;
  state.submitted = false;
  $("f-name").value = snippet?.name ?? "";
  tags.tags = snippet?.tags ?? [];
  editor.html = snippet?.html ?? "";
  clearErrors();
  updatePreview();
  state.baseline = snapshot();

  $("editor-title").textContent = snippet ? t("editorEdit") : t("editorNew");
  $("btn-delete").hidden = !snippet;
  $("welcome").hidden = true;
  $("editor").hidden = false;
  renderList();
}

async function openSnippet(id) {
  if (state.editing && id === state.currentId) return;
  if (!(await confirmDiscard())) return;
  const snippet = state.snippets.find((s) => s.id === id);
  if (snippet) loadForm(snippet);
}

async function newSnippet() {
  if (!(await confirmDiscard())) return;
  loadForm(null);
  $("f-name").focus();
}

function closeEditor() {
  state.editing = false;
  state.currentId = null;
  $("editor").hidden = true;
  $("welcome").hidden = false;
  renderList();
}

async function save(e) {
  e?.preventDefault();
  state.submitted = true;
  const tagErr = tags.commit();
  const nameErr = checkName();
  if (tagErr) showError("tags", tagErr);

  const result = await store.saveSnippet({
    id: state.currentId ?? undefined,
    name: $("f-name").value,
    tags: tags.tags,
    html: editor.html,
  });
  if (!result.ok || tagErr) {
    const errors = { ...(result.errors || {}) };
    if (tagErr) errors.tags = tagErr;
    if (nameErr && !errors.name) errors.name = nameErr;
    for (const f of ["name", "tags", "html"]) showError(f, errors[f]);
    if (errors.id) setStatus(t(errors.id), true);
    const first = errors.name ? $("f-name") : errors.tags ? tags.input : $("f-body");
    first.focus();
    return;
  }
  await refresh();
  loadForm(result.snippet); // show the normalized/sanitized version that was stored
  setStatus(t("statusSaved"));
}

async function cancelEdit() {
  if (!(await confirmDiscard())) return;
  closeEditor();
}

async function deleteCurrent() {
  const snippet = state.snippets.find((s) => s.id === state.currentId);
  if (!snippet) return;
  const r = await ask({
    title: t("deleteTitle"),
    message: t("deleteConfirm", snippet.name),
    buttons: [
      { id: "delete", label: t("btnDelete"), kind: "danger solid" },
      { id: "cancel", label: t("btnCancel") },
    ],
  });
  if (r.button !== "delete") return;
  await store.deleteSnippet(snippet.id);
  closeEditor();
  await refresh();
  setStatus(t("statusDeleted"));
}

/** Ask for a link target; adds https:// or mailto: when the scheme is missing. */
async function askLink(selectedText) {
  const guess = /^(https?:|mailto:|tel:)/i.test(selectedText.trim()) ? selectedText.trim() : "";
  const normalize = (v) => {
    const s = v.trim();
    if (!s || SAFE_URL_RE.test(s)) return s;
    if (/^[^\s@/]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
    if (/^\+?[\d\s().-]{6,}$/.test(s)) return `tel:${s.replace(/[\s().-]/g, "")}`;
    return `https://${s}`;
  };
  const r = await ask({
    title: t("linkTitle"),
    fields: [{ id: "url", label: t("linkPrompt"), value: guess, placeholder: "https://" }],
    buttons: [
      { id: "ok", label: t("btnOk"), kind: "primary" },
      { id: "cancel", label: t("btnCancel") },
    ],
    validate: ({ url }) => {
      const value = normalize(url);
      try {
        if (SAFE_URL_RE.test(value) && new URL(value)) return null;
      } catch {
        /* fall through */
      }
      return { url: "errLinkInvalid" };
    },
  });
  return r.button === "ok" ? normalize(r.values.url) : null;
}

/* ----------------------------------------------------------------- options */
async function openOptions() {
  const { trigger, minChars } = state.settings;
  const r = await ask({
    title: t("optionsTitle"),
    fields: [
      { id: "trigger", label: t("optTrigger"), hint: t("optTriggerHint"), value: trigger, maxLength: 3 },
      {
        id: "minChars",
        type: "select",
        label: t("optMinChars"),
        hint: t("optMinCharsHint"),
        value: minChars,
        options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
      },
    ],
    buttons: [
      { id: "save", label: t("btnSave"), kind: "primary" },
      { id: "cancel", label: t("btnCancel") },
    ],
    validate: async (values) => {
      const res = await store.saveSettings({ trigger: values.trigger, minChars: Number(values.minChars) });
      return res.ok ? null : res.errors;
    },
  });
  if (r.button === "save") {
    await refresh();
    setStatus(t("statusOptionsSaved"));
  }
}

/* ---------------------------------------------------------- import / export */
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function exportSnippets(prefix = "helpdesk-helper-snippets") {
  const data = await store.exportData();
  const file = `${prefix}-${timestamp()}.json`;
  downloadJson(file, data);
  return { file, count: data.snippets.length };
}

async function onExport() {
  const { file, count } = await exportSnippets();
  setStatus(t("statusExported", count, file));
}

async function showImportError(code) {
  await ask({
    title: t("importFailedTitle"),
    message: t(code),
    buttons: [{ id: "ok", label: t("btnClose"), kind: "primary" }],
  });
}

async function onImportFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return showImportError("errImportNotJson");
  }
  const envelope = validateImportEnvelope(data);
  if (!envelope.ok) return showImportError(envelope.error);

  const choice = await ask({
    title: t("importTitle"),
    message: [t("importConfirm", file.name, envelope.snippets.length), t("importMergeHelp"), t("importReplaceHelp")],
    buttons: [
      { id: "merge", label: t("btnMerge"), kind: "primary" },
      { id: "replace", label: t("btnReplace"), kind: "danger" },
      { id: "cancel", label: t("btnCancel") },
    ],
  });
  if (!choice.button) return;
  if (!(await confirmDiscard())) return;

  let backup = null;
  if (choice.button === "replace" && state.snippets.length) {
    backup = (await exportSnippets("helpdesk-helper-backup")).file;
  }
  const result = await store.importData(data, choice.button);
  if (!result.ok) return showImportError(result.error);

  closeEditor();
  await refresh();
  const { added, updated, skipped } = result.summary;
  const reason = (errors) => Object.values(errors).map((code) => t(code)).join(" ");
  await ask({
    title: t("importDoneTitle"),
    message: [t("importSummary", added, updated, skipped.length), ...(backup ? [t("importBackup", backup)] : [])],
    details: skipped.map((s) => t("importSkippedItem", s.index + 1, s.name ?? t("noName"), reason(s.errors))),
    buttons: [{ id: "ok", label: t("btnClose"), kind: "primary" }],
  });
}

/* -------------------------------------------------------------------- init */
async function init() {
  document.documentElement.lang = lang;
  applyI18n();

  tags = new TagInput($("f-tags"), {
    inputId: "f-tags-input",
    placeholder: t("tagsPlaceholder"),
    removeLabel: (tag) => t("tagRemove", tag),
    onError: (code) => showError("tags", code),
  });
  editor = new RichEditor($("f-body"), $("toolbar"), {
    onInput: () => {
      updatePreview();
      if (state.submitted) showError("html", null);
    },
    askLink,
  });

  $("btn-new").addEventListener("click", newSnippet);
  $("btn-export").addEventListener("click", onExport);
  $("btn-options").addEventListener("click", openOptions);
  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (file) await onImportFile(file);
  });

  $("search").addEventListener("input", renderList);
  $("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("list").querySelector(".snippet-item")?.click();
  });

  $("editor").addEventListener("submit", save);
  $("f-name").addEventListener("input", checkName);
  $("btn-cancel").addEventListener("click", cancelEdit);
  $("btn-delete").addEventListener("click", deleteCurrent);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && state.editing) {
      e.preventDefault();
      save();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) e.preventDefault();
  });

  // Keep the list in sync with changes made elsewhere (another manager tab, an import).
  messenger.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.snippets || changes.settings)) refresh();
  });

  await refresh();
}

init();
