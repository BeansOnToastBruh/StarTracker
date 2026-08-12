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
  downloadAndInstallUpdate: (payload) =>
    ipcRenderer.invoke("download-and-install-update", payload),
  openUpdateUrl: (url) => ipcRenderer.invoke("open-update-url", url),
  onUpdateDownloadProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("update-download-progress", handler);
    return () => ipcRenderer.removeListener("update-download-progress", handler);
  },
  starStringsStatus: (opts) => ipcRenderer.invoke("star-strings-status", opts || {}),
  starStringsInstall: () => ipcRenderer.invoke("star-strings-install"),
  starStringsUninstall: () => ipcRenderer.invoke("star-strings-uninstall"),
  onStarStringsProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("star-strings-progress", handler);
    return () => ipcRenderer.removeListener("star-strings-progress", handler);
  },
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
  catalogQueryPlaces: (options) =>
    ipcRenderer.invoke("catalog-query-places", options),
  catalogItemDetail: (key) => ipcRenderer.invoke("catalog-item-detail", key),
  catalogShopDetail: (key) => ipcRenderer.invoke("catalog-shop-detail", key),
  catalogPlaceDetail: (key) => ipcRenderer.invoke("catalog-place-detail", key),
  catalogRefresh: () => ipcRenderer.invoke("catalog-refresh"),
  onCatalogSync: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("catalog-sync", handler);
    return () => ipcRenderer.removeListener("catalog-sync", handler);
  },
  guidesGetPatchNotes: (force) => ipcRenderer.invoke("guides-get-patch-notes", !!force),
  guidesRefreshPatchNotes: () => ipcRenderer.invoke("guides-refresh-patch-notes"),
  guidesGetCommodities: (options) =>
    ipcRenderer.invoke("guides-get-commodities", options),
  guidesGetCommodityDetail: (commodityId) =>
    ipcRenderer.invoke("guides-get-commodity-detail", commodityId),
  guidesGetSmugglerRoutes: () => ipcRenderer.invoke("guides-get-smuggler-routes"),
  guidesGetExecHangar: () => ipcRenderer.invoke("guides-get-exec-hangar"),
  guidesRefreshExecHangar: () => ipcRenderer.invoke("guides-refresh-exec-hangar"),
  guidesSetExecHangarOffset: (offsetMs) =>
    ipcRenderer.invoke("guides-set-exec-hangar-offset", offsetMs),
  guidesGetGameLoops: () => ipcRenderer.invoke("guides-get-game-loops"),
  guidesRefreshCommodities: () => ipcRenderer.invoke("guides-refresh-commodities"),
  guidesGetRefinery: () => ipcRenderer.invoke("guides-get-refinery"),
  guidesCalculateRefinery: (options) =>
    ipcRenderer.invoke("guides-calculate-refinery", options),
  craftingSearchBlueprints: (options) =>
    ipcRenderer.invoke("crafting-search-blueprints", options),
  craftingGetBlueprint: (id) => ipcRenderer.invoke("crafting-get-blueprint", id),
  craftingCalculatePreview: (options) =>
    ipcRenderer.invoke("crafting-calculate-preview", options),
  uiGetFavoriteTabs: () => ipcRenderer.invoke("ui-get-favorite-tabs"),
  uiToggleFavoriteTab: (tabId) => ipcRenderer.invoke("ui-toggle-favorite-tab", tabId),
  uiGetShipFavorites: () => ipcRenderer.invoke("ui-get-ship-favorites"),
  uiToggleShipFavorite: (payload) => ipcRenderer.invoke("ui-toggle-ship-favorite", payload),
  guidesRefreshSmugglerRoutes: () => ipcRenderer.invoke("guides-refresh-smuggler-routes"),
  combatGetItemProfile: (options) =>
    ipcRenderer.invoke("combat-get-item-profile", options),
  combatGetVehicleProfile: (options) =>
    ipcRenderer.invoke("combat-get-vehicle-profile", options),
  combatGetLoadoutSummary: (items) =>
    ipcRenderer.invoke("combat-get-loadout-summary", items),
  combatGetExternalTools: () => ipcRenderer.invoke("combat-get-external-tools"),
  combatSearch: (options) => ipcRenderer.invoke("combat-search", options),
  fleetCompareQuery: (options) => ipcRenderer.invoke("fleet-compare-query", options),
  fleetCompareRefresh: () => ipcRenderer.invoke("fleet-compare-refresh"),
  fleetGetIndex: (options) => ipcRenderer.invoke("fleet-get-index", options),
  fleetSearchVehicles: (query) => ipcRenderer.invoke("fleet-search-vehicles", query),
  loadoutGetBlueprint: (slug) => ipcRenderer.invoke("loadout-get-blueprint", slug),
  loadoutAwaitSlotOptions: (slug) => ipcRenderer.invoke("loadout-await-slot-options", slug),
  loadoutSearchWeapons: (options) =>
    ipcRenderer.invoke("loadout-search-weapons", options),
  loadoutSimulate: (options) => ipcRenderer.invoke("loadout-simulate", options),
  guidesGetTradeRoutes: (options) =>
    ipcRenderer.invoke("guides-get-trade-routes", options),
  guidesGetTradeRoutesTerminal: (options) =>
    ipcRenderer.invoke("guides-get-trade-routes-terminal", options),
  guidesGetTradeRouteDetail: (options) =>
    ipcRenderer.invoke("guides-get-trade-route-detail", options),
  guidesGetTradePresets: () => ipcRenderer.invoke("guides-get-trade-presets"),
  guidesGetExternalToolsHub: () =>
    ipcRenderer.invoke("guides-get-external-tools-hub"),
  referenceBuildLinks: (options) => ipcRenderer.invoke("reference-build-links", options),
  starmapLookupLocation: (name) => ipcRenderer.invoke("starmap-lookup-location", name),
  starmapListSystems: () => ipcRenderer.invoke("starmap-list-systems"),
  guidesGetReputation: () => ipcRenderer.invoke("guides-get-reputation"),
  wikeloGetTrades: (options) => ipcRenderer.invoke("wikelo-get-trades", options),
  wikeloRefreshTrades: () => ipcRenderer.invoke("wikelo-refresh-trades"),
});
