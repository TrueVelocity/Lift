// preload.js – secure bridge between renderer and main process
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),

  /** Compress an array of { name, buffer } into a .lft on disk */
  compressLft: (files) => ipcRenderer.invoke("lft:compress", files),

  /** Extract a .lft (payload: { name, buffer }) to a chosen folder */
  extractLft: (payload) => ipcRenderer.invoke("lft:extract", payload),

  /** Inspect .lft contents without writing to disk */
  inspectLft: (payload) => ipcRenderer.invoke("lft:inspect", payload)
});
