# PalacePrompt — Two-Step Prompt Builder

A standalone, browser-only web app that populates your supplied Sketchy Step 2 CK prompt in two stages.

## Start

1. Open `index.html` in a modern browser (Chrome, Safari, or Firefox), or host the entire folder on GitHub Pages.
2. On the **Build Prompt 1E** stage, fill **Condition name**, **Parody world**, and **Clinical data**. Click **Copy Prompt 1E**.
3. Switch to **Add Data 2** using the sliding toggle at the top of the inputs (or the Continue button), paste **Data 2**, and click **Copy Final Prompt**. Only one input stage is shown at a time; you can return to Stage 1 without losing anything. The original template body and instructions remain intact.
4. Use **Template settings** to edit the base prompt, save named versions, restore old versions, or restore the factory template.

## Placeholder rules

Your template must contain each of these tokens:

- `DATA1-condition-name` — replaced with the Condition name
- `DATA1-parody-world-name` — replaced with Parody world
- `DATA1-clinical-data` — replaced with Clinical data
- `DATA2` — **on a line by itself**, replaced with Data 2 when generating Prompt 2

Stage 1 intentionally leaves the `DATA2` line in Prompt 1E. Stage 2 replaces only that standalone line. If a data field contains special characters, dollar signs, or multiline content, they are inserted literally.

## Save and recovery

Your selected stage, all fields, and versions are persisted in your browser's `localStorage` for this page/origin, not a cloud account. This usually persists between visits using the same browser and website origin. It can be lost if the browser's site data is cleared, or if you switch devices/browsers. **Export backup (.json)** frequently; **Import backup** restores all text, the active template, and saved versions.

Each **Save new version** in Template settings adds a named, timestamped snapshot. **Restore** applies an old snapshot and logs the restoration as an additional version. **Restore factory template** does not delete version history.

## Clipboard details

Copy and paste buttons use browser clipboard permissions when available. Browser file:// or insecure-origin restrictions may block direct clipboard reading; in that case, click the target field and use **Cmd+V** (Mac) or **Ctrl+V** (Windows/Linux). Copy has a legacy fallback, but may also require manual copying in restrictive environments.

## GitHub Pages

Upload `index.html`, `styles.css`, and `app.js` at the root of a repository, then enable GitHub Pages from the repository settings. The page has no dependencies, API calls, build step, or backend. The app also runs locally.

## Privacy

The app does not send data to any server. The **Open ChatGPT** link simply opens ChatGPT in a new tab; paste the copied prompt manually. No prompt or clinical data is automatically submitted to ChatGPT. Use appropriate safeguards for sensitive patient information.
