document.addEventListener('DOMContentLoaded', () => {
    const summaryContainer = document.getElementById('team-summary');
    const membersContainer = document.getElementById('team-members');
    const statusMessage = document.getElementById('status-message');

    function formatNumber(num) {
        if (typeof num !== 'number' || !isFinite(num)) return '0';
        return Math.round(num).toLocaleString('en-US');
    }

    function render(data) {
        const { teamMembers, users } = data;
        
        if (!teamMembers || teamMembers.length === 0 || !users) {
            statusMessage.classList.remove('hidden');
            summaryContainer.innerHTML = '';
            membersContainer.innerHTML = '';
            return;
        }

        statusMessage.classList.add('hidden');

        let teamTotalDamage = 0;
        let teamTotalHealing = 0;
        let teamTotalTakenDamage = 0;

        const memberData = teamMembers.map(uid => {
            const user = users[uid];
            if (!user) return null;
            teamTotalDamage += user.total_damage.total;
            teamTotalHealing += user.total_healing.total;
            teamTotalTakenDamage += user.taken_damage;
            return {
                uid: uid,
                name: user.name || `UID: ${uid}`,
                damage: user.total_damage.total,
                healing: user.total_healing.total,
                taken: user.taken_damage
            };
        }).filter(Boolean); // 过滤掉未找到数据的成员

        // 渲染团队总结
        summaryContainer.innerHTML = `
            <div class="team-summary-row"><span>团队总输出:</span><span>${formatNumber(teamTotalDamage)}</span></div>
            <div class="team-summary-row"><span>团队总治疗:</span><span>${formatNumber(teamTotalHealing)}</span></div>
            <div class="team-summary-row"><span>团队总承伤:</span><span>${formatNumber(teamTotalTakenDamage)}</span></div>
        `;

        // 渲染成员详情
        membersContainer.innerHTML = '';
        const membersFragment = document.createDocumentFragment();
        memberData.forEach(member => {
            const memberBlock = document.createElement('div');
            memberBlock.className = 'member-block';
            
            const damagePercent = teamTotalDamage > 0 ? (member.damage / teamTotalDamage * 100).toFixed(1) : '0.0';
            const healingPercent = teamTotalHealing > 0 ? (member.healing / teamTotalHealing * 100).toFixed(1) : '0.0';
            const takenPercent = teamTotalTakenDamage > 0 ? (member.taken / teamTotalTakenDamage * 100).toFixed(1) : '0.0';

            memberBlock.innerHTML = `
                <div class="member-header">${member.name}</div>
                <div class="member-stat-row">
                    <span class="member-stat-label">输出:</span>
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${damagePercent}%;"></div></div>
                    <span class="value">${formatNumber(member.damage)}</span>
                    <span class="percentage">${damagePercent}%</span>
                </div>
                <div class="member-stat-row">
                    <span class="member-stat-label">治疗:</span>
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${healingPercent}%; background-color: #28a745;"></div></div>
                    <span class="value">${formatNumber(member.healing)}</span>
                    <span class="percentage">${healingPercent}%</span>
                </div>
                <div class="member-stat-row">
                    <span class="member-stat-label">承伤:</span>
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${takenPercent}%; background-color: #dc3545;"></div></div>
                    <span class="value">${formatNumber(member.taken)}</span>
                    <span class="percentage">${takenPercent}%</span>
                </div>
            `;
            membersFragment.appendChild(memberBlock);
        });
        membersContainer.appendChild(membersFragment);

        // 自适应高度
        setTimeout(() => {
            const newHeight = document.body.scrollHeight;
            if (newHeight > 0) {
                window.electronAPI.resizePanel(document.body.scrollWidth, newHeight);
            }
        }, 50);
    }

    window.electronAPI.onTeamDataUpdate(render);
});