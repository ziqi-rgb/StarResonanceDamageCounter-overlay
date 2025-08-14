// renderer.js - 最终版
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 配置与状态管理 ---
    const ALL_STATS_CONFIG = {
        realtime_dps: { label: '实时DPS', type: 'simple' }, total_dps:    { label: '总秒伤', type: 'simple' },
        total_damage: { label: '总伤害', type: 'simple' }, realtime_hps: { label: '实时HPS', type: 'simple' },
        total_hps:    { label: '总秒疗', type: 'simple' }, total_healing:{ label: '总治疗', type: 'simple' },
        taken_damage: { label: '承受伤害', type: 'simple' }, profession:   { label: '职业', type: 'simple' },
        fight_point:  { label: '总评分', type: 'simple' }, peak_dps:     { label: '峰值DPS', type: 'simple' },
        hp_bar:       { label: '生命值', type: 'progress' }
    };
    const appState = {
        targetUid: null, lastData: null, lastDatalistUIDs: [], isMainWindow: false, nicknames: {}, 
        currentDisplayUid: null, isEditingTitle: false, lastNotifiedHeight: 0, isLocked: false, 
        favoriteUid: null, lastBroadcastedUid: null,
    };

    // --- 2. DOM 元素获取 ---
    const elements = {
        container: document.querySelector('.container'), titleContainer: document.querySelector('.title-container'),
        windowTitleText: document.getElementById('window-title-text'), favoriteBtn: document.getElementById('favorite-btn'),
        skillDetailsBtn: document.getElementById('skill-details-btn'), editTitleBtn: document.getElementById('edit-title-btn'),
        closeBtn: document.getElementById('close-btn'), userControlPanel: document.getElementById('user-control-panel'), 
        dropdownToggleBtn: document.getElementById('dropdown-toggle-btn'), uidInput: document.getElementById('uid-input'),
        customDropdown: document.getElementById('custom-dropdown'), retargetUidBtn: document.getElementById('retarget-uid-btn'),
        trackUidBtn: document.getElementById('track-uid-btn'), statsContainer: document.getElementById('stats-container'),
        statusMessage: document.getElementById('status-message'), clearStatsBtn: document.getElementById('clear-stats-btn'),
        teamStatsToggleBtn: document.getElementById('team-stats-toggle-btn'), lockToggleBtn: document.getElementById('lock-toggle-btn'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'), settingsToggleBtn: document.getElementById('settings-toggle'),
    };

    // --- 3. 核心功能函数 ---

    function initializeMainWindowControls() {
        elements.dropdownToggleBtn.addEventListener('click', (event) => { event.stopPropagation(); if (appState.lastDatalistUIDs.length > 0) elements.customDropdown.classList.toggle('hidden'); });
        elements.customDropdown.addEventListener('click', (event) => { const option = event.target.closest('.dropdown-option'); if (option) { elements.uidInput.value = option.dataset.uid; elements.customDropdown.classList.add('hidden'); } });
        elements.retargetUidBtn.addEventListener('click', () => { appState.targetUid = elements.uidInput.value.trim(); updateUI(appState.lastData); });
        elements.trackUidBtn.addEventListener('click', () => { const uidToTrack = elements.uidInput.value.trim(); if (uidToTrack) window.electronAPI.createNewWindow(uidToTrack); });
        elements.uidInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') elements.trackUidBtn.click(); });
        document.addEventListener('click', () => { if (!elements.customDropdown.classList.contains('hidden')) elements.customDropdown.classList.add('hidden'); });
    }

    function loadAndApplyTheme() {
        const themeSettings = { opacity: localStorage.getItem('theme_opacity') || '0.85', bgColor: localStorage.getItem('theme_bgColor') || '#1e1e28', isBold: localStorage.getItem('theme_isBold') === 'true', isItalic: localStorage.getItem('theme_isItalic') === 'true' };
        const { opacity, bgColor, isBold, isItalic } = themeSettings;
        const r = parseInt(bgColor.slice(1, 3), 16), g = parseInt(bgColor.slice(3, 5), 16), b = parseInt(bgColor.slice(5, 7), 16);
        elements.container.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        document.body.style.fontWeight = isBold ? 'bold' : 'normal'; document.body.style.fontStyle = isItalic ? 'italic' : 'normal';
    }

    function toggleLock(initialState = null) {
        appState.isLocked = (initialState !== null) ? initialState : !appState.isLocked;
        elements.lockToggleBtn.classList.toggle('locked', appState.isLocked);
        elements.lockToggleBtn.textContent = appState.isLocked ? '🔒' : '🔓';
        elements.lockToggleBtn.title = appState.isLocked ? '解锁交互 (Ctrl+L)' : '锁定窗口 (Ctrl+L)';
        window.electronAPI.toggleLockState(appState.isLocked);
    }

    function updateCustomDropdown(uids, userData) {
        const sortedNewUIDs = [...uids].sort();
        if (sortedNewUIDs.join(',') !== appState.lastDatalistUIDs.join(',')) {
            elements.customDropdown.innerHTML = '';
            uids.forEach(uid => {
                const optionDiv = document.createElement('div'); optionDiv.className = 'dropdown-option'; optionDiv.dataset.uid = uid;
                const name = userData[uid]?.name || appState.nicknames[uid] || userData[uid]?.profession || '未知';
                optionDiv.textContent = `${name} (${uid})`; optionDiv.title = optionDiv.textContent;
                elements.customDropdown.appendChild(optionDiv);
            });
            appState.lastDatalistUIDs = sortedNewUIDs;
        }
    }

    function updateWindowTitle(uid, userData, customTitle = null) {
        if (customTitle || !uid || !userData) {
            elements.windowTitleText.textContent = customTitle || '伤害统计';
            [elements.editTitleBtn, elements.skillDetailsBtn, elements.favoriteBtn].forEach(btn => btn.classList.add('hidden'));
            return;
        }
        const displayName = userData.name || appState.nicknames[uid];
        elements.windowTitleText.textContent = displayName ? `${displayName} (${uid})` : `伤害统计 (${uid})`;
        [elements.editTitleBtn, elements.skillDetailsBtn].forEach(btn => btn.classList.remove('hidden'));
        if (appState.isMainWindow) elements.favoriteBtn.classList.remove('hidden');
    }

    function toggleTitleEditMode() {
        const uid = appState.currentDisplayUid; if (!uid) return;
        if (appState.isEditingTitle) {
            const input = elements.titleContainer.querySelector('.title-input'); if (!input) return;
            window.electronAPI.setNickname(uid, input.value.trim()).then(() => {
                appState.nicknames[uid] = input.value.trim();
                elements.titleContainer.replaceChild(elements.windowTitleText, input);
                elements.editTitleBtn.textContent = '✏️'; appState.isEditingTitle = false;
                updateWindowTitle(uid, appState.lastData.user[uid]);
            });
        } else {
            appState.isEditingTitle = true;
            const input = document.createElement('input'); input.type = 'text'; input.className = 'title-input';
            input.value = appState.nicknames[uid] || appState.lastData.user[uid]?.name || '';
            const saveAndExit = () => { if (appState.isEditingTitle) toggleTitleEditMode(); };
            input.addEventListener('keydown', (e) => e.key === 'Enter' && saveAndExit());
            input.addEventListener('blur', saveAndExit);
            elements.titleContainer.replaceChild(input, elements.windowTitleText);
            input.focus(); input.select(); elements.editTitleBtn.textContent = '✔️';
        }
    }

    function formatSimpleNumber(num) { if (typeof num !== 'number' || !isFinite(num)) return '0'; return Math.round(num).toLocaleString('en-US'); }

    function formatBigNumber(num) {
        if (typeof num !== 'number' || !isFinite(num)) return '0';
        const n = Math.round(num);
        if (n < 10000) return n.toLocaleString('en-US');
        if (n < 10000000) return (n / 10000).toFixed(2) + '万';
        if (n < 100000000) return (n / 10000000).toFixed(2) + '千万';
        return (n / 100000000).toFixed(2) + '亿';
    }

    function initializeAndRender(userData) {
        elements.statsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const statId in ALL_STATS_CONFIG) {
            if (localStorage.getItem(`setting_show_${statId}`) === 'false') continue;
            const config = ALL_STATS_CONFIG[statId];
            if (config.type === 'simple') {
                const row = document.createElement('div'); row.className = 'stat-row';
                const label = document.createElement('span'); label.className = 'stat-label'; label.textContent = `${config.label}:`;
                const value = document.createElement('span'); value.className = 'stat-value';
                let displayValue;
                switch(statId) {
                    case 'total_damage':    displayValue = formatBigNumber(userData.total_damage.total); break;
                    case 'total_healing':   displayValue = formatBigNumber(userData.total_healing.total); break;
                    case 'taken_damage':    displayValue = formatBigNumber(userData.taken_damage); break;
                    case 'realtime_dps':    displayValue = formatBigNumber(userData.realtime_dps); break;
                    case 'total_dps':       displayValue = formatBigNumber(userData.total_dps); break;
                    case 'peak_dps':        displayValue = formatBigNumber(userData.realtime_dps_max); break;
                    case 'realtime_hps':    displayValue = formatBigNumber(userData.realtime_hps); break;
                    case 'total_hps':       displayValue = formatBigNumber(userData.total_hps); break;
                    case 'fight_point':     displayValue = formatSimpleNumber(userData.fightPoint); break;
                    case 'profession':      displayValue = userData.profession || '未知'; break;
                    default:                displayValue = formatSimpleNumber(userData[statId]);
                }
                value.textContent = displayValue;
                row.appendChild(label); row.appendChild(value); fragment.appendChild(row);
            } else if (config.type === 'progress') {
                const labelRow = document.createElement('div'); labelRow.className = 'progress-label-row'; const label = document.createElement('span'); label.className = 'stat-label'; label.textContent = `${config.label}:`; labelRow.appendChild(label);
                const barRow = document.createElement('div'); barRow.className = 'progress-bar-row'; const barContainer = document.createElement('div'); barContainer.className = 'progress-bar'; const barFill = document.createElement('div'); barFill.className = 'progress-bar-fill'; const barText = document.createElement('span'); barText.className = 'progress-bar-text';
                const hp = userData.hp || 0, max_hp = userData.max_hp || 0;
                barFill.style.width = `${(max_hp > 0 ? hp / max_hp : 0) * 100}%`;
                barText.textContent = `${formatSimpleNumber(hp)} / ${formatSimpleNumber(max_hp)}`;
                barContainer.appendChild(barFill); barRow.appendChild(barContainer); barRow.appendChild(barText);
                fragment.appendChild(labelRow); fragment.appendChild(barRow);
            }
        }
        elements.statsContainer.appendChild(fragment);
        requestResize();
    }

    function requestResize() {
        setTimeout(() => {
            const newHeight = document.body.scrollHeight;
            if (newHeight > 0 && newHeight !== appState.lastNotifiedHeight) {
                appState.lastNotifiedHeight = newHeight;
                window.electronAPI.resizeWindow(elements.container.getBoundingClientRect().width, newHeight);
            }
        }, 50);
    }

    function showStatusMessage(title, message) {
        elements.statsContainer.innerHTML = '';
        elements.statusMessage.textContent = message;
        updateWindowTitle(null, null, title);
        requestResize();
    }

    function updateFavoriteButtonState() {
        if (!appState.isMainWindow) { elements.favoriteBtn.classList.add('hidden'); return; }
        if (appState.currentDisplayUid) {
            elements.favoriteBtn.classList.remove('hidden');
            if (appState.currentDisplayUid.toString() === appState.favoriteUid) { elements.favoriteBtn.textContent = '★'; elements.favoriteBtn.title = '取消收藏'; }
            else { elements.favoriteBtn.textContent = '☆'; elements.favoriteBtn.title = '收藏为默认角色'; }
        } else { elements.favoriteBtn.classList.add('hidden'); }
    }

    function updateUI(data) {
        appState.lastData = data;
        const uids = (data && data.user) ? Object.keys(data.user) : [];
        if (appState.isMainWindow && uids.length > 0) updateCustomDropdown(uids, data.user);

        let uidToShow = null;
        if (appState.isMainWindow) {
            uidToShow = appState.targetUid ? appState.targetUid : (uids.length > 0 ? uids[0] : null);
        } else {
            uidToShow = appState.targetUid;
        }

        if (appState.currentDisplayUid !== uidToShow && appState.isEditingTitle) toggleTitleEditMode();
        appState.currentDisplayUid = uidToShow;

        if (appState.isMainWindow && appState.lastBroadcastedUid !== appState.currentDisplayUid) {
            appState.lastBroadcastedUid = appState.currentDisplayUid;
            window.electronAPI.updateMainWindowTarget(appState.lastBroadcastedUid);
        }

        if (uidToShow && data?.user?.[uidToShow]) {
            elements.statsContainer.style.display = 'block';
            elements.statusMessage.style.display = 'none';
            initializeAndRender(data.user[uidToShow]); 
            updateWindowTitle(uidToShow, data.user[uidToShow]);
        } else {
            elements.statsContainer.style.display = 'none';
            elements.statusMessage.style.display = 'block';
            let title = '伤害统计', message = '...';
            if (uidToShow) {
                title = `伤害统计 (等待中)`; message = `正在等待UID [${uidToShow}] 的数据...`;
            } else if (appState.isMainWindow && uids.length === 0) {
                title = '伤害统计 (等待中)'; message = '等待玩家数据...';
            } else if (!data) {
                title = '伤害统计 (未连接)'; message = '无法连接到后端服务...';
            }
            showStatusMessage(title, message);
        }
        updateFavoriteButtonState();
    }

    async function mainLoop() {
        try {
            const data = await window.electronAPI.fetchData();
            updateUI(data);
        } catch (error) {
            updateUI(null);
        } finally {
            setTimeout(mainLoop, 1000);
        }
    }
    
    // --- 4. 事件监听与初始化 ---
    elements.editTitleBtn.addEventListener('click', toggleTitleEditMode);
    elements.lockToggleBtn.addEventListener('click', () => toggleLock());
    window.electronAPI.onGlobalToggleLock(() => toggleLock());
    elements.closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
    elements.settingsToggleBtn.addEventListener('click', () => window.electronAPI.toggleSettingsWindow());
    elements.themeToggleBtn.addEventListener('click', () => window.electronAPI.toggleThemeWindow());
    window.electronAPI.onSettingsUpdated(() => { loadAndApplyTheme(); if (appState.currentDisplayUid && appState.lastData) initializeAndRender(appState.lastData.user[appState.currentDisplayUid]); });
    elements.favoriteBtn.addEventListener('click', async () => { if (appState.currentDisplayUid) { const newFav = await window.electronAPI.toggleFavoriteUid(appState.currentDisplayUid); appState.favoriteUid = newFav ? newFav.toString() : null; updateFavoriteButtonState(); } });
    elements.clearStatsBtn.addEventListener('click', async () => { if (confirm('确定要清除所有统计数据吗？此操作不可撤销。')) await window.electronAPI.clearStatsData(); });
    elements.skillDetailsBtn.addEventListener('click', () => { if (appState.currentDisplayUid) window.electronAPI.toggleSkillDetailsWindow(appState.currentDisplayUid); });

    // --- 5. 启动流程 ---
    appState.nicknames = await window.electronAPI.getNicknames();
    appState.favoriteUid = await window.electronAPI.getFavoriteUid();
    const urlParams = new URLSearchParams(window.location.search);
    const uidFromUrl = urlParams.get('uid');
    
    if (uidFromUrl === 'main') {
        appState.isMainWindow = true;
        appState.targetUid = urlParams.get('target') || null;
        initializeMainWindowControls();
        elements.teamStatsToggleBtn.addEventListener('click', () => window.electronAPI.toggleTeamStatsWindow());
    } else {
        appState.isMainWindow = false;
        appState.targetUid = uidFromUrl;
        [elements.userControlPanel, elements.teamStatsToggleBtn, elements.clearStatsBtn, elements.favoriteBtn].forEach(el => el.style.display = 'none');
    }
    loadAndApplyTheme();
    toggleLock(appState.isLocked); 
    mainLoop();
});