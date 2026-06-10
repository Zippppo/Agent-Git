import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNextZoomFactor, getZoomShortcut } from "./zoom-shortcuts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function registerZoomShortcuts(mainWindow) {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const shortcut = getZoomShortcut(input);
    if (!shortcut) return;

    event.preventDefault();
    const current = mainWindow.webContents.getZoomFactor();
    mainWindow.webContents.setZoomFactor(getNextZoomFactor(current, shortcut));
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "Agent-Git",
    backgroundColor: "#f6f7f8",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  registerZoomShortcuts(mainWindow);

  return mainWindow;
}

function getAttachmentsDir() {
  return path.join(app.getPath("userData"), "attachments");
}

function isInsideAttachmentsDir(candidatePath) {
  if (!candidatePath) return false;
  const resolvedBase = path.resolve(getAttachmentsDir());
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function extensionForMime(mimeType) {
  const normalized = (mimeType || "").toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "image/bmp") return ".bmp";
  return ".png";
}

function mimeForExtension(filePath) {
  const extension = path.extname(filePath || "").toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".bmp") return "image/bmp";
  return "image/png";
}

async function writeAttachmentImage(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Invalid image data.");
  }
  const attachmentsDir = getAttachmentsDir();
  await fs.mkdir(attachmentsDir, { recursive: true });
  const extension = extensionForMime(parsed.mimeType);
  const fileName = `image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const filePath = path.join(attachmentsDir, fileName);
  await fs.writeFile(filePath, parsed.buffer);
  return { filePath, fileName, mimeType: parsed.mimeType };
}

function registerAttachmentIpc() {
  ipcMain.handle("attachments:save-image", async (_event, input) => {
    const saved = await writeAttachmentImage(input?.dataUrl);
    return { ok: true, ...saved };
  });

  ipcMain.handle("attachments:read-image", async (_event, input) => {
    const filePath = input?.filePath;
    if (!isInsideAttachmentsDir(filePath)) {
      return { ok: false, error: "Attachment path is not allowed." };
    }
    const buffer = await fs.readFile(filePath);
    const mimeType = mimeForExtension(filePath);
    return {
      ok: true,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`
    };
  });

  ipcMain.handle("attachments:open-image", async (_event, input) => {
    let filePath = input?.filePath;
    if (filePath && !isInsideAttachmentsDir(filePath)) {
      return { ok: false, error: "Attachment path is not allowed." };
    }
    if (!filePath && input?.dataUrl) {
      const saved = await writeAttachmentImage(input.dataUrl);
      filePath = saved.filePath;
    }
    if (!filePath) {
      return { ok: false, error: "No image file to open." };
    }
    const error = await shell.openPath(filePath);
    return error ? { ok: false, error } : { ok: true };
  });
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerAttachmentIpc();
  createMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
