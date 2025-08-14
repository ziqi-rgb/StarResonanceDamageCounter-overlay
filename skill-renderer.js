document.addEventListener('DOMContentLoaded', async () => {
    const titleEl = document.getElementById('skill-title-bar'); 
    const tableBody = document.querySelector('#skill-table tbody');
    const statusMessage = document.getElementById('status-message');

    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');

    const resizeObserver = new ResizeObserver(() => {
        const newHeight = document.body.scrollHeight;
        if (newHeight > 0) {
            window.electronAPI.resizePanel(document.body.scrollWidth, newHeight);
        }
    });
    resizeObserver.observe(document.body);

    if (!uid) {
        titleEl.textContent = '错误';
        statusMessage.textContent = '未提供玩家UID。';
        statusMessage.classList.remove('hidden');
        return;
    }
    
    function formatNumber(num) {
        if (typeof num !== 'number' || !isFinite(num)) return '0';
        return Math.round(num).toLocaleString('en-US');
    }

    try {
        const response = await window.electronAPI.fetchSkillData(uid);
        if (!response || response.code !== 0) {
            throw new Error(response?.msg || '获取数据失败');
        }

        const skillData = response.data;
        titleEl.textContent = `${skillData.name || `UID: ${uid}`} - 技能详情`; 

        const skills = Object.values(skillData.skills);

        if (skills.length === 0) {
            statusMessage.textContent = '暂无技能数据。';
            statusMessage.classList.remove('hidden');
            return;
        }

        const totalPlayerDamage = skills.reduce((sum, skill) => sum + skill.totalDamage, 0);

        // 按伤害排序
        skills.sort((a, b) => b.totalDamage - a.totalDamage);

        const fragment = document.createDocumentFragment();
        skills.forEach(skill => {
            const row = document.createElement('tr');
            
            // 计算占比
            const damagePercentage = totalPlayerDamage > 0 
                ? (skill.totalDamage / totalPlayerDamage * 100).toFixed(1) + '%' 
                : '0.0%';

            // 更新innerHTML模板
            row.innerHTML = `
                <td class="cell-center">${skill.elementype}</td>
                <td class="cell-center">${skill.displayName}</td>
                <td class="cell-center">${skill.type}</td>
                <td class="cell-center">${formatNumber(skill.totalCount)}</td>
                <td class="cell-center">${(skill.critRate * 100).toFixed(1)}%</td>
                <td class="cell-center">${(skill.luckyRate * 100).toFixed(1)}%</td>
                <td class="cell-center">${formatNumber(skill.totalDamage)}</td>
                <td class="cell-center">${damagePercentage}</td>
            `;
            fragment.appendChild(row);
        });
        tableBody.appendChild(fragment);

    } catch (error) {
        titleEl.textContent = '错误';
        statusMessage.textContent = `加载失败: ${error.message}`;
        statusMessage.classList.remove('hidden');
    }
});