// Oracle Time Tracker - Preload Script
// Context bridge: exposes native APIs to renderer securely
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Screenshots - capture screen silently via desktopCapturer
    captureScreen: (quality) => ipcRenderer.invoke('screenshot:capture', quality),

    // Activity tracking - global keyboard/mouse hooks via uiohook-napi
    startActivityTracking: () => ipcRenderer.invoke('activity:start'),
    stopActivityTracking: () => ipcRenderer.invoke('activity:stop'),
    getActivityCounts: () => ipcRenderer.invoke('activity:get-counts'),

    // System tray - update tray tooltip and menu
    updateTrayState: (state) => ipcRenderer.send('tray:update-state', state),

    // OAuth - open auth window and return tokens
    openOAuth: (url) => ipcRenderer.invoke('auth:open-oauth', url),

    // Flag to detect Electron environment
    isElectron: true
});
