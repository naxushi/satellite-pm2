const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const redis = require('redis');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect();

// ========== REST API ==========
app.get('/api/processes', (req, res) => {
    exec('pm2 jlist', (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        const list = JSON.parse(stdout);
        res.json(list.map(p => ({
            name: p.name,
            pid: p.pid,
            status: p.pm2_env.status,
            uptime: p.pm2_env.pm_uptime,
            restart_count: p.pm2_env.restart_time,
            cpu: p.monit.cpu,
            memory: p.monit.memory
        })));
    });
});

app.post('/api/restart/:name', (req, res) => {
    exec(`pm2 restart ${req.params.name}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'restarted' });
    });
});

app.post('/api/reload/:name', (req, res) => {
    exec(`pm2 reload ${req.params.name}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'reloaded' });
    });
});

app.get('/api/coords', async (req, res) => {
    const coords = await redisClient.hGetAll('coords');
    res.json(coords);
});

app.get('/api/logs/:name', (req, res) => {
    exec(`pm2 logs ${req.params.name} --lines 50 --nostream`, (err, stdout) => {
        if (err) res.json({ logs: 'Ошибка получения логов' });
        else res.json({ logs: stdout });
    });
});

app.put('/api/photo', async (req, res) => {
    const task = { id: Date.now(), type: 'photo', createdAt: new Date() };
    await redisClient.lPush('photo_queue', JSON.stringify(task));
    res.json({ status: 'queued', task });
});

app.get('/api/photos', async (req, res) => {
    const keys = await redisClient.keys('photo:*');
    const photos = [];
    for (const key of keys) {
        const data = await redisClient.hGetAll(key);
        photos.push({ id: key.replace('photo:', ''), ...data });
    }
    res.json(photos);
});

app.get('/api/photos/:id', async (req, res) => {
    const data = await redisClient.hGetAll(`photo:${req.params.id}`);
    if (data && data.image) {
        const imgBuffer = Buffer.from(data.image, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(imgBuffer);
    } else {
        res.status(404).send('Фото не найдено');
    }
});

app.delete('/api/photos/:id', async (req, res) => {
    await redisClient.del(`photo:${req.params.id}`);
    res.json({ status: 'deleted' });
});

app.post('/api/command', (req, res) => {
    const { cmd } = req.body;
    exec(cmd, (err, stdout, stderr) => {
        if (err) res.json({ output: stderr });
        else res.json({ output: stdout });
    });
});

// ========== WebSocket для реального времени ==========
wss.on('connection', (ws) => {
    console.log('Оператор подключён');
    const interval = setInterval(async () => {
        const coords = await redisClient.hGetAll('coords');
        ws.send(JSON.stringify({ type: 'telemetry', data: coords }));
    }, 1000);
    ws.on('close', () => clearInterval(interval));
});

server.listen(3002, () => {
    console.log('✅ Ground Gateway: REST на 3000, WebSocket на 3002');
});