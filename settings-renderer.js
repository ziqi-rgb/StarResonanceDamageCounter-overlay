document.addEventListener('DOMContentLoaded', () => {
    const ALL_STATS_CONFIG = {
        realtime_dps: { label: '实时DPS' }, total_dps: { label: '总秒伤' },
        total_damage: { label: '总伤害' }, realtime_hps: { label: '实时HPS' },
        total_hps: { label: '总秒疗' }, total_healing: { label: '总治疗' },
        taken_damage: { label: '承受伤害' }, profession: { label: '职业' },
        fight_point: { label: '总评分' }, peak_dps: { label: '峰值DPS' },
        hp_bar: { label: '生命值' }
    };

    const settingsPanel = document.getElementById('settings-panel');
    const fragment = document.createDocumentFragment();

    for (const statId in ALL_STATS_CONFIG) {
        const config = ALL_STATS_CONFIG[statId];
        const labelEl = document.createElement('label');
        labelEl.className = 'setting-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `setting_toggle_${statId}`;
        checkbox.checked = localStorage.getItem(`setting_show_${statId}`) !== 'false';
        
        checkbox.addEventListener('change', () => {
            localStorage.setItem(`setting_show_${statId}`, checkbox.checked);
            // 通知主窗口更新UI
            window.electronAPI.notifySettingsChanged();
        });
        
        labelEl.appendChild(checkbox);
        labelEl.appendChild(document.createTextNode(` ${config.label}`));
        fragment.appendChild(labelEl);
    }
    settingsPanel.appendChild(fragment);

    // 窗口大小自适应
    const resizeObserver = new ResizeObserver(() => {
        const newHeight = document.body.scrollHeight;
        if (newHeight > 0) {
            window.electronAPI.resizePanel(document.body.scrollWidth, newHeight);
        }
    });
    resizeObserver.observe(document.body);
});