const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

// 全局变量
const teamMembers = new Set();
let openPanels = {
    settings: null, theme: null, teamStats: null, skillDetails: null,
};
let lastKnownData = null;
let mainWindowTargetUid = null;

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

function createPanelWindow(parentWindow, type, options = {}) {
    if (openPanels[type] && !openPanels[type].isDestroyed()) {
        openPanels[type].focus(); return;
    }
    const parentBounds = parentWindow.getBounds();
    const panelWin = new BrowserWindow({
        width: 320, height: 400,
        x: parentBounds.x + parentBounds.width, y: parentBounds.y,
        frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    panelWin.loadFile(path.join(__dirname, `${type}.html`), options);
    if (openPanels.hasOwnProperty(type)) {
        openPanels[type] = panelWin;
        panelWin.on('closed', () => { openPanels[type] = null; });
    }
    parentWindow.once('closed', () => {
        if (panelWin && !panelWin.isDestroyed()) panelWin.close();
    });
    return panelWin;
}

function createMainWindow(options = {}) {
    const win = new BrowserWindow({
        width: 250, height: 300, minWidth: 150, minHeight: 50,
        frame: false, transparent: true,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js'), }
    });
    // 主窗口的uid永远是'main'，收藏的目标通过另一个参数传递
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

app.whenReady().then(async () => {
    // ========== 核心修正：使用动态 import() 加载 electron-store ==========
    const { default: Store } = await import('electron-store');
    const store = new Store();

    // --- IPC 通信监听 ---
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
    ipcMain.on('resize-window', (event, w, h) => BrowserWindow.fromWebContents(event.sender)?.setContentSize(w, h, false));
    ipcMain.on('resize-panel', (event, w, h) => BrowserWindow.fromWebContents(event.sender)?.setContentSize(w, h, false));
    ipcMain.on('toggle-lock-state', (event, l) => BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(l, { forward: true }));
    ipcMain.on('create-new-window', (event, uid) => createTrackingWindow(uid));
    ipcMain.on('close-window', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
    ipcMain.on('notify-settings-changed', () => BrowserWindow.getAllWindows().forEach(w => w.webContents.getURL().includes('index.html') && w.webContents.send('settings-updated')));
    ipcMain.on('toggle-settings-window', e => { if (openPanels.settings) openPanels.settings.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.settings = createPanelWindow(p, 'settings'); openPanels.settings.on('closed', () => { openPanels.settings = null; }); } });
    ipcMain.on('toggle-theme-window', e => { if (openPanels.theme) openPanels.theme.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.theme = createPanelWindow(p, 'theme'); openPanels.theme.on('closed', () => { openPanels.theme = null; }); } });
    ipcMain.on('toggle-team-stats-window', e => { if (openPanels.teamStats) openPanels.teamStats.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.teamStats = createPanelWindow(p, 'team-stats'); openPanels.teamStats.on('closed', () => { openPanels.teamStats = null; }); broadcastTeamData(); } });
    ipcMain.on('toggle-skill-details-window', (e, u) => { if (openPanels.skillDetails) openPanels.skillDetails.close(); else { const p = BrowserWindow.fromWebContents(e.sender); openPanels.skillDetails = createPanelWindow(p, 'skill-details', { query: { uid: u } }); openPanels.skillDetails.on('closed', () => { openPanels.skillDetails = null; }); } });

    // 数据请求
    ipcMain.handle('fetch-skill-data', async (e, u) => { try { const r = await axios.get(`http://localhost:8989/api/skill/${u}`); return r.data; } catch (err) { return { code: 1, msg: err.message }; } });
    ipcMain.handle('fetch-data', async () => { try { const r = await axios.get('http://localhost:8989/api/data', { timeout: 900 }); lastKnownData = r.data; broadcastTeamData(); return lastKnownData; } catch (err) { return null; } });
    
    // 文件处理
    let nicknamesDir;
    if (app.isPackaged) nicknamesDir = path.join(path.dirname(app.getPath('exe')), 'nicknames');
    else nicknamesDir = path.join(process.cwd(), 'nicknames');
    if (!fs.existsSync(nicknamesDir)) fs.mkdirSync(nicknamesDir, { recursive: true });
    const nicknamesFile = path.join(nicknamesDir, 'data.json');
    ipcMain.handle('get-nicknames', async () => { try { if (fs.existsSync(nicknamesFile)) return JSON.parse(fs.readFileSync(nicknamesFile, 'utf-8')); } catch (e) {} return {}; });
    ipcMain.handle('set-nickname', async (e, u, n) => { let d = {}; try { if (fs.existsSync(nicknamesFile)) d = JSON.parse(fs.readFileSync(nicknamesFile, 'utf-8')); } catch(e) {} if (n) d[u] = n; else delete d[u]; fs.writeFileSync(nicknamesFile, JSON.stringify(d, null, 2)); return { success: true }; });

    // 启动流程
    const favoriteUid = store.get('favoriteUid');
    createMainWindow({ targetUid: favoriteUid });
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const favUid = store.get('favoriteUid');
            createMainWindow({ targetUid: favUid });
        }
    });
    globalShortcut.register('CommandOrControl+L', () => BrowserWindow.getAllWindows().forEach(w => w.webContents.send('global-toggle-lock')));
    app.on('will-quit', () => globalShortcut.unregisterAll());
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });