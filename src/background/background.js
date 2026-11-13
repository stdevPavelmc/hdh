/* Help Desk Helper – background (MV3 event page, ES module). */
import { createStore } from "../lib/store.js";
import { buildPopupItems } from "../lib/popup-items.js";
import { t, uiLanguage } from "../lib/i18n.js";

const COMPOSE_SCRIPT_ID = "hdh-compose";
const COMPOSE_SCRIPTS = ["compose/trigger.js", "compose/content.js"];
const POPUP_MARKER = "hdh-popup";

const store = createStore();
let snippetCache = null; // Promise<snippets[]>, dropped whenever storage changes

/* ---------------------------------------------------------------- setup */

/**
 * Register the compose-editor scripts. Uses scripting.compose (TB 128+) on purpose:
 * the `compose_scripts` manifest key only exists from TB 151 and would break 140 ESR.
 * Only affects compose windows opened after registration.
 */
async function registerComposeScripts() {
  try {
    const existing = (await messenger.scripting.compose.getRegisteredScripts())
      .find((s) => s.id === COMPOSE_SCRIPT_ID);
    if (existing && JSON.stringify(existing.js) === JSON.stringify(COMPOSE_SCRIPTS)) return;
    if (existing) await messenger.scripting.compose.unregisterScripts({ ids: [COMPOSE_SCRIPT_ID] });
    await messenger.scripting.compose.registerScripts([{ id: COMPOSE_SCRIPT_ID, js: COMPOSE_SCRIPTS }]);
  } catch (e) {
    console.error("[HDH] compose script registration failed", e);
  }
}

/* ------------------------------------------------------- compose script API */

async function composeConfig(tabId) {
  const settings = await store.getSettings();
  let isPlainText = false;
  try {
    isPlainText = Boolean((await messenger.compose.getComposeDetails(tabId)).isPlainText);
  } catch {
    /* not a compose tab or already closed */
  }
  return {
    ...settings,
    isPlainText,
    strings: { noMatch: t("popupNoMatch"), hint: t("popupHint") },
  };
}

async function search(query) {
  snippetCache ??= store.listSnippets();
  return { items: buildPopupItems(await snippetCache, query, { locale: uiLanguage() }) };
}

async function broadcastConfig() {
  const tabs = await messenger.tabs.query({ type: "messageCompose" });
  await Promise.all(tabs.map(async (tab) => {
    const config = await composeConfig(tab.id);
    return messenger.tabs.sendMessage(tab.id, { cmd: "hdh:config", config }).catch(() => {});
  }));
}

/* -------------------------------------------------------- leak protection */

function containsMarker(text) {
  return typeof text === "string" && text.replace(/=\r?\n/g, "").includes(POPUP_MARKER); // undo QP soft breaks
}

function partContainsMarker(part) {
  return !!part && (containsMarker(part.body) || (part.parts || []).some(partContainsMarker));
}

const healing = new Set(); // tabs with a self-heal re-save in progress

/** Drafts/templates saved while the popup was open (e.g. autosave): clean up and save again. */
async function checkSavedDraft(tab, saveInfo) {
  for (const msg of saveInfo?.messages || []) {
    let leaked = false;
    try {
      const raw = await messenger.messages.getRaw(msg.id);
      leaked = containsMarker(typeof raw === "string" ? raw : await raw.text())
        || partContainsMarker(await messenger.messages.getFull(msg.id));
    } catch (e) {
      console.warn("[HDH] could not inspect saved message", e);
      continue;
    }
    if (!leaked) {
      healing.delete(tab.id);
      continue;
    }
    if (healing.has(tab.id)) {
      console.error("[HDH] popup still present after re-save; giving up for this save");
      healing.delete(tab.id);
      continue;
    }
    healing.add(tab.id);
    try {
      await messenger.tabs.sendMessage(tab.id, { cmd: "hdh:cleanup" });
      await messenger.compose.saveMessage(tab.id, { mode: saveInfo.mode === "template" ? "template" : "draft" });
    } catch (e) {
      console.error("[HDH] self-heal re-save failed", e);
      healing.delete(tab.id);
    }
  }
}

/* -------------------------------------------- listeners (top level for MV3) */

messenger.runtime.onInstalled.addListener(registerComposeScripts);
messenger.runtime.onStartup.addListener(registerComposeScripts);
messenger.action.onClicked.addListener(() => messenger.runtime.openOptionsPage());

messenger.runtime.onMessage.addListener((msg, sender) => {
  switch (msg?.cmd) {
    case "hdh:init":
      return composeConfig(sender.tab?.id);
    case "hdh:search":
      return search(String(msg.query ?? ""));
    default:
      return undefined;
  }
});

messenger.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.snippets) snippetCache = null;
  if (changes.settings) broadcastConfig();
});

messenger.compose.onBeforeSend.addListener(async (tab) => {
  await messenger.tabs.sendMessage(tab.id, { cmd: "hdh:cleanup" }).catch(() => {});
  return {};
});

messenger.compose.onAfterSave.addListener((tab, saveInfo) => checkSavedDraft(tab, saveInfo));

registerComposeScripts();
