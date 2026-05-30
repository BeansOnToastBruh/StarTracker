const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("debrief", {
  getState: () => ipcRenderer.invoke("get-state"),
  startSession: () => ipcRenderer.invoke("start-session"),
  endSession: () => ipcRenderer.invoke("end-session"),
  setAutoTrack: (v) => ipcRenderer.invoke("set-auto-track", v),
  openLog: () => ipcRenderer.invoke("open-log"),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  openUpdateUrl: (url) => ipcRenderer.invoke("open-update-url", url),
  onState: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("state", handler);
    return () => ipcRenderer.removeListener("state", handler);
  },
  onError: (cb) => {
    const handler = (_, msg) => cb(msg);
    ipcRenderer.on("error", handler);
    return () => ipcRenderer.removeListener("error", handler);
  },
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },
});
