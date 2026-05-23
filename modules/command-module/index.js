const express = require('express');
const redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS для веб-интерфейса
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

// ========== КООРДИНАТЫ ==========
app.get('/api/coords', async (req, res) => {
    try {
        const coords = await redisClient.hGetAll('coords');
        if (!coords || Object.keys(coords).length === 0) {
            // Инициализация начальных координат
            await redisClient.hSet('coords', 'x', '100', 'y', '100', 'z', '100', 'ref_x', '100', 'ref_y', '100', 'ref_z', '100');
            res.json({ x: '100', y: '100', z: '100', ref_x: '100', ref_y: '100', ref_z: '100' });
        } else {
            res.json(coords);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== PM2 ПРОЦЕССЫ ==========
app.get('/api/processes', (req, res) => {
    exec('pm2 jlist', (error, stdout) => {
        if (error) {
            return res.json([]);
        }
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
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'restarted', name: req.params.name });
    });
});

app.post('/api/reload/:name', (req, res) => {
    exec(`pm2 reload ${req.params.name}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'reloaded', name: req.params.name });
    });
});

// ========== ЛОГИ ==========
app.get('/api/logs/:name', (req, res) => {
    const logPath = path.join(__dirname, '../../logs', `${req.params.name}-out.log`);
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            // Пробуем другой путь
            const altPath = path.join(__dirname, '../../logs', `${req.params.name}.log`);
            fs.readFile(altPath, 'utf8', (err2, data2) => {
                if (err2) return res.json({ logs: 'Логов пока нет' });
                const lines = data2.split('\n').slice(-50);
                res.json({ logs: lines.join('\n') });
            });
        } else {
            const lines = data.split('\n').slice(-50);
            res.json({ logs: lines.join('\n') });
        }
    });
});

// ========== ФОТОГРАФИИ ==========
app.put('/api/photo', async (req, res) => {
    try {
        const task = { 
            id: Date.now(), 
            type: 'photo', 
            createdAt: new Date().toISOString() 
        };
        await redisClient.lPush('photo_queue', JSON.stringify(task));
        res.json({ status: 'queued', task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/photos', async (req, res) => {
    try {
        const keys = await redisClient.keys('photo:*');
        const photos = [];
        for (const key of keys) {
            const data = await redisClient.hGetAll(key);
            photos.push({ 
                id: key.replace('photo:', ''), 
                timestamp: data.timestamp,
                createdAt: new Date(parseInt(data.timestamp)).toLocaleString(),
                image: data.image 
            });
        }
        // Сортируем по дате (новые сверху)
        photos.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        res.json(photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/photos/:id', async (req, res) => {
    try {
        const data = await redisClient.hGetAll(`photo:${req.params.id}`);
        if (data && data.image) {
            const imgBuffer = Buffer.from(data.image, 'base64');
            res.writeHead(200, { 
                'Content-Type': 'image/png',
                'Content-Disposition': `inline; filename="photo_${req.params.id}.png"`
            });
            res.end(imgBuffer);
        } else {
            res.status(404).send('Фото не найдено');
        }
    } catch (err) {
        res.status(500).send('Ошибка загрузки фото');
    }
});

app.delete('/api/photos/:id', async (req, res) => {
    try {
        await redisClient.del(`photo:${req.params.id}`);
        res.json({ status: 'deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== ПРОИЗВОЛЬНЫЕ КОМАНДЫ ==========
app.post('/api/command', (req, res) => {
    const { cmd } = req.body;
    exec(cmd, (err, stdout, stderr) => {
        if (err) res.json({ output: stderr || err.message });
        else res.json({ output: stdout });
    });
});

// ========== ЗДОРОВЬЕ ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Command-module запущен на порту ${PORT}`);
    console.log(`   Доступен по адресу: http://localhost:${PORT}`);
});