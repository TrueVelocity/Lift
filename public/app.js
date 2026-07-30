// icon: path.join(__dirname, 'public/LFT-logo.ico'),
// app.js – Main application logic for Lift (LFT Archive Manager)

// ===== STATE =====
let files = [];
let selectedIds = new Set();
let recentActivity = []; // { id, type, title, detail, time }
let archiveRecords = []; // { id, name, size, sizeBytes, path, time, content }
let currentPage = "dashboard";
let currentRenameId = null;
let currentInspectorId = null;
let toastTimeout = null;
let contextMenuEl = null;

// ===== DOM =====
const fileGridEl = document.getElementById("file-grid");
const emptyStateEl = document.getElementById("empty-state");
const selectionPanelEl = document.getElementById("selection-panel");
const selectionListEl = document.getElementById("selection-list");
const selectionCountEl = document.getElementById("selection-count");
const dropzoneOverlayEl = document.getElementById("dropzone-overlay");
const searchInputEl = document.getElementById("search-input");
const sortSelectEl = document.getElementById("sort-select");
const addFilesBtn = document.getElementById("add-files-btn");
const compressBtn = document.getElementById("compress-btn");
const extractBtn = document.getElementById("extract-btn");
const compressSelectedBtn = document.getElementById("compress-selected-btn");
const extractSelectedBtn = document.getElementById("extract-selected-btn");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsDropdownEl = document.getElementById("settings-dropdown");
const bgPresetsEl = document.getElementById("bg-presets");
const customBgPickerEl = document.getElementById("custom-bg-picker");
const customBgPreviewEl = document.getElementById("custom-bg-preview");
const errorModalEl = document.getElementById("error-modal");
const errorMessageEl = document.getElementById("error-message");
const errorCloseEl = document.getElementById("error-close");
const errorGotItEl = document.getElementById("error-gotit");
const renameModalEl = document.getElementById("rename-modal");
const renameInputEl = document.getElementById("rename-input");
const renameCloseEl = document.getElementById("rename-close");
const renameConfirmEl = document.getElementById("rename-confirm");
const renameCancelEl = document.getElementById("rename-cancel");
const toastEl = document.getElementById("toast");
const toastTitleEl = document.getElementById("toast-title");
const toastDescEl = document.getElementById("toast-desc");
const inspectorPanelEl = document.getElementById("inspector-panel");
const inspectorContentEl = document.getElementById("inspector-content");
const inspectorCloseBtn = document.getElementById("inspector-close");
const minBtn = document.getElementById("min-btn");
const closeBtn = document.getElementById("close-btn");
const sidebarButtons = document.querySelectorAll(".sidebar-item");

const pages = {
  dashboard: document.getElementById("page-dashboard"),
  recent: document.getElementById("page-recent"),
  archives: document.getElementById("page-archives"),
  settings: document.getElementById("page-settings")
};

// ===== BACKGROUND PRESETS =====
const BG_PRESETS = [
  { name: "Midnight", value: "#0A0A0F" },
  { name: "Deep Space", value: "#0D0D1A" },
  { name: "Charcoal", value: "#1A1A1A" },
  { name: "Dark Purple", value: "#12001F" },
  { name: "Indigo", value: "#1A1035" },
  { name: "Slate", value: "#111827" }
];

// ===== HELPERS =====
function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = Number(bytes);
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return n.toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

function showToast(title, desc) {
  toastTitleEl.textContent = title;
  toastDescEl.textContent = desc || "";
  toastEl.classList.add("visible");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function () {
    toastEl.classList.remove("visible");
  }, 2800);
}

function showError(message) {
  errorMessageEl.textContent = message || "Something went wrong.";
  errorModalEl.classList.add("visible");
}

function hideError() {
  errorModalEl.classList.remove("visible");
}

function updateBackground(color) {
  document.body.style.background = color;
  if (customBgPreviewEl) customBgPreviewEl.style.background = color;
}

function getExtension(name) {
  if (!name || !name.includes(".")) return "";
  return name.split(".").pop().toLowerCase();
}

function readFileAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error || new Error("Read failed")); };
    reader.readAsArrayBuffer(file);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathBasename(p) {
  if (!p) return "archive.lft";
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "archive.lft";
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch (e) {
    return "";
  }
}

function pushRecent(type, title, detail) {
  recentActivity.unshift({
    id: crypto.randomUUID(),
    type: type,
    title: title,
    detail: detail || "",
    time: Date.now()
  });
  if (recentActivity.length > 50) recentActivity.length = 50;
  renderRecent();
}

function renderRecent() {
  var listEl = document.getElementById("recent-list");
  var emptyEl = document.getElementById("recent-empty");
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";
  if (recentActivity.length === 0) {
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";

  recentActivity.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "activity-row";

    var badge = document.createElement("div");
    badge.className = "activity-badge " + (item.type === "extract" ? "extract" : "compress");
    badge.textContent = item.type === "extract" ? "Extract" : "Compress";

    var body = document.createElement("div");
    body.className = "activity-body";

    var title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = item.title;

    var detail = document.createElement("div");
    detail.className = "activity-detail";
    detail.textContent = item.detail;

    var time = document.createElement("div");
    time.className = "activity-time";
    time.textContent = formatTime(item.time);

    body.appendChild(title);
    body.appendChild(detail);
    row.appendChild(badge);
    row.appendChild(body);
    row.appendChild(time);
    listEl.appendChild(row);
  });
}

function renderArchives() {
  var listEl = document.getElementById("archives-list");
  var emptyEl = document.getElementById("archives-empty");
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";
  if (archiveRecords.length === 0) {
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";

  archiveRecords.forEach(function (rec) {
    var row = document.createElement("div");
    row.className = "activity-row archive-row";

    var icon = document.createElement("div");
    icon.className = "activity-file-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

    var body = document.createElement("div");
    body.className = "activity-body";

    var title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = rec.name;

    var detail = document.createElement("div");
    detail.className = "activity-detail";
    detail.textContent = (rec.size || "") + (rec.path ? " · " + rec.path : "");

    var time = document.createElement("div");
    time.className = "activity-time";
    time.textContent = formatTime(rec.time);

    var actions = document.createElement("div");
    actions.className = "activity-actions";

    var openBtn = document.createElement("button");
    openBtn.className = "btn btn-ghost btn-sm";
    openBtn.textContent = "Show in files";
    openBtn.addEventListener("click", function () {
      // Ensure archive exists in main file grid
      var existing = files.find(function (f) { return f.id === rec.fileId; });
      if (!existing && rec.content) {
        var id = crypto.randomUUID();
        files.push({
          id: id,
          name: rec.name,
          extension: "lft",
          size: rec.size,
          sizeBytes: rec.sizeBytes,
          file: null,
          content: rec.content,
          path: rec.path
        });
        rec.fileId = id;
        renderFiles();
      }
      showPage("dashboard");
      showToast("Archives", rec.name + " is in Your Files");
    });

    actions.appendChild(openBtn);
    body.appendChild(title);
    body.appendChild(detail);
    row.appendChild(icon);
    row.appendChild(body);
    row.appendChild(time);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

function recordArchive(entry) {
  archiveRecords.unshift({
    id: crypto.randomUUID(),
    fileId: entry.id || null,
    name: entry.name,
    size: entry.size,
    sizeBytes: entry.sizeBytes,
    path: entry.path || "",
    content: entry.content || null,
    time: Date.now()
  });
  renderArchives();
}


// ===== RENDERING =====
function renderFiles() {
  fileGridEl.innerHTML = "";

  const query = (searchInputEl.value || "").toLowerCase().trim();
  const sortBy = sortSelectEl.value;

  let visible = files.slice();

  if (query) {
    visible = visible.filter(function (f) {
      return f.name.toLowerCase().includes(query);
    });
  }

  visible.sort(function (a, b) {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "size") return (a.sizeBytes || 0) - (b.sizeBytes || 0);
    if (sortBy === "type") return (a.extension || "").localeCompare(b.extension || "");
    return 0;
  });

  if (visible.length === 0) {
    emptyStateEl.classList.add("visible");
  } else {
    emptyStateEl.classList.remove("visible");
  }

  visible.forEach(function (file) {
    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.id = file.id;
    if (selectedIds.has(file.id)) card.classList.add("selected");

    card.addEventListener("click", function (e) {
      if (e.target.closest(".file-action-btn")) return;
      toggleSelection(file.id);
    });

    card.addEventListener("dblclick", function () {
      if ((file.extension || "").toLowerCase() === "lft") {
        openInspector(file);
      }
    });

    card.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, file);
    });

    const check = document.createElement("div");
    check.className = "file-card-check";
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
    card.appendChild(check);

    const iconWrap = document.createElement("div");
    iconWrap.className = "file-icon-wrap";
    if ((file.extension || "").toLowerCase() === "lft") iconWrap.classList.add("lft");
    iconWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    card.appendChild(iconWrap);

    const info = document.createElement("div");
    info.className = "file-info";

    const nameEl = document.createElement("div");
    nameEl.className = "file-name";
    nameEl.textContent = file.name;
    nameEl.title = file.name;

    const sizeEl = document.createElement("div");
    sizeEl.className = "file-size";
    sizeEl.textContent = file.size || formatBytes(file.sizeBytes);

    info.appendChild(nameEl);
    info.appendChild(sizeEl);
    card.appendChild(info);

    fileGridEl.appendChild(card);
  });

  renderSelectionPanel();
}

function renderSelectionPanel() {
  const count = selectedIds.size;
  if (count === 0) {
    selectionPanelEl.classList.remove("visible");
    selectionCountEl.textContent = "0 items";
    selectionListEl.innerHTML = "";
    return;
  }

  selectionPanelEl.classList.add("visible");
  selectionCountEl.textContent = count + " item" + (count === 1 ? "" : "s");
  selectionListEl.innerHTML = "";

  files
    .filter(function (f) { return selectedIds.has(f.id); })
    .forEach(function (file) {
      const chip = document.createElement("div");
      chip.className = "selection-chip checked";
      chip.addEventListener("click", function () { toggleSelection(file.id); });

      const check = document.createElement("div");
      check.className = "selection-check";
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
      chip.appendChild(check);

      const typeIcon = document.createElement("div");
      typeIcon.className = "file-type-icon";
      if ((file.extension || "").toLowerCase() === "lft") typeIcon.classList.add("lft");
      typeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
      chip.appendChild(typeIcon);

      const nameEl = document.createElement("div");
      nameEl.className = "selection-chip-name";
      nameEl.textContent = file.name;
      nameEl.title = file.name;
      chip.appendChild(nameEl);

      selectionListEl.appendChild(chip);
    });
}

// ===== SELECTION =====
function toggleSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderFiles();
}

// ===== CONTEXT MENU =====
function openContextMenu(x, y, file) {
  closeContextMenu();

  contextMenuEl = document.createElement("div");
  contextMenuEl.className = "context-menu visible";

  const name = document.createElement("div");
  name.className = "context-file-name";
  name.textContent = file.name;
  contextMenuEl.appendChild(name);

  const renameBtn = document.createElement("button");
  renameBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z"/></svg><span>Rename</span>';
  renameBtn.addEventListener("click", function () {
    showRenameModal(file.id);
    closeContextMenu();
  });
  contextMenuEl.appendChild(renameBtn);

  if ((file.extension || "").toLowerCase() === "lft") {
    const inspectBtn = document.createElement("button");
    inspectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span>Inspect</span>';
    inspectBtn.addEventListener("click", function () {
      openInspector(file);
      closeContextMenu();
    });
    contextMenuEl.appendChild(inspectBtn);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "danger";
  deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 6l1 14h12l1-14"/></svg><span>Delete</span>';
  deleteBtn.addEventListener("click", function () {
    files = files.filter(function (f) { return f.id !== file.id; });
    selectedIds.delete(file.id);
    if (currentInspectorId === file.id) closeInspector();
    renderFiles();
    showToast("Deleted", file.name);
    closeContextMenu();
  });
  contextMenuEl.appendChild(deleteBtn);

  contextMenuEl.style.left = Math.min(x, window.innerWidth - 200) + "px";
  contextMenuEl.style.top = Math.min(y, window.innerHeight - 160) + "px";
  document.body.appendChild(contextMenuEl);
}

function closeContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
}

document.addEventListener("click", function () { closeContextMenu(); });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeContextMenu();
    hideError();
    hideRenameModal();
    closeInspector();
  }
});

// ===== FILE ADDING =====
async function handleAddedFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const list = Array.from(fileList);
  let added = 0;

  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    try {
      const buffer = await readFileAsArrayBuffer(f);
      const id = crypto.randomUUID();
      const ext = getExtension(f.name);

      files.push({
        id: id,
        name: f.name,
        extension: ext,
        size: formatBytes(f.size),
        sizeBytes: f.size,
        file: f,
        content: buffer
      });
      added++;
    } catch (err) {
      console.error("Failed to read file", f.name, err);
    }
  }

  renderFiles();
  if (added > 0) {
    showToast("Files Added", added + " file" + (added === 1 ? "" : "s") + " added");
  }
}

addFilesBtn.addEventListener("click", function () {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = function () { handleAddedFiles(input.files); };
  input.click();
});

// Drag & drop
document.addEventListener("dragenter", function (e) {
  e.preventDefault();
  dropzoneOverlayEl.classList.add("visible");
});
document.addEventListener("dragover", function (e) { e.preventDefault(); });
document.addEventListener("dragleave", function (e) {
  if (!e.relatedTarget || !dropzoneOverlayEl.contains(e.relatedTarget)) {
    dropzoneOverlayEl.classList.remove("visible");
  }
});
document.addEventListener("drop", function (e) {
  e.preventDefault();
  dropzoneOverlayEl.classList.remove("visible");
  handleAddedFiles(e.dataTransfer.files);
});

// ===== INSPECTOR =====
async function openInspector(file) {
  currentInspectorId = file.id;
  inspectorContentEl.innerHTML =
    "<div><strong>Name:</strong> " + escapeHtml(file.name) + "</div>" +
    "<div><strong>Type:</strong> " + ((file.extension || "").toUpperCase() || "—") + "</div>" +
    "<div><strong>Size:</strong> " + (file.size || formatBytes(file.sizeBytes)) + "</div>" +
    '<div style="margin-top:12px;color:var(--w40);font-size:12px;">Loading archive contents…</div>';
  inspectorPanelEl.classList.add("open");

  if ((file.extension || "").toLowerCase() !== "lft" || !file.content) {
    return;
  }

  if (!window.electronAPI || !window.electronAPI.inspectLft) {
    inspectorContentEl.innerHTML +=
      '<div style="margin-top:12px;color:var(--w40);font-size:12px;">(Run inside Electron to inspect .lft contents)</div>';
    return;
  }

  try {
    const result = await window.electronAPI.inspectLft({
      name: file.name,
      buffer: file.content
    });

    if (result.error) {
      inspectorContentEl.innerHTML =
        "<div><strong>Name:</strong> " + escapeHtml(file.name) + "</div>" +
        '<div style="color:#f87171;margin-top:8px;">' + escapeHtml(result.error) + "</div>";
      return;
    }

    const fileList = result.files || [];
    let rows = "";
    for (let i = 0; i < fileList.length; i++) {
      rows += '<div class="inspector-file-row"><span>' + escapeHtml(fileList[i].name) + "</span></div>";
    }

    inspectorContentEl.innerHTML =
      "<div><strong>Name:</strong> " + escapeHtml(file.name) + "</div>" +
      "<div><strong>Type:</strong> LFT</div>" +
      "<div><strong>Size:</strong> " + (file.size || formatBytes(file.sizeBytes)) + "</div>" +
      '<div style="margin-top:14px;font-size:12px;color:var(--w50);">' +
      fileList.length + " file(s) inside</div>" +
      '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">' +
      (rows || '<div style="color:var(--w40);">Empty archive</div>') +
      "</div>";
  } catch (err) {
    inspectorContentEl.innerHTML =
      "<div><strong>Name:</strong> " + escapeHtml(file.name) + "</div>" +
      '<div style="color:#f87171;margin-top:8px;">Failed to inspect archive</div>';
  }
}

function closeInspector() {
  inspectorPanelEl.classList.remove("open");
  currentInspectorId = null;
}

if (inspectorCloseBtn) {
  inspectorCloseBtn.addEventListener("click", closeInspector);
}

// ===== SETTINGS =====
settingsBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  settingsDropdownEl.classList.toggle("visible");
});

document.addEventListener("click", function (e) {
  if (
    !settingsDropdownEl.contains(e.target) &&
    !settingsBtn.contains(e.target)
  ) {
    settingsDropdownEl.classList.remove("visible");
  }
});

BG_PRESETS.forEach(function (preset) {
  const div = document.createElement("div");
  div.className = "bg-preset";
  div.style.background = preset.value;
  div.title = preset.name;
  div.addEventListener("click", function () {
    updateBackground(preset.value);
    document.querySelectorAll(".bg-preset").forEach(function (el) {
      el.classList.remove("active");
    });
    div.classList.add("active");
  });
  bgPresetsEl.appendChild(div);
});

if (bgPresetsEl.firstChild) bgPresetsEl.firstChild.classList.add("active");

customBgPickerEl.addEventListener("input", function (e) {
  updateBackground(e.target.value);
  document.querySelectorAll(".bg-preset").forEach(function (el) {
    el.classList.remove("active");
  });
});

// ===== ERROR / RENAME MODALS =====
errorCloseEl.addEventListener("click", hideError);
errorGotItEl.addEventListener("click", hideError);

function showRenameModal(fileId) {
  currentRenameId = fileId;
  const file = files.find(function (f) { return f.id === fileId; });
  renameInputEl.value = file ? file.name : "";
  renameModalEl.classList.add("visible");
  renameInputEl.focus();
  renameInputEl.select();
}

function hideRenameModal() {
  currentRenameId = null;
  renameModalEl.classList.remove("visible");
}

renameCloseEl.addEventListener("click", hideRenameModal);
renameCancelEl.addEventListener("click", hideRenameModal);

renameConfirmEl.addEventListener("click", function () {
  if (!currentRenameId) return;
  const newName = renameInputEl.value.trim();
  if (!newName) {
    showError("File name cannot be empty.");
    return;
  }
  const file = files.find(function (f) { return f.id === currentRenameId; });
  if (file) {
    file.name = newName;
    file.extension = getExtension(newName);
    renderFiles();
    showToast("Renamed", newName);
  }
  hideRenameModal();
});

renameInputEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") renameConfirmEl.click();
});

// ===== WINDOW CONTROLS =====
minBtn.addEventListener("click", function () {
  if (window.electronAPI && window.electronAPI.minimize) {
    window.electronAPI.minimize();
  } else {
    showToast("Window", "Minimize (Electron only)");
  }
});

closeBtn.addEventListener("click", function () {
  if (window.electronAPI && window.electronAPI.close) {
    window.electronAPI.close();
  } else {
    showToast("Window", "Close (Electron only)");
  }
});

// ===== COMPRESS / EXTRACT =====
function ensureDashboard() {
  showPage("dashboard");
}

async function compressSelected() {
  const selected = files.filter(function (f) { return selectedIds.has(f.id); });
  if (selected.length === 0) {
    showError("No files selected to compress.");
    return;
  }

  const missing = selected.filter(function (f) { return !f.content; });
  if (missing.length > 0) {
    showError("Some selected files have no content loaded. Re-add them and try again.");
    return;
  }

  if (!window.electronAPI || !window.electronAPI.compressLft) {
    const meta = {
      createdAt: Date.now(),
      files: selected.map(function (f) {
        return { name: f.name, size: f.sizeBytes, type: f.extension };
      })
    };
    const blob = new Blob([JSON.stringify(meta)], { type: "application/json" });
    const name = "archive-" + Date.now() + ".lft";
    const buffer = await blob.arrayBuffer();
    var newId = crypto.randomUUID();
    var newEntry = {
      id: newId,
      name: name,
      extension: "lft",
      size: formatBytes(blob.size),
      sizeBytes: blob.size,
      file: new File([blob], name, { type: "application/lft" }),
      content: buffer
    };
    files.push(newEntry);
    recordArchive(newEntry);
    pushRecent(
      "compress",
      newEntry.name,
      selected.length + " file(s) compressed (demo mode)"
    );
    selectedIds.clear();
    renderFiles();
    showToast("Archive Created", selected.length + " file(s) compressed (demo mode)");
    return;
  }

  try {
    const payloads = selected.map(function (f) {
      return { name: f.name, buffer: f.content };
    });

    const result = await window.electronAPI.compressLft(payloads);

    if (result.canceled) {
      if (result.error) showError(result.error);
      return;
    }

    // Keep archive bytes in memory so Extract works right away
    // (without forcing the user to re-add the .lft from disk).
    var archiveBuffer = null;
    if (result.buffer) {
      // IPC may deliver Node Buffer as Uint8Array or ArrayBuffer-like
      if (result.buffer instanceof ArrayBuffer) {
        archiveBuffer = result.buffer;
      } else if (result.buffer.buffer instanceof ArrayBuffer) {
        archiveBuffer = result.buffer.buffer.slice(
          result.buffer.byteOffset || 0,
          (result.buffer.byteOffset || 0) + (result.buffer.byteLength || result.buffer.length || 0)
        );
      } else {
        archiveBuffer = new Uint8Array(result.buffer).buffer;
      }
    }

    var newId = crypto.randomUUID();
    var newEntry = {
      id: newId,
      name: result.name || pathBasename(result.outPath),
      extension: "lft",
      size: formatBytes(result.size),
      sizeBytes: result.size,
      file: null,
      content: archiveBuffer,
      path: result.outPath
    };
    files.push(newEntry);
    recordArchive(newEntry);
    pushRecent(
      "compress",
      newEntry.name,
      selected.length + " file(s) → " + (result.outPath || newEntry.name)
    );

    selectedIds.clear();
    renderFiles();
    showToast("Archive Created", "Saved to " + result.outPath);
  } catch (err) {
    showError(err.message || "Compression failed.");
  }
}

async function extractSelected() {
  const selected = files.filter(function (f) { return selectedIds.has(f.id); });
  if (selected.length === 0) {
    showError("No files selected to extract.");
    return;
  }

  const nonLft = selected.filter(function (f) {
    return (f.extension || "").toLowerCase() !== "lft";
  });
  if (nonLft.length > 0) {
    showError("Only .lft archives can be extracted.");
    return;
  }

  if (!window.electronAPI || !window.electronAPI.extractLft) {
    showError("Extraction requires the Electron app.");
    return;
  }

  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    if (!f.content) {
      showError('"' + f.name + '" has no content loaded. Re-add the .lft file and try again.');
      return;
    }

    try {
      const result = await window.electronAPI.extractLft({
        name: f.name,
        buffer: f.content
      });

      if (result.canceled) {
        if (result.error) showError(result.error);
        continue;
      }

      const count = (result.entries && result.entries.length) || 0;
      pushRecent(
        "extract",
        f.name,
        count + " file(s) → " + result.extractDir
      );
      showToast("Extracted", count + " file(s) → " + result.extractDir);
    } catch (err) {
      showError(err.message || "Failed to extract " + f.name);
    }
  }

  selectedIds.clear();
  renderFiles();
}

compressBtn.addEventListener("click", function () {
  ensureDashboard();
  compressSelected();
});
extractBtn.addEventListener("click", function () {
  ensureDashboard();
  extractSelected();
});
compressSelectedBtn.addEventListener("click", compressSelected);
extractSelectedBtn.addEventListener("click", extractSelected);

clearSelectionBtn.addEventListener("click", function () {
  selectedIds.clear();
  renderFiles();
});

// ===== PAGE SWITCHING =====
function showPage(pageKey) {
  if (!pages[pageKey]) return;

  Object.keys(pages).forEach(function (k) {
    pages[k].classList.remove("visible");
  });
  pages[pageKey].classList.add("visible");
  currentPage = pageKey;

  sidebarButtons.forEach(function (btn) {
    const target = btn.getAttribute("data-page");
    if (target === pageKey) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  var titleEl = document.querySelector(".page-title");
  if (titleEl) {
    var titles = {
      dashboard: "Your Files",
      recent: "Recent",
      archives: "Archives",
      settings: "Settings"
    };
    titleEl.textContent = titles[pageKey] || "Lift";
  }

  if (pageKey === "recent") renderRecent();
  if (pageKey === "archives") renderArchives();
}

sidebarButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const pageKey = btn.getAttribute("data-page");
    showPage(pageKey);
  });
});

// ===== SEARCH / SORT =====
searchInputEl.addEventListener("input", renderFiles);
sortSelectEl.addEventListener("change", renderFiles);

// ===== INIT =====
showPage("dashboard");
updateBackground(BG_PRESETS[0].value);
renderFiles();
renderRecent();
renderArchives();
