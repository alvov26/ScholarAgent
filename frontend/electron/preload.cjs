const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scholarAgent", {
  // Find-in-page API
  findInPage: (text, options) => ipcRenderer.send("find-in-page", text, options),
  stopFindInPage: (action) => ipcRenderer.send("stop-find-in-page", action),
  onFindResult: (callback) => {
    ipcRenderer.on("find-in-page-result", (event, result) => callback(result));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners("find-in-page-result");
  },
});
