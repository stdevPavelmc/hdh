# Release test checklist

Run `make xpi` first: lint and the unit tests must pass. Then work through this list in a throwaway profile (`make tb-test`) with a mail account that sends to itself. Repeat it on each Thunderbird version you deploy to.

| Thunderbird | OS | Date | Tester | Result |
|---|---|---|---|---|
| 140.17.0 ESR | Linux | 2026-11-13 | help desk admin | ✅ all pass (v0.3.0–1.0.0) |
| 160.0 (latest release) | Linux | 2026-11-13 | help desk admin | ✅ all pass (v1.0.0) |
| (station version) | Windows | | | |
| (station version) | macOS | | | |

To test the latest release without installing it, extract the official tarball into `./.cache/` and run `make tb-test-latest`. It uses its own profile (`./.tbprofile-latest`), because a newer Thunderbird upgrades a profile and the older version then refuses to open it.

## 1. Install
- [ ] The `.xpi` installs from Add-ons Manager → ⚙ → Install Add-on From File.
- [ ] The **Snippets** / **Fragmentos** button appears in the main toolbar and opens the manager tab. A second click reuses the tab.
- [ ] Add-ons Manager → Help Desk Helper → Options opens the same manager.
- [ ] Installing a newer version over an older one keeps the snippets.

## 2. Manager
- [ ] Import `examples/starter-snippets.json` with **Merge**. The summary says 10 added.
- [ ] Create a snippet with bold text, a bulleted list and a link. Save, reload the tab, and check it's intact.
- [ ] A name with a space or `_` shows an error and isn't saved. A duplicate name is refused.
- [ ] Tags: Space, comma and Enter create chips, Backspace removes the last one, and `bad_tag` stays in the field with an error.
- [ ] The plain-text preview shows `- item` and `text <url>`.
- [ ] Switching snippets with unsaved changes asks first. Ctrl+S saves.
- [ ] Delete asks for confirmation.
- [ ] Options: an invalid trigger (`ab`) is refused, and `;;` with 2 letters is saved. The start-page help text updates.
- [ ] Export saves a `.json` file. Import it with **Replace all**: a backup file is exported first.
- [ ] Importing an unrelated `.json` file shows an error and changes nothing.

## 3. Compose (HTML)
- [ ] `/gre` lists the greeting snippets. ↑/↓ change the highlight. Enter, Tab and Space each insert the highlighted snippet and replace `/gre`.
- [ ] `/gret` finds the greetings (fuzzy match) and `/espa` finds `español` tags.
- [ ] Ctrl+Z right after inserting removes the snippet in one step and brings `/gre` back.
- [ ] `/xyz` shows "No snippets match" and Space types a normal space.
- [ ] `and/or` and `https://example.com/abc` never open the list.
- [ ] Esc, clicking elsewhere, ←/→, and moving the mouse to the toolbar each close the list.
- [ ] The list closes by itself after ~15 s without typing.
- [ ] Reply (quote below and quote above) and Forward: the snippet goes in at the cursor and the quote is intact.
- [ ] Changing the trigger in Options takes effect in an already-open compose window.

## 4. Compose (plain text)
Shift+click **Write**, or set the account to compose in plain text.
- [ ] Snippets are inserted without formatting. Lists show as `- item` and links as `text <url>`. Line breaks are kept.

## 5. Nothing leaks into mail
For each case, open the saved draft or the sent mail with **View → Message Source** (Ctrl+U) and search for `hdh-popup`. It must not be there.
- [ ] Ctrl+S with the list open.
- [ ] Toolbar **Save** clicked with the mouse while the list is open.
- [ ] Autosave (Settings → Composition → Auto Save every **1** minute) with the list left open.
- [ ] Ctrl+Enter send with the list open.

## 6. Language
- [ ] With Thunderbird in Spanish, the manager, dialogs, errors, popup hint and toolbar button are in Spanish.
- [ ] With Thunderbird in any other language (e.g. German), everything is in English.
