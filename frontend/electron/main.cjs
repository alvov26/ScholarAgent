const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0b0b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadURL(FRONTEND_URL);

  // Handle find-in-page IPC messages
  ipcMain.on("find-in-page", (event, text, options) => {
    if (text) {
      win.webContents.findInPage(text, options);
    }
  });

  ipcMain.on("stop-find-in-page", (event, action) => {
    win.webContents.stopFindInPage(action || "clearSelection");
  });

  // Send find results back to renderer
  win.webContents.on("found-in-page", (event, result) => {
    win.webContents.send("find-in-page-result", result);
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
