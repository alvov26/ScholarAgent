const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("scholarAgent", {});
