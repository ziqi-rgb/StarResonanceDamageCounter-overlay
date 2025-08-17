// main.js - 最终版
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

// --- 全局状态变量 ---
const teamMembers = new Set();
let openPanels = {
    settings: null,
    theme: null,
    teamStats: null,
    skillDetails: null,
};
let lastKnownData = null;
let mainWindowTargetUid = null;

// --- 核心功能函数 ---

/**
 * 广播最新的团队数据给团队统计窗口
 */
function broadcastTeamData() {
    if (openPanels.teamStats && !openPanels.teamStats.isDestroyed() && lastKnownData) {
        const fullTeam = new Set(teamMembers);
        if (mainWindowTargetUid) {
            fullTeam.add(mainWindowTargetUid.toString());
        }
        openPanels.teamStats.webContents.send('team-data-update', {
            teamMembers: Array.from(fullTeam),
            users: lastKnownData.user,
        });
    }
}

/**
 * 创建一个新的追踪窗口
 * @param {string} uid - 要追踪的角色UID
 */
function createTrackingWindow(uid) {
    const win = new BrowserWindow({
        width: 250, height: 300, minWidth: 150, minHeight: 50,
        frame: false, transparent: true,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js'), }
    });
    win.loadFile(path.join(__dirname, 'index.html'), { query: { uid: uid } });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const uidStr = uid.toString();
    teamMembers.add(uidStr);
    win.on('closed', () => {
        teamMembers.delete(uidStr);
        broadcastTeamData();
    });
    broadcastTeamData();
}

/**
 * 创建主控制窗口
 * @param {object} options - 创建选项，如 { targetUid: '...' }
 */
function createMainWindow(options = {}) {
    const win = new BrowserWindow({
        width: 250, height: 300, minWidth: 150, minHeight: 50,
        frame: false, transparent: true,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js'), }
    });
    win.loadFile(path.join(__dirname, 'index.html'), {
        query: {
            uid: 'main',
            target: options.targetUid || ''
        }
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.on('closed', () => {
        mainWindowTargetUid = null;
        broadcastTeamData();
    });
}

/**
 * 创建一个通用的面板窗口（如设置、主题等）
 * @param {BrowserWindow} parentWindow - 该面板的父窗口
 * @param {string} type - 面板类型 (HTML和JS文件的名称)
 * @param {object} options - 传递给 a-loadfile 的选项
 * @returns {BrowserWindow} 创建的窗口实例
 */
function createPanelWindow(parentWindow, type, options = {}) {
    const parentBounds = parentWindow.getBounds();
    const panelWin = new BrowserWindow({
        width: 320, height: 400,
        x: parentBounds.x + parentBounds.width,
        y: parentBounds.y,
        frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    panelWin.loadFile(path.join(__dirname, `${type}.html`), options);

    parentWindow.once('closed', () => {
        if (panelWin && !panelWin.isDestroyed()) panelWin.close();
    });
    return panelWin;
}


// --- Electron App 生命周期 ---

app.whenReady().then(async () => {
    const { default: Store } = await import('electron-store');
    const store = new Store();

    // --- IPC 事件监听器 ---

    ipcMain.handle('get-favorite-uid', () => store.get('favoriteUid'));
    ipcMain.handle('toggle-favorite-uid', (event, uid) => {
        const currentFavorite = store.get('favoriteUid');
        if (currentFavorite === uid) {
            store.delete('favoriteUid');
            return null;
        } else {
            store.set('favoriteUid', uid);
            return uid;
        }
    });

    ipcMain.handle('clear-stats-data', async () => {
        try {
            await axios.get('http://localhost:8989/api/clear');
            teamMembers.clear();
            mainWindowTargetUid = null;
            setTimeout(broadcastTeamData, 200);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-main-window-target', (event, uid) => {
        const newTarget = uid ? uid.toString() : null;
        if (mainWindowTargetUid !== newTarget) {
            mainWindowTargetUid = newTarget;
            broadcastTeamData();
        }
    });

    // 窗口控制
    ipcMain.on('create-new-window', (event, uid) => createTrackingWindow(uid));
    ipcMain.on('resize-window', (e, w, h) => BrowserWindow.fromWebContents(e.sender)?.setContentSize(w, h, false));
    ipcMain.on('resize-panel', (e, w, h) => BrowserWindow.fromWebContents(e.sender)?.setContentSize(w, h, false));
    ipcMain.on('toggle-lock-state', (e, l) => BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(l, { forward: true }));
    ipcMain.on('close-window', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

    // 面板切换
    ipcMain.on('toggle-settings-window', e => { if (openPanels.settings) openPanels.settings.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.settings = createPanelWindow(p, 'settings'); openPanels.settings.on('closed', () => { openPanels.settings = null; }); } });
    ipcMain.on('toggle-theme-window', e => { if (openPanels.theme) openPanels.theme.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.theme = createPanelWindow(p, 'theme'); openPanels.theme.on('closed', () => { openPanels.theme = null; }); } });
    ipcMain.on('toggle-team-stats-window', e => { if (openPanels.teamStats) openPanels.teamStats.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.teamStats = createPanelWindow(p, 'team-stats'); openPanels.teamStats.on('closed', () => { openPanels.teamStats = null; }); broadcastTeamData(); } });
    ipcMain.on('toggle-skill-details-window', (e, u) => { if (openPanels.skillDetails) openPanels.skillDetails.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.skillDetails = createPanelWindow(p, 'skill-details', { query: { uid: u } }); openPanels.skillDetails.on('closed', () => { openPanels.skillDetails = null; }); } });

    // 数据与通知
    ipcMain.handle('fetch-skill-data', async (e, u) => { try { const r = await axios.get(`http://localhost:8989/api/skill/${u}`); return r.data; } catch (err) { return { code: 1, msg: err.message }; } });
    ipcMain.handle('fetch-data', async () => { try { const r = await axios.get('http://localhost:8989/api/data', { timeout: 900 }); lastKnownData = r.data; broadcastTeamData(); return lastKnownData; } catch (err) { return null; } });
    ipcMain.on('notify-settings-changed', () => BrowserWindow.getAllWindows().forEach(w => w.webContents.getURL().includes('index.html') && w.webContents.send('settings-updated')));
    
    // 本地昵称文件处理
    let nicknamesDir;
    if (app.isPackaged) nicknamesDir = path.join(path.dirname(app.getPath('exe')), 'nicknames');
    else nicknamesDir = path.join(process.cwd(), 'nicknames');
    if (!fs.existsSync(nicknamesDir)) fs.mkdirSync(nicknamesDir, { recursive: true });
    const nicknamesFile = path.join(nicknamesDir, 'data.json');
    ipcMain.handle('get-nicknames', async () => { try { if (fs.existsSync(nicknamesFile)) return JSON.parse(fs.readFileSync(nicknamesFile, 'utf-8')); } catch (e) {} return {}; });
    ipcMain.handle('set-nickname', async (e, u, n) => { let d = {}; try { if (fs.existsSync(nicknamesFile)) d = JSON.parse(fs.readFileSync(nicknamesFile, 'utf-8')); } catch(e) {} if (n) d[u] = n; else delete d[u]; fs.writeFileSync(nicknamesFile, JSON.stringify(d, null, 2)); return { success: true }; });

    // --- 启动流程 ---
    const favoriteUid = store.get('favoriteUid');
    createMainWindow({ targetUid: favoriteUid });
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ targetUid: store.get('favoriteUid') }); });
    globalShortcut.register('CommandOrControl+L', () => BrowserWindow.getAllWindows().forEach(w => w.webContents.send('global-toggle-lock')));
    // 新增：为清除统计数据功能添加快捷键 (Ctrl+R)
    globalShortcut.register('CommandOrControl+R', () => {
        const mainWindow = BrowserWindow.getAllWindows().find(win => {
            const url = win.webContents.getURL();
            return url.includes('index.html') && url.includes('uid=main');
        });
        if (mainWindow) {
            mainWindow.webContents.send('global-clear-stats-request');
        }
    });
    app.on('will-quit', () => globalShortcut.unregisterAll());
});


app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
