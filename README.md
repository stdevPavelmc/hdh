# Help Desk Helper

*[Leer en español](README.es.md)*

Help Desk Helper is a Thunderbird add-on for inserting predefined text snippets while you write or answer an email. Type `/` followed by a few letters of a tag or name (for example `/greet`), pick a snippet from the list, and it replaces what you typed.

- Works on Thunderbird **128 and later** (tested on 140 ESR), on Windows, macOS and Linux.
- The interface follows Thunderbird's language: **English** or **Spanish**. Any other language falls back to English.
- Snippets are stored locally in Thunderbird. Nothing is sent anywhere.

---

## Install

1. Get the add-on file, `helpdesk-helper-<version>.xpi`.
2. In Thunderbird, open **☰ → Add-ons and Themes**.
3. Click **⚙ → Install Add-on From File…**, choose the `.xpi` and confirm.
4. A **Snippets** button appears in the main toolbar.

**To update**, install the newer `.xpi` the same way. It replaces the old version and keeps your snippets.

> After installing or updating, open a **new** compose window. Windows that were already open don't get the add-on.

## Use it while writing

| You type / press | What happens |
|---|---|
| `/` + 3 letters at the start of a word, e.g. `/gre` | A list of matching snippets opens |
| More letters | The list narrows |
| ↑ / ↓ | Choose a snippet |
| **Enter**, **Tab** or **Space** | Insert it; `/gre` is replaced |
| **Esc** | Close the list and keep what you typed |
| **Ctrl+Z** right after inserting | Undo the insertion; `/gre` comes back |

**How matching works:** tags that start with what you typed come first, then names that start with it, then tags or names that contain it. Last come loose matches where your letters appear in order, so `/gret` still finds `greeting`. Case and accents are ignored, so `/espa` finds `español`.

**When it doesn't trigger:** the slash has to start a word. `and/or` and web addresses never open the list. If nothing matches, a short "No snippets match" note shows and Space types normally.

**Plain-text emails** get the snippet without formatting. Lists become `- item` and links become `text <address>`.

## Manage snippets

Click **Snippets** in the main toolbar. The manager also opens from Add-ons Manager → Help Desk Helper → **Options**.

- **New snippet:** enter a **name**, some **tags** and the **text**.
  - Names and tags are one word: letters and numbers, with `-` to join words.
    `info-spanish` ✅ · `info spanish` ❌ · `info_spanish` ❌
  - In the tags field, press Space, Enter or comma after each tag. Backspace removes the last one.
  - The text editor supports **bold**, *italic*, underline, bulleted and numbered lists, and links. Pasted text is cleaned automatically.
  - **Plain-text preview** shows how the snippet looks in plain-text emails.
- **Ctrl+S** saves. You're asked before leaving a snippet with unsaved changes.
- **Search** (top left) filters the list using the same matching as `/` in emails.
- **Options:**
  - *Trigger:* the symbol that opens the list. 1–3 symbols, default `/`; for example `\` or `;;`.
  - *Letters before the list appears:* 1–5, default 3.

## Share snippets with other stations

**On the station with the master set:** in the manager, click **Export**. A file named `helpdesk-helper-snippets-<date>_<time>.json` is saved.

**On each help desk station:** in the manager, click **Import…** and choose the file, then pick one option:
- **Merge:** adds the new snippets. A local snippet with the **same name** is replaced by the imported one, and the station's other snippets are kept.
- **Replace all:** the station ends up with exactly the file's snippets. A backup of the old ones (`helpdesk-helper-backup-….json`) is exported automatically first.

A summary shows how many snippets were added, updated and skipped, with the reason for each skipped one (for example an invalid name). Imported text is always cleaned: scripts, images and unsafe links are removed.

A ready-to-use set of English and Spanish help desk texts is in [`examples/starter-snippets.json`](examples/starter-snippets.json).

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens when typing `/abc` | Open a **new** compose window after installing or updating. Check that the trigger and the letter count in **Options** are what you expect. |
| The list never shows a snippet | Check its tags and name in the manager. Matching starts at the beginning of tags and names. |
| Two lists appear | Another snippet add-on is installed (e.g. an old test version). Remove it. |
| Import says the file is not valid | Use a file made with **Export** in this add-on. |
| Anything else | Add-ons Manager → ⚙ → **Debug Add-ons** → Help Desk Helper → **Inspect** shows the add-on's console. |

---

## For developers

Everything runs in Docker; the host needs only `docker`, `make` and Thunderbird for manual testing.

```bash
make image   # build the dev image (Node 24, ESLint, Vitest, jsdom, web-ext)
make check   # lint + unit tests
make xpi     # check, then build dist/helpdesk-helper-<version>.xpi
make tb-test # start Thunderbird with a throwaway profile in ./.tbprofile
make tb-test-latest # same with the release extracted in ./.cache (own profile)
```

| Path | Contents |
|---|---|
| `src/` | The add-on: `manifest.json`, `_locales/{en,es}`, `background/`, `compose/` (in-editor popup), `manager/` (manager tab), `lib/` (storage, validation, search, sanitizer, plain-text conversion), `vendor/` (DOMPurify) |
| `tests/` | Unit tests (Vitest + jsdom), including the compose script running in a simulated editor |
| `dev/preview.html` | The manager in an ordinary browser with a fake Thunderbird API (`python3 -m http.server 8765`, then open `/dev/preview.html?lang=es`) |
| `PLAN.md` | Design decisions, compatibility notes and the Phase 0 spike results |
| `TESTING.md` | Manual release checklist |

### Releasing

Pushing a tag `v<version>` runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It runs `make xpi` (lint, tests, build) in the same Docker toolchain as local development, then **drafts** a GitHub release containing the `.xpi`, `SHA256SUMS` and the starter snippets. The build is also kept as a workflow artifact.

1. Set the same `version` in `src/manifest.json` and `package.json`, then commit. The workflow fails if the tag and these versions differ.
2. Run [TESTING.md](TESTING.md).
3. Tag and push:
   ```bash
   git tag -a v1.1.0 -m "Help Desk Helper 1.1.0"
   git push --follow-tags
   ```
4. On GitHub → **Releases**, review the draft and click **Publish release**.

Compatibility rules (enforced by tests): Manifest V3, `strict_min_version` 128.0 with no maximum, no Experiment APIs, and compose scripts registered with `scripting.compose` rather than the `compose_scripts` manifest key (that key only exists from TB 151).
