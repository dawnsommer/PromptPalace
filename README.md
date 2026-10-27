# PalacePrompt JS (Compact)

A small, no-framework JavaScript web app for building a two-stage Sketchy Step 2 CK image prompt. **No Node.js, React, build step, or network connection required.**

## How to use

- Double-click `index.html` (keep `app.js`, `template.js`, and `styles.css` in the same folder).
- Step 1: enter condition name, parody world, and clinical data. Press **Copy 1E**.
- Use the sliding stage toggle or **Next** button.
- Step 2: paste Data 2, then press **Copy final**.
- Use **Preview** to view the output on narrow screens; on wider screens it sits alongside the form.
- **Settings**: edit and save the base template, restore any version, restore the original template, and export/import JSON backups.

Shortcut: **⌘Enter** on macOS or **Ctrl+Enter** on Windows/Linux copies the output for the selected stage.

## Files

- `index.html`: minimal launcher (loads three scripts/styles)
- `app.js`: UI and all app logic in vanilla JavaScript
- `template.js`: original full 9,386-character prompt template
- `styles.css`: compact and responsive layout
- `template.txt`: original template for reference

## Local data / migration

Saved inputs and template versions are kept in browser localStorage (`palaceprompt.state.v1`). If you host the new version on the **same origin** as the earlier PalacePrompt, prior saved data can be loaded. Opening different `file://` copies can have different browser storage; use Settings → Backup to transfer your history reliably. No text is transmitted to servers.

Clipboard read/write may require browser permission or a secure origin. If Paste is blocked, click the field and press ⌘V/Ctrl+V. Copy includes a legacy fallback.

## Host on GitHub Pages

Upload `index.html`, `app.js`, `styles.css` and `template.js` to a repository/folder. Deploy the folder as a static site. No compilation or dependencies.
