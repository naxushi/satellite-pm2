const API_BASE = '/api';

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
async function fetchAPI(url, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        return null;
    }
}

// ========== ОБНОВЛЕНИЕ КООРДИНАТ ==========
async function updateCoords() {
    const data = await fetchAPI('/coords');
    if (data && !data.error) {
        const x = parseFloat(data.x) || 0;
        const y = parseFloat(data.y) || 0;
        const z = parseFloat(data.z) || 0;
        const refX = parseFloat(data.ref_x) || 100;
        const refY = parseFloat(data.ref_y) || 100;
        const refZ = parseFloat(data.ref_z) || 100;
        
        const dx = Math.abs(x - refX);
        const dy = Math.abs(y - refY);
        const dz = Math.abs(z - refZ);
        const maxDev = Math.max(dx, dy, dz);
        
        document.getElementById('coordsPanel').innerHTML = `
            📍 <strong>ТЕКУЩИЕ КООРДИНАТЫ</strong><br>
            X: ${x.toFixed(2)} | Y: ${y.toFixed(2)} | Z: ${z.toFixed(2)}<br>
            🎯 <strong>ЭТАЛОН</strong>: X:${refX.toFixed(2)} Y:${refY.toFixed(2)} Z:${refZ.toFixed(2)}<br>
            ⚠️ <strong>ОТКЛОНЕНИЕ</strong>: ΔX=${dx.toFixed(2)} ΔY=${dy.toFixed(2)} ΔZ=${dz.toFixed(2)}
        `;
        
        const warning = document.getElementById('deviationWarning');
        if (maxDev > 5) {
            warning.classList.remove('hidden');
            warning.innerHTML = `🚨 КРИТИЧЕСКОЕ ОТКЛОНЕНИЕ ${maxDev.toFixed(2)} > 5! ТРЕБУЕТСЯ КОРРЕКЦИЯ! 🚨`;
        } else {
            warning.classList.add('hidden');
        }
    }
}

// ========== ОБНОВЛЕНИЕ ПРОЦЕССОВ ==========
async function updateProcesses() {
    const processes = await fetchAPI('/processes');
    if (!processes) return;
    
    const tbody = document.querySelector('#processTable tbody');
    tbody.innerHTML = '';
    
    const controlsDiv = document.getElementById('controlButtons');
    controlsDiv.innerHTML = '';
    
    const workerSelect = document.getElementById('workerSelect');
    workerSelect.innerHTML = '<option value="">Выберите воркер</option>';
    
    processes.forEach(p => {
        const uptimeSec = p.uptime ? Math.floor((Date.now() - p.uptime) / 1000) : 0;
        const statusIcon = p.status === 'online' ? '🟢' : '🔴';
        
        tbody.innerHTML += `
            <tr>
                <td>${statusIcon} <strong>${p.name}</strong></td>
                <td>${p.status}</td>
                <td>${uptimeSec}с</td>
                <td>${p.restart_count || 0}</td>
                <td>${p.cpu || 0}%</td>
                <td>${Math.round((p.memory || 0) / 1048576)}MB</td>
                <td>
                    <button onclick="restartWorker('${p.name}')">🔄 Restart</button>
                    <button onclick="reloadWorker('${p.name}')">✨ Reload</button>
                </td>
            </tr>
        `;
        
        controlsDiv.innerHTML += `
            <button onclick="restartWorker('${p.name}')">🔁 ${p.name}</button>
        `;
        
        workerSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });
}

// ========== УПРАВЛЕНИЕ ВОРКЕРАМИ ==========
window.restartWorker = async (name) => {
    const result = await fetchAPI(`/restart/${name}`, { method: 'POST' });
    if (result) alert(`✅ ${name} перезапущен`);
    setTimeout(() => updateProcesses(), 500);
};

window.reloadWorker = async (name) => {
    const result = await fetchAPI(`/reload/${name}`, { method: 'POST' });
    if (result) alert(`✨ ${name} перезагружен (zero-downtime)`);
    setTimeout(() => updateProcesses(), 500);
};

// ========== ФОТОГРАФИИ ==========
async function updatePhotos() {
    const photos = await fetchAPI('/photos');
    if (!photos) {
        document.getElementById('photoList').innerHTML = '<p>❌ Ошибка загрузки фото</p>';
        return;
    }
    
    const container = document.getElementById('photoList');
    document.getElementById('photoCount').innerHTML = `📸 Фото: ${photos.length}/5`;
    
    if (photos.length === 0) {
        container.innerHTML = '<p>📭 Нет сохранённых фото. Нажмите "СДЕЛАТЬ ФОТО"</p>';
        return;
    }
    
    container.innerHTML = '<div class="photo-grid">';
    for (const photo of photos) {
        // Получаем миниатюру (первые 100 символов)
        let preview = photo.image ? atob(photo.image).substring(0, 200) : 'Нет данных';
        
        container.innerHTML += `
            <div class="photo-card">
                <div class="photo-time">📅 ${photo.createdAt || new Date(parseInt(photo.timestamp)).toLocaleString()}</div>
                <div class="photo-id">🆔 ${photo.id}</div>
                <div class="photo-preview">${escapeHtml(preview)}...</div>
                <div class="photo-actions">
                    <button onclick="downloadPhoto('${photo.id}')">📥 Скачать</button>
                    <button onclick="deletePhoto('${photo.id}')" class="danger">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }
    container.innerHTML += '</div>';
}

window.makePhoto = async () => {
    const btn = document.getElementById('makePhotoBtn');
    btn.disabled = true;
    btn.textContent = '⏳ ОТПРАВКА...';
    
    const result = await fetchAPI('/photo', { method: 'PUT' });
    if (result) {
        alert('✅ Фото добавлено в очередь! Через 5-10 секунд оно появится в галерее.');
        setTimeout(() => updatePhotos(), 3000);
        setTimeout(() => updatePhotos(), 6000);
    } else {
        alert('❌ Ошибка при создании фото');
    }
    
    btn.disabled = false;
    btn.textContent = '📷 СДЕЛАТЬ ФОТО';
};

window.downloadPhoto = async (id) => {
    window.open(`${API_BASE}/photos/${id}`, '_blank');
};

window.deletePhoto = async (id) => {
    if (confirm('🗑️ Удалить фото навсегда?')) {
        await fetchAPI(`/photos/${id}`, { method: 'DELETE' });
        updatePhotos();
    }
};

// ========== ЛОГИ ==========
window.getLogs = async () => {
    const worker = document.getElementById('workerSelect').value;
    if (!worker) {
        alert('Выберите воркер');
        return;
    }
    const data = await fetchAPI(`/logs/${worker}`);
    if (data && data.logs) {
        document.getElementById('logsOutput').innerText = data.logs;
    } else {
        document.getElementById('logsOutput').innerText = 'Нет логов для этого воркера';
    }
};

// ========== ПРОИЗВОЛЬНАЯ КОМАНДА ==========
window.sendCommand = async () => {
    const cmd = document.getElementById('customCmd').value;
    if (!cmd) return;
    const data = await fetchAPI('/command', { method: 'POST', body: JSON.stringify({ cmd }) });
    if (data) {
        alert(data.output || '✅ Команда выполнена');
    }
};

// ========== СТАТУС ПОДКЛЮЧЕНИЯ ==========
async function updateHealth() {
    const health = await fetchAPI('/health');
    const statusDiv = document.getElementById('connectionStatus');
    if (health && health.status === 'ok') {
        statusDiv.innerHTML = '🟢 СВЯЗЬ С КОМАНДНЫМ МОДУЛЕМ: OK | ' + new Date().toLocaleTimeString();
        statusDiv.style.background = '#0a2a0a';
    } else {
        statusDiv.innerHTML = '🔴 СВЯЗЬ ПОТЕРЯНА! Проверьте command-module на порту 3000';
        statusDiv.style.background = '#2a0a0a';
    }
}

// ========== ESCAPE HTML ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== ИНИЦИАЛИЗАЦИЯ И ИНТЕРВАЛЫ ==========
document.getElementById('makePhotoBtn').onclick = makePhoto;
document.getElementById('getLogsBtn').onclick = getLogs;
document.getElementById('sendCmdBtn').onclick = sendCommand;

setInterval(() => {
    updateCoords();
    updateProcesses();
    updatePhotos();
    updateHealth();
}, 2000);

updateCoords();
updateProcesses();
updatePhotos();
updateHealth();