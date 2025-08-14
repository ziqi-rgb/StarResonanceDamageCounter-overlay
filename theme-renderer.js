// theme-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        opacitySlider: document.getElementById('opacity-slider'),
        bgColorPicker: document.getElementById('bg-color-picker'),
        fontBoldToggle: document.getElementById('font-bold-toggle'),
        fontItalicToggle: document.getElementById('font-italic-toggle'),
    };

    function applySettings() {
        const isBold = localStorage.getItem('theme_isBold') === 'true';
        const isItalic = localStorage.getItem('theme_isItalic') === 'true';
        elements.opacitySlider.value = localStorage.getItem('theme_opacity') || '0.85';
        elements.bgColorPicker.value = localStorage.getItem('theme_bgColor') || '#1e1e28';
        elements.fontBoldToggle.classList.toggle('active', isBold);
        elements.fontItalicToggle.classList.toggle('active', isItalic);
    }

    function saveSetting(key, value) {
        localStorage.setItem(`theme_${key}`, value);
        applySettings();
        // 通知主窗口更新UI
        window.electronAPI.notifySettingsChanged();
    }

    elements.opacitySlider.addEventListener('input', (e) => saveSetting('opacity', e.target.value));
    elements.bgColorPicker.addEventListener('input', (e) => saveSetting('bgColor', e.target.value));
    elements.fontBoldToggle.addEventListener('click', () => saveSetting('isBold', !(localStorage.getItem('theme_isBold') === 'true')));
    elements.fontItalicToggle.addEventListener('click', () => saveSetting('isItalic', !(localStorage.getItem('theme_isItalic') === 'true')));

    applySettings();

    // 窗口大小自适应
    const resizeObserver = new ResizeObserver(() => {
        const newHeight = document.body.scrollHeight;
        if (newHeight > 0) {
            window.electronAPI.resizePanel(document.body.scrollWidth, newHeight);
        }
    });
    resizeObserver.observe(document.body);
});