const API = 'http://localhost:3000/api';
let refreshInterval;

async function fetchAPI(url, options = {}) {
    try {
        const res = await fetch(`${API}${url}`, {
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

// Обновление координат
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
        
        const panel = document.getElementById('coordsPanel');
        panel.innerHTML = `
            📍 ТЕКУЩИЕ КООРДИНАТЫ:<br>
            X: ${x.toFixed(2)} | Y: ${y.toFixed(2)} | Z: ${z.toFixed(2)}<br>
            🎯 ЭТАЛОН: X:${refX.toFixed(2)} Y:${refY.toFixed(2)} Z:${refZ.toFixed(2)}<br>
            ⚠️ ОТКЛОНЕНИЕ: ΔX=${dx.toFixed(2)} ΔY=${dy.toFixed(2)} ΔZ=${dz.toFixed(2)}
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

// Обновление списка процессов
async function updateProcesses() {
    const processes = await fetchAPI('/processes');
    if (!processes) return;
    
    const table = document.getElementById('processTable');
    table.innerHTML = `<tr><th>Имя</th><th>Статус</th><th>Uptime</th><th>Рестарты</th><th>CPU%</th><th>Память</th><th>Действия</th></tr>`;
    
    const controlsDiv = document.getElementById('controlButtons');
    controlsDiv.innerHTML = '';
    
    const workerSelect = document.getElementById('workerSelect');
    workerSelect.innerHTML = '<option value="">Выберите воркер</option>';
    
    processes.forEach(p => {
        const uptimeSec = p.uptime ? Math.floor((Date.now() - p.uptime) / 1000) : 0;
        const statusClass = p.status === 'online' ? '🟢' : '🔴';
        
        table.innerHTML += `<tr>
            <td>${statusClass} ${p.name}</td>
            <td>${p.status}</td>
            <td>${uptimeSec}с</td>
            <td>${p.restart_count}</td>
            <td>${p.cpu}%</td>
            <td>${Math.round(p.memory / 1048576)}MB</td>
            <td>
                <button onclick="restartWorker('${p.name}')">🔄 Restart</button>
                <button onclick="reloadWorker('${p.name}')">✨ Reload</button>
            </td>
        </tr>`;
        
        controlsDiv.innerHTML += `
            <button onclick="restartWorker('${p.name}')">🔁 ${p.name} (Restart)</button>
            <button onclick="reloadWorker('${p.name}')">🔄 ${p.name} (Reload)</button>
        `;
        
        workerSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });
}

// Обновление списка фото
async function updatePhotos() {
    const photos = await fetchAPI('/photos');
    if (!photos) return;
    
    const container = document.getElementById('photoList');
    if (photos.length === 0) {
        container.innerHTML = '<p>📭 Нет сохранённых фото. Нажмите "Сделать фото"</p>';
        return;
    }
    
    container.innerHTML = '<div class="photo-grid">';
    for (const photo of photos) {
        container.innerHTML += `
            <div class="photo-card">
                <div class="photo-time">📅 ${photo.createdAt || new Date(parseInt(photo.timestamp)).toLocaleString()}</div>
                <div class="photo-id">🆔 ${photo.id}</div>
                <div class="photo-actions">
                    <button onclick="downloadPhoto('${photo.id}')">📥 Скачать</button>
                    <button onclick="deletePhoto('${photo.id}')" class="danger">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }
    container.innerHTML += '</div>';
}

// Управление воркерами
window.restartWorker = async (name) => {
    await fetchAPI(`/restart/${name}`, { method: 'POST' });
    setTimeout(() => updateProcesses(), 500);
};

window.reloadWorker = async (name) => {
    await fetchAPI(`/reload/${name}`, { method: 'POST' });
    setTimeout(() => updateProcesses(), 500);
};

// Фото
window.makePhoto = async () => {
    const btn = document.getElementById('makePhotoBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Отправка...';
    
    const result = await fetchAPI('/photo', { method: 'PUT' });
    if (result) {
        alert('✅ Фото добавлено в очередь! Через несколько секунд оно появится в списке.');
        setTimeout(() => updatePhotos(), 3000);
    } else {
        alert('❌ Ошибка при создании фото');
    }
    
    btn.disabled = false;
    btn.textContent = '📷 Сделать фото';
};

window.downloadPhoto = async (id) => {
    window.open(`${API}/photos/${id}`, '_blank');
};

window.deletePhoto = async (id) => {
    if (confirm('Удалить фото?')) {
        await fetchAPI(`/photos/${id}`, { method: 'DELETE' });
        updatePhotos();
    }
};

// Логи
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

// Произвольная команда
window.sendCommand = async () => {
    const cmd = document.getElementById('customCmd').value;
    if (!cmd) return;
    const data = await fetchAPI('/command', { method: 'POST', body: JSON.stringify({ cmd }) });
    if (data) {
        alert(data.output || 'Команда выполнена');
    }
};

// Интервалы обновления
setInterval(() => {
    updateCoords();
    updateProcesses();
    updatePhotos();
}, 2000);

// Запуск при загрузке
updateCoords();
updateProcesses();
updatePhotos();

// Статус соединения
setInterval(async () => {
    const health = await fetchAPI('/health');
    const statusDiv = document.getElementById('connectionStatus');
    if (health && health.status === 'ok') {
        statusDiv.innerHTML = '🟢 СВЯЗЬ С КОМАНДНЫМ МОДУЛЕМ: OK';
        statusDiv.style.background = '#1a3a1a';
    } else {
        statusDiv.innerHTML = '🔴 СВЯЗЬ ПОТЕРЯНА! Проверьте command-module на порту 3000';
        statusDiv.style.background = '#3a1a1a';
    }
}, 3000);