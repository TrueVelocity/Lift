// main.js – Electron main process for Lift (LFT Archive Manager)
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const JSZip = require("jszip");


// ---------- LFT custom container format ----------
// Not a raw ZIP: starts with a magic header so OS/tools don't treat it as .zip.
// Layout:
//   0..3   magic   "LFT\x01"
//   4      version  0x01
//   5..7   reserved 0x00
//   8..end ZIP payload (DEFLATE via JSZip)
const LFT_MAGIC = Buffer.from([0x4c, 0x46, 0x54, 0x01]); // L F T \x01
const LFT_VERSION = 0x01;

function wrapLft(zipBuffer) {
  const header = Buffer.alloc(8);
  LFT_MAGIC.copy(header, 0);
  header[4] = LFT_VERSION;
  // bytes 5-7 reserved
  return Buffer.concat([header, zipBuffer]);
}

function unwrapLft(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 8) {
    throw new Error("File too small to be a valid .lft archive");
  }
  // New format
  if (
    buf[0] === 0x4c && buf[1] === 0x46 && buf[2] === 0x54 && buf[3] === 0x01
  ) {
    return buf.subarray(8);
  }
  // Backward compatible: plain ZIP (PK\x03\x04) from older builds
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    return buf;
  }
  throw new Error("Not a valid Lift (.lft) archive");
}


let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, 'public/LFT-logo.ico'),
    backgroundColor: "#0A0A0F",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

  // Optional: open DevTools
  // mainWindow.webContents.openDevTools();
}

// ---------- Window controls ----------
ipcMain.on("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window:close", () => {
  if (mainWindow) mainWindow.close();
});

// ---------- Compress → .lft (ZIP under the hood) ----------
ipcMain.handle("lft:compress", async (_event, filePayloads) => {
  // filePayloads: [{ name, buffer (ArrayBuffer / Uint8Array) }, ...]
  if (!Array.isArray(filePayloads) || filePayloads.length === 0) {
    return { canceled: true, error: "No files provided" };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Lift Archive",
    defaultPath: `archive-${Date.now()}.lft`,
    filters: [{ name: "Lift Archive", extensions: ["lft"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  try {
    const zip = new JSZip();

    for (const f of filePayloads) {
      const data = Buffer.from(f.buffer);
      zip.file(f.name, data);
    }

    const zipContent = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // Wrap ZIP in custom LFT container (magic header + payload)
    const content = wrapLft(zipContent);

    fs.writeFileSync(result.filePath, content);

    const stats = fs.statSync(result.filePath);

    // Return the archive bytes so the renderer can extract immediately
    // without re-adding the file from disk.
    return {
      canceled: false,
      outPath: result.filePath,
      name: path.basename(result.filePath),
      size: stats.size,
      buffer: content  // Node Buffer – structured-cloneable over IPC
    };
  } catch (err) {
    return { canceled: true, error: err.message || String(err) };
  }
});

// ---------- Extract .lft ----------
ipcMain.handle("lft:extract", async (_event, payload) => {
  // payload: { name, buffer }  (the .lft file content from the renderer)
  if (!payload || !payload.buffer) {
    return { canceled: true, error: "No archive data" };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose extraction folder",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const extractDir = result.filePaths[0];

  try {
    const data = Buffer.from(payload.buffer);
    const zipPayload = unwrapLft(data);
    const zip = await JSZip.loadAsync(zipPayload);

    const entries = [];
    const promises = [];

    zip.forEach((relPath, file) => {
      if (file.dir) return;
      promises.push(
        file.async("nodebuffer").then((buf) => {
          const target = path.join(extractDir, relPath);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, buf);
          entries.push({
            name: relPath,
            path: target,
            size: buf.length
          });
        })
      );
    });

    await Promise.all(promises);

    return {
      canceled: false,
      extractDir,
      entries
    };
  } catch (err) {
    return { canceled: true, error: err.message || String(err) };
  }
});

// ---------- Inspect .lft contents (no disk write) ----------
ipcMain.handle("lft:inspect", async (_event, payload) => {
  if (!payload || !payload.buffer) {
    return { error: "No archive data" };
  }

  try {
    const data = Buffer.from(payload.buffer);
    const zipPayload = unwrapLft(data);
    const zip = await JSZip.loadAsync(zipPayload);

    const files = [];
    zip.forEach((relPath, file) => {
      if (file.dir) return;
      files.push({
        name: relPath,
        // size is not immediately available without reading; leave null
        compressedSize: file._data ? file._data.compressedSize : null
      });
    });

    return { files };
  } catch (err) {
    return { error: err.message || String(err) };
  }
});

// ---------- App lifecycle ----------
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
