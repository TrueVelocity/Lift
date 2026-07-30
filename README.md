# Lift (LFT Archive Manager)

Electron app for compressing files into `.lft` archives (ZIP under the hood) and extracting them.

## Setup

```bash
cd lft-archive-manager
npm install
npm start
```

## Project structure

```
lft-archive-manager/
├── main.js          # Electron main process (window, IPC, JSZip)
├── preload.js       # Secure bridge → window.electronAPI
├── package.json
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js       # Renderer UI logic
    ├── LFT-logo.png # (optional – place your logo here)
    └── LFT-logo.ico
```

## What was fixed

1. **Duplicate / conflicting logic** – Removed the huge inline `<script>` from `index.html`. All UI logic lives in `app.js`.
2. **Compress / Extract were stubs** – They only showed toasts. Now they talk to the main process via `electronAPI.compressLft` / `extractLft`.
3. **Broken IPC** – Preload exposed `closeWindow` but main listened for `window:close`. Fixed channel names and API surface.
4. **Files never read as binary** – Compress needs real bytes. Files are now read with `FileReader.readAsArrayBuffer` and stored as `content`.
5. **Fake JSON “archives”** – Main process builds real ZIP archives with JSZip and saves them as `.lft`. Extract unpacks ZIP to a chosen folder.
6. **Inspector** – Double-click or context-menu “Inspect” on a `.lft` lists files inside the archive (via `lft:inspect`).
7. **Window controls** – Minimize / close wired to Electron.
8. **CSS / HTML cleanup** – Single coherent stylesheet, proper empty-state class, inspector close button, no conflicting inline styles.

## Usage

1. **Add Files** or drag & drop into the grid.
2. Click cards to select.
3. **Compress Selected** → save dialog → creates a `.lft` (ZIP).
4. Add the `.lft` back into the app (or keep it selected if still in memory), then **Extract Selected** → choose folder.
5. Right-click a card for Rename / Inspect / Delete.
6. Double-click a `.lft` to open the Inspector panel.

## Notes

- Place `LFT-logo.png` and `LFT-logo.ico` in `public/` if you have them (the HTML falls back gracefully if missing).
- Browser-only (opening `index.html` directly) runs in demo mode: compress creates a lightweight JSON blob instead of a real ZIP.
