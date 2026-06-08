const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("debrief", {
  getState: () => ipcRenderer.invoke("get-state"),
  startSession: () => ipcRenderer.invoke("start-session"),
  endSession: () => ipcRenderer.invoke("end-session"),
  setAutoTrack: (v) => ipcRenderer.invoke("set-auto-track", v),
  openLog: () => ipcRenderer.invoke("open-log"),
  browseLogFile: () => ipcRenderer.invoke("browse-log-file"),
  setLogPath: (opts) => ipcRenderer.invoke("set-log-path", opts),
  onFocusLogPath: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("focus-log-path", handler);
    return () => ipcRenderer.removeListener("focus-log-path", handler);
  },
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  openUpdateUrl: (url) => ipcRenderer.invoke("open-update-url", url),
  listLogArchives: () => ipcRenderer.invoke("list-log-archives"),
  parseLogArchive: (id) => ipcRenderer.invoke("parse-log-archive", id),
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
  catalogStats: () => ipcRenderer.invoke("catalog-stats"),
  catalogQueryVehicles: (options) =>
    ipcRenderer.invoke("catalog-query-vehicles", options),
  catalogQueryItems: (options) =>
    ipcRenderer.invoke("catalog-query-items", options),
  catalogQueryShops: (options) =>
    ipcRenderer.invoke("catalog-query-shops", options),
  catalogItemDetail: (key) => ipcRenderer.invoke("catalog-item-detail", key),
  catalogShopDetail: (key) => ipcRenderer.invoke("catalog-shop-detail", key),
  catalogRefresh: () => ipcRenderer.invoke("catalog-refresh"),
  onCatalogSync: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("catalog-sync", handler);
    return () => ipcRenderer.removeListener("catalog-sync", handler);
  },
});
