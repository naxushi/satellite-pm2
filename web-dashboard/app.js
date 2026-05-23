const API = 'http://localhost:3000';
let refreshInterval;

async function fetchWithTimeout(url, timeout=3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch(e) { return null; }
}

async function updateStatus() {
    const res = await fetchWithTimeout(`${API}/processes`);
    if (!res) {
        document.getElementById('connectionStatus').innerHTML = '🔴 Связь потеряна';
        return;
    }
    document.getElementById('connectionStatus').innerHTML = '🟢 Связь с командным модулем: OK';

    const procs = await res.json();
    const table = document.getElementById('processTable');
    table.innerHTML = '<tr><th>Имя</th><th>Статус</th><th>Uptime</th><th>Рестарты</th><th>CPU%</th><th>Память</th><th>Действия</th></tr>';
    const controlsDiv = document.getElementById('controlButtons');
    controlsDiv.innerHTML = '';
    const workerSelect = document.getElementById('workerSelect');
    workerSelect.innerHTML = '';

    procs.forEach(p => {
        table.innerHTML += `<tr>
            <td>${p.name}</td><td>${p.status}</td><td>${Math.round(p.uptime/1000)}с</td>
            <td>${p.restart_count}</td><td>${p.cpu}</td><td>${Math.round(p.memory/1048576)}MB</td>
            <td><button onclick="restartWorker('${p.name}')">Restart</button>
            <button onclick="reloadWorker('${p.name}')">Reload</button></td>
        </tr>`;
        controlsDiv.innerHTML += `<button onclick="restartWorker('${p.name}')">🔁 ${p.name} (Restart)</button>
                                   <button onclick="reloadWorker('${p.name}')">🔄 ${p.name} (Reload)</button>`;
        workerSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });

    const coordsRes = await fetch(`${API}/coords`);
    if (coordsRes) {
        const c = await coordsRes.json();
        const x=parseFloat(c.x), y=parseFloat(c.y), z=parseFloat(c.z);
        const ref_x=parseFloat(c.ref_x), ref_y=parseFloat(c.ref_y), ref_z=parseFloat(c.ref_z);
        const dx = Math.abs(x-ref_x), dy = Math.abs(y-ref_y), dz = Math.abs(z-ref_z);
        document.getElementById('coordsPanel').innerHTML = `📍 X:${x.toFixed(2)} | Y:${y.toFixed(2)} | Z:${z.toFixed(2)}<br>
        🎯 Отклонение: ΔX=${dx.toFixed(2)} ΔY=${dy.toFixed(2)} ΔZ=${dz.toFixed(2)}`;
        if(dx>5 || dy>5 || dz>5) document.getElementById('deviationWarning').classList.remove('hidden');
        else document.getElementById('deviationWarning').classList.add('hidden');
    }
}

async function restartWorker(name) { await fetch(`${API}/restart/${name}`, {method:'POST'}); setTimeout(updateStatus,500); }
async function reloadWorker(name) { await fetch(`${API}/reload/${name}`, {method:'POST'}); setTimeout(updateStatus,500); }

document.getElementById('makePhotoBtn').onclick = async () => {
    await fetch(`${API}/tasks/photo`, {method:'PUT'});
    alert('Фото добавлено в очередь');
};
document.getElementById('getLogsBtn').onclick = async () => {
    const worker = document.getElementById('workerSelect').value;
    const res = await fetch(`${API}/logs/${worker}`);
    const data = await res.json();
    document.getElementById('logsOutput').innerText = data.logs;
};
document.getElementById('sendCmdBtn').onclick = async () => {
    const cmd = document.getElementById('customCmd').value;
    const res = await fetch(`${API}/command`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cmd})});
    const data = await res.json();
    alert(data.output);
};
setInterval(updateStatus, 2000);
updateStatus();