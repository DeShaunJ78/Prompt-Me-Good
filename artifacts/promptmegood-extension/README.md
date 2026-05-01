# Send to PromptMeGood — Browser Extension

A small Manifest V3 browser extension that adds a **right-click → Send to PromptMeGood** option to any text selection or image on the web. Clicking it opens the [PromptMeGood](https://www.promptmegood.com/) web app with your selection prefilled, ready to refine.

## What it does

- **Text.** Highlight a sentence on any page, right-click, choose **Send to PromptMeGood**. The web app opens in Text mode with your selection in the goal box.
- **Image.** Right-click an image, choose **Send image to PromptMeGood**. The web app opens in Image mode with the image URL captured as a starting reference.

The handoff happens entirely in the URL — no servers, no accounts, no background tracking. The encoding reuses the same `#pmgshare=…` format the web app's built-in **Share** button already uses, so any future change to the share format just works.

## Install in unpacked dev mode

### Chrome / Edge / Brave / Arc

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `artifacts/promptmegood-extension/` folder from this repo.
5. Pin the extension from the puzzle-piece menu so you can find it.

### Firefox (121+)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select **`manifest.json`** inside `artifacts/promptmegood-extension/`.

   The add-on stays loaded until you restart Firefox. For permanent install you'd need to package and sign — out of scope for this milestone.

## Pointing it at a different URL (e.g. local dev)

Click the extension icon to open the popup, then change the **PromptMeGood URL** field. Useful values:

- `https://www.promptmegood.com/` — live site (default)
- `https://<your-replit-dev-url>/` — your dev preview
- `http://localhost:5000/` — a local build

The setting is stored via `chrome.storage.sync`, so it follows you across browsers signed into the same profile.

## Files

```
artifacts/promptmegood-extension/
├── manifest.json     # MV3 manifest, permissions, icons, action popup
├── background.js     # Service worker: context menus + URL handoff
├── popup.html        # Action popup UI
├── popup.css
├── popup.js          # Reads/writes the configurable target URL
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

## Permissions

- `contextMenus` — to register the right-click items.
- `storage` — to remember which PromptMeGood URL to send to.

No host permissions are requested. The extension never reads page contents beyond what the browser hands it for the right-clicked element (selection text or image src).

## Out of scope

- Publishing to the Chrome Web Store / Firefox Add-ons (manual install only for now).
- Safari extension.
- Capturing image bytes / re-uploading to the web app — only the image URL is handed off.
