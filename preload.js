// preload.js - 最终版
const { contextBridge, ipcRenderer } = require('electron');

/**
 * 在主世界（渲染进程）中安全地暴露 NodeJS / Electron API
 * 这是渲染器进程与主进程通信的唯一桥梁
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
    resizePanel: (width, height) => ipcRenderer.send('resize-panel', width, height),
    closeWindow: () => ipcRenderer.send('close-window'),
    createNewWindow: (uid) => ipcRenderer.send('create-new-window', uid),

    // 状态切换
    toggleLockState: (isLocked) => ipcRenderer.send('toggle-lock-state', isLocked),
    onGlobalToggleLock: (callback) => ipcRenderer.on('global-toggle-lock', callback),
    
    // 数据请求
    fetchData: () => ipcRenderer.invoke('fetch-data'),
    fetchSkillData: (uid) => ipcRenderer.invoke('fetch-skill-data', uid),
    clearStatsData: () => ipcRenderer.invoke('clear-stats-data'),
    // 新增：监听从主进程发来的全局清除统计数据请求
    onGlobalClearStatsRequest: (callback) => ipcRenderer.on('global-clear-stats-request', callback),
    
    // 本地存储 (昵称 & 收藏)
    getNicknames: () => ipcRenderer.invoke('get-nicknames'),
    setNickname: (uid, nickname) => ipcRenderer.invoke('set-nickname', uid, nickname),
    getFavoriteUid: () => ipcRenderer.invoke('get-favorite-uid'),
    toggleFavoriteUid: (uid) => ipcRenderer.invoke('toggle-favorite-uid', uid),

    // 面板窗口切换
    toggleSettingsWindow: () => ipcRenderer.send('toggle-settings-window'),
    toggleThemeWindow: () => ipcRenderer.send('toggle-theme-window'),
    toggleTeamStatsWindow: () => ipcRenderer.send('toggle-team-stats-window'),
    toggleSkillDetailsWindow: (uid) => ipcRenderer.send('toggle-skill-details-window', uid),

    // 跨窗口通信
    updateMainWindowTarget: (uid) => ipcRenderer.send('update-main-window-target', uid),
    onTeamDataUpdate: (callback) => ipcRenderer.on('team-data-update', (event, data) => callback(data)),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback),
    notifySettingsChanged: () => ipcRenderer.send('notify-settings-changed'),
    
});
