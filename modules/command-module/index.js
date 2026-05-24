const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ========== ЭМУЛЯЦИЯ REDIS В ПАМЯТИ ==========
const memoryStore = {
    coords: { x: '100', y: '100', z: '100', ref_x: '100', ref_y: '100', ref_z: '100' },
    photos: {},
    photoQueue: []
};

// ========== КООРДИНАТЫ ==========
app.get('/api/coords', (req, res) => {
    res.json(memoryStore.coords);
});

app.post('/api/coords', (req, res) => {
    memoryStore.coords = { ...memoryStore.coords, ...req.body };
    res.json({ status: 'ok' });
});

// ========== ОЧЕРЕДЬ ФОТО ДЛЯ SCHEDULER ==========
app.get('/api/photo-queue', (req, res) => {
    res.json({ queue: memoryStore.photoQueue });
    memoryStore.photoQueue = []; // Очищаем после получения
});

// ========== PM2 ПРОЦЕССЫ ==========
app.get('/api/processes', (req, res) => {
    exec('pm2 jlist', (error, stdout) => {
        if (error) return res.json([]);
        try {
            const list = JSON.parse(stdout);
            const processes = list.map(p => ({
                name: p.name,
                pid: p.pid,
                status: p.pm2_env.status,
                uptime: p.pm2_env.pm_uptime || Date.now(),
                restart_count: p.pm2_env.restart_time || 0,
                cpu: p.monit?.cpu || 0,
                memory: p.monit?.memory || 0
            }));
            res.json(processes);
        } catch (e) {
            res.json([]);
        }
    });
});

// ========== УПРАВЛЕНИЕ PM2 ==========
app.post('/api/restart/:name', (req, res) => {
    exec(`pm2 restart ${req.params.name}`, (err) => {
        res.json({ status: err ? 'error' : 'restarted', name: req.params.name });
    });
});

app.post('/api/reload/:name', (req, res) => {
    exec(`pm2 reload ${req.params.name}`, (err) => {
        res.json({ status: err ? 'error' : 'reloaded', name: req.params.name });
    });
});

// ========== ЛОГИ ==========
app.get('/api/logs/:name', (req, res) => {
    const logPath = path.join(__dirname, '../../logs', `${req.params.name}-out.log`);
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.json({ logs: 'Логов пока нет' });
        const lines = data.split('\n').slice(-50);
        res.json({ logs: lines.join('\n') });
    });
});

// ========== ФОТОГРАФИИ ==========
app.put('/api/photo', (req, res) => {
    const task = { id: Date.now(), type: 'photo', createdAt: new Date().toISOString() };
    memoryStore.photoQueue.push(task);
    res.json({ status: 'queued', task });
});

app.get('/api/photos', (req, res) => {
    const photos = Object.entries(memoryStore.photos).map(([id, data]) => ({
        id,
        timestamp: data.timestamp,
        createdAt: new Date(parseInt(data.timestamp)).toLocaleString(),
        image: data.image
    }));
    photos.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
    res.json(photos);
});

app.post('/api/create-photo', (req, res) => {
    const id = Date.now();
    const currentTime = new Date().toLocaleString('ru-RU');
    
    const textImage = `
╔══════════════════════════════════════════════════╗
║                 🛰️ СПУТНИК                       ║
║                                                  ║
║           ${currentTime}                         ║
║                                                  ║
║           ID: ${id}                              ║
║                                                  ║
║      Отказоустойчивая система на PM2             ║
╚══════════════════════════════════════════════════╝
    `;
    
    const imageBase64 = Buffer.from(textImage).toString('base64');
    
    if (Object.keys(memoryStore.photos).length >= 5) {
        return res.json({ error: 'Лимит 5 фото' });
    }
    
    memoryStore.photos[id] = {
        timestamp: id.toString(),
        image: imageBase64
    };
    
    console.log(`📷 Фото ${id} создано в ${currentTime}`);
    res.json({ status: 'created', id, time: currentTime });
});

app.get('/api/photos/:id', (req, res) => {
    const photo = memoryStore.photos[req.params.id];
    if (photo && photo.image) {
        const imgBuffer = Buffer.from(photo.image, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(imgBuffer);
    } else {
        res.status(404).send('Фото не найдено');
    }
});

app.delete('/api/photos/:id', (req, res) => {
    delete memoryStore.photos[req.params.id];
    res.json({ status: 'deleted' });
});

app.post('/api/command', (req, res) => {
    const { cmd } = req.body;
    exec(cmd, (err, stdout, stderr) => {
        res.json({ output: err ? stderr : stdout });
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ========== СТАТИЧЕСКАЯ РАЗДАЧА ВЕБ-ИНТЕРФЕЙСА ==========
// Раздаём файлы из папки web-dashboard
app.use(express.static(path.join(__dirname, '../../web-dashboard')));

// Для всех остальных маршрутов - отдаём index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../web-dashboard/index.html'));
});

// ========== СИМУЛЯЦИЯ ДРЕЙФА КООРДИНАТ ==========
setInterval(() => {
    let x = parseFloat(memoryStore.coords.x) + (Math.random() - 0.5) * 2;
    let y = parseFloat(memoryStore.coords.y) + (Math.random() - 0.5) * 2;
    let z = parseFloat(memoryStore.coords.z) + (Math.random() - 0.5) * 2;
    let refX = parseFloat(memoryStore.coords.ref_x);
    let refY = parseFloat(memoryStore.coords.ref_y);
    let refZ = parseFloat(memoryStore.coords.ref_z);
    
    const dx = Math.abs(x - refX);
    const dy = Math.abs(y - refY);
    const dz = Math.abs(z - refZ);
    
    if (dx > 5 || dy > 5 || dz > 5) {
        x = refX;
        y = refY;
        z = refZ;
        console.log(`⚠️ КОРРЕКЦИЯ КООРДИНАТ: отклонение ${Math.max(dx, dy, dz).toFixed(2)} > 5`);
    }
    
    memoryStore.coords.x = x.toFixed(2);
    memoryStore.coords.y = y.toFixed(2);
    memoryStore.coords.z = z.toFixed(2);
}, 500);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Command-module запущен на порту ${PORT}`);
    console.log(`   Веб-интерфейс: http://localhost:${PORT}`);
    console.log(`   API доступен по /api/*`);
});