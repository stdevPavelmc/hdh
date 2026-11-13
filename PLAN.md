# Help Desk Helper — Thunderbird add-on plan

## 1. Goal
While writing or replying to an email in Thunderbird, an agent types a trigger such as `/gret`. A list of matching predefined text snippets pops up, and the selected snippet replaces the `/gret` text. Snippets are created and managed inside Thunderbird, and they can be exported and imported as JSON to set up other help desk stations.

## 2. Decisions taken
| Topic | Decision |
|---|---|
| Snippet content | Rich text (bold, italic, underline, lists, links). Formatting is removed automatically in plain-text compose. |
| Variables | None in v1. The data model leaves room to add them later. |
| Trigger | Default `/`, configurable in options. Fires only at the start of a word (after a space or tab, at a line start, or at the start of the body), so `and/or` and URLs never trigger. |
| Min chars | 3 by default, configurable from 1 to 5. |
| Matching | 1) tag prefix → 2) name prefix → 3) tag or name contains → 4) fuzzy: the typed letters appear in order and the first letter matches, so `gret` finds `greeting`. Ignores case and accents. |
| Single match | The list still shows with that match pre-highlighted, and Space/Tab/Enter inserts it. |
| Keys while list is open | ↑/↓ move the highlight. Space/Tab/Enter insert. Esc closes the list and keeps the typed text. Typing keeps filtering live. With no match a small "no snippets" hint shows and Space types normally. |
| Names / tags | One word, `-` allowed, no spaces or `_`. Regex `^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$`, stored in lowercase, max 32 chars. Names must be unique, and each snippet can have several tags. |
| Manager UI | A main-toolbar button opens the manager in a Thunderbird tab: list and search, create, edit, delete, import, export and options. |
| Editing rights | Every agent can create, edit and delete snippets. Imported snippets are ordinary snippets. |
| Deployment | Manual JSON export and import. Import asks: **Merge** (on a name clash the imported one wins, then a summary shows) or **Replace all** (a backup is exported automatically first). |
| Distribution | Local, unsigned XPI. Thunderbird does not enforce add-on signing, so it installs through Add-ons Manager → ⚙ → *Install Add-on From File*. |
| Languages | English (default) and Spanish, through `_locales/en` and `_locales/es`. Thunderbird picks the language from its UI locale (`es-ES`, `es-AR` and other variants fall back to `es`), and any other locale gets English. |
| Dev env | A Docker image for lint, unit tests and XPI build. Manual testing in a throwaway Thunderbird profile on the host. |

## 3. Compatibility strategy (TB 140 ESR → latest release, Win/Linux/macOS)
- **Manifest V3**, `strict_min_version: "128.0"`, no `strict_max_version`. A fixed `browser_specific_settings.gecko.id` (e.g. `helpdesk-helper@chagod.local`), so a newer XPI replaces the installed one.
- **No Experiment APIs.** They are the usual reason add-ons break between Thunderbird versions. Everything uses stable WebExtension APIs.
- **Compose injection through `messenger.scripting.compose.registerScripts()`**, which exists since TB 128. Do **not** use the `compose_scripts` manifest key, because it only exists from TB 151 and would break on 140 ESR. The background script re-registers on every start, after checking `getRegisteredScripts()` first.
- MV3 background is a non-persistent event page, so no global state is kept in memory. Everything lives in `storage.local`.
- No OS-specific code. Keyboard handling uses `KeyboardEvent.key`, which works the same on all platforms; the macOS Cmd/Ctrl difference does not matter here.
- I could not confirm the exact current release number from public docs (you mentioned 160). The plan targets "128+ with no upper cap", and we smoke-test against the newest release tarball available when we test.

## 4. Architecture
```
manifest.json
_locales/{en,es}/messages.json
background/background.js      – registers compose script, handles the toolbar action, message routing, onBeforeSend cleanup
compose/content.js            – trigger detection, popup, keyboard nav, insertion (runs in compose editor)
compose/popup.css
manager/manager.html|js|css   – snippet CRUD, rich editor, import/export, options (opened as a tab)
lib/store.js                  – storage.local wrapper, schema migrations
lib/validate.js               – name/tag rules, import file validation
lib/search.js                 – ranking (pure, unit tested)
lib/sanitize.js               – HTML allowlist sanitizer (vendored DOMPurify)
lib/html2text.js              – rich → plain conversion for plain-text compose
lib/i18n.js                   – applies data-i18n attributes to pages
icons/
tests/                        – vitest + jsdom
```

**Permissions:** `compose`, `compose.save`, `messagesRead`, `storage`, `scripting`. No network or host permissions. Export uses a Blob plus an `<a download>` link, so the `downloads` permission is not needed.

**Data model (`storage.local`):**
```json
{ "schemaVersion": 1,
  "settings": { "trigger": "/", "minChars": 3 },
  "snippets": [ { "id": "uuid", "name": "greeting-es", "tags": ["greet","spanish"],
                  "html": "<p>Hola, …</p>", "createdAt": "…", "updatedAt": "…" } ] }
```
**Export file:** `{ "format": "helpdesk-helper-snippets", "version": 1, "exportedAt": "…", "snippets": [...] }`. Settings are not exported, so each station keeps its own trigger. On import, every file is validated against the schema and its HTML is **sanitized**, because an import file is untrusted input.

**Compose flow:**
1. `content.js` listens for `keydown` (capture phase) and `input` on the editor document.
2. After each input it reads the text before the caret in the current text node and matches `(^|\s)<trigger>([\p{L}\p{N}-]{min,})$`.
3. On a match it asks the background (or a cached copy of the snippets) for ranked results and shows the popup at the caret position (`Range.getBoundingClientRect`).
4. To insert, it selects the trigger range and calls `document.execCommand('insertHTML' | 'insertText')`, which keeps **Ctrl+Z undo** working and keeps the editor consistent. Plain-text compose is detected through `compose.getComposeDetails().isPlainText`.

## 5. Main risk — verify first (Phase 0 spike)
The compose editor document *is* the message body, so a popup element added to it could end up in a **sent message or an auto-saved draft**. Mitigations to prove in the spike:
- Attach the popup with a closed shadow root to `documentElement`, outside `<body>`, and check whether Thunderbird serializes it.
- Remove the popup on blur, on Esc and after insertion. Also remove it from `compose.onBeforeSend`, where the background messages the tab to clean up.
- Check that drafts saved while the popup is open contain no trace of it.

Fallback if leaking can't be ruled out: show the list in a small `windows.create({type:"popup"})` window next to the compose window. It works but handles keyboard focus less smoothly.

The spike also checks: injection on TB 140 and on the latest release, `insertHTML` undo, behaviour in plain-text mode, and replying above vs. below the quote.

## 5b. Spike results (TB 140.17.0esr, Linux, 2026-11-13)
- Compose script registration via `scripting.compose.registerScripts()`: ✅. Input events fire in the editor (`designMode=on`).
- `execCommand('insertHTML')` inserts formatted text, lists and links in new mails, replies and forwards: ✅
- **The popup outside `<body>` is still serialized into drafts.** Thunderbird saves the whole document, and no `onBeforeSave` event exists. The final design therefore uses all of these layers:
  1. Close on Ctrl/Alt/Cmd keydown (Ctrl+S, Ctrl+Enter, menus). Verified ✅
  2. Close on mouse leaving the editor (toolbar Save/Send buttons). Verified ✅
  3. Close on non-typing keys, on blur and when the window is hidden.
  4. Close automatically after ~15 s with no key press (to add in v1).
  5. Remove any leftover popup on injection and in `onBeforeSend`. onBeforeSend verified ✅
  6. Self-heal in `onAfterSave`: if a draft or autosave contains the popup, clean it and re-save. Verified ✅. This needs the `compose.save` and `messagesRead` permissions.
- Plain-text compose: inserting works ✅ (user-verified). However, `getComposeDetails().isPlainText` reported `false` in every window logged, so the snippets went in through `insertHTML` and Thunderbird's plain-text editor converted them itself. In v1, plain-text mode is detected from both the API and the editor document (a plain-text body uses `white-space: pre-wrap` and a fixed-width font), and this is re-checked in Phase 4.
- Ctrl+Z after an insertion removes the whole snippet in one step and restores the `/trigger` text ✅ (user-verified).
- The sweep of an already-leaked draft is covered by a unit test (`tests/content.test.js`). Testing on the latest TB release is tracked in §6.

## 6. Phases (status 2026-11-13)
0. ✅ **Spike.** In-editor popup is a go on TB 140 ESR. Results in §5b; the spike code has been removed.
1. ✅ **Scaffolding.** Dockerfile, Makefile, manifest, locales, ESLint, `web-ext lint`.
2. ✅ **Core libs.** Store, validation, search ranking, sanitizer, html→text, all with unit tests.
3. ✅ **Manager tab.** List and search, create/edit form with tag chips and live validation, rich editor, delete with confirm, options, EN/ES. Import/export was done here too. Verified in TB 140 by the user.
4. ✅ **Compose script.** Trigger detection, popup, keyboard navigation, insertion, all leak-protection layers, plain-text handling, live settings updates. Verified in TB 140 by the user.
5. ✅ **Import/export.** Merge or Replace dialog, auto-backup, result summary, error reporting (built in Phase 3).
6. ✅ **Packaging and docs.** `make xpi` → `dist/helpdesk-helper-<ver>.xpi`; `README.md` / `README.es.md`; `TESTING.md` release checklist; `examples/starter-snippets.json`.

**Verified:** v1.0.0 passes `TESTING.md` on TB 140.17.0 ESR and TB 160.0 (latest release), both on Linux.

**Still open:**
- Run `TESTING.md` on one Windows and one macOS station before rollout.

## 7. Dev environment (Docker, host stays clean)
- `docker/Dockerfile` is based on `node:24-slim`. Dependencies are pinned in `package-lock.json` (ESLint 9.39, Vitest 5.1, jsdom 31, web-ext 10.8, DOMPurify 3.4.17) and installed into `/app/node_modules` inside the image. The project is mounted at `/app/project`, and all Vite/Vitest caches go to `/tmp` inside the container.
- Containers run as `-u $(id -u):$(id -g)`, so generated files belong to you.
- `Makefile` targets: `image`, `vendor` (copies DOMPurify into `src/vendor/`), `lint`, `test`, `check`, `xpi`, `shell`, `tb-test`, `clean`.
- Add-on source lives in `src/`; unit tests are in `tests/`.
- Expected `web-ext lint` warnings: the Thunderbird-only permissions `compose`, `compose.save` and `messagesRead`; `MISSING_DATA_COLLECTION_PERMISSIONS`, which only matters for addons.thunderbird.net (not used); and `innerHTML` inside the vendored DOMPurify.
- Manual testing: `make tb-test` starts a throwaway profile in `./.tbprofile`. To test the latest release, extract the official Linux tarball into `./.cache/` and run `make tb-test TB=.cache/thunderbird/thunderbird`.

## 8. Out of scope for v1 (possible later)
Variables/placeholders, a quick-insert list in the compose toolbar, "save selection as snippet", central URL sync or enterprise policy deployment, a usage counter or "recently used" ranking, and update_url-based auto-update.

> Note: the established add-on **Quicktext** covers similar ground. This plan is a purpose-built alternative with tag search, inline popup, EN/ES UI and JSON deployment, and it avoids Experiment APIs so it survives Thunderbird updates.
