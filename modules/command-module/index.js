const express = require('express');
const redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();
app.use(express.json());

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect();

// Очередь фото
app.put('/tasks/photo', async (req, res) => {
  const task = { id: Date.now(), command: 'take_photo', createdAt: new Date() };
  await redisClient.lPush('photo_queue', JSON.stringify(task));
  res.json({ status: 'ok', task });
});

// Получить список фото
app.get('/photos', async (req, res) => {
  const keys = await redisClient.keys('photo:*');
  const photos = [];
  for (let key of keys) {
    const data = await redisClient.hGetAll(key);
    photos.push({ id: key.replace('photo:', ''), ...data });
  }
  res.json(photos);
});

// Скачать фото
app.get('/photos/get/:id', async (req, res) => {
  const data = await redisClient.hGetAll(`photo:${req.params.id}`);
  if (data && data.image) {
    const imgBuffer = Buffer.from(data.image, 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(imgBuffer);
  } else {
    res.status(404).send('Фото не найдено');
  }
});

// Удалить фото
app.delete('/photos/:id', async (req, res) => {
  await redisClient.del(`photo:${req.params.id}`);
  res.json({ status: 'deleted' });
});

// Получить координаты
app.get('/coords', async (req, res) => {
  const coords = await redisClient.hGetAll('coords');
  res.json(coords);
});

// Получить статус PM2 процессов
app.get('/processes', (req, res) => {
  exec('pm2 jlist', (error, stdout) => {
    if (error) return res.status(500).json({ error });
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

// Restart
app.post('/restart/:name', (req, res) => {
  exec(`pm2 restart ${req.params.name}`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: `restarted ${req.params.name}` });
  });
});

// Reload (zero-downtime)
app.post('/reload/:name', (req, res) => {
  exec(`pm2 reload ${req.params.name}`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: `reloaded ${req.params.name}` });
  });
});

// Логи
app.get('/logs/:name', (req, res) => {
  const logPath = `./logs/${req.params.name}-out.log`;
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) return res.json({ logs: 'Логов пока нет' });
    const lines = data.split('\n').slice(-50);
    res.json({ logs: lines.join('\n') });
  });
});

// Произвольная команда
app.post('/command', (req, res) => {
  const { cmd } = req.body;
  exec(cmd, (err, stdout) => {
    if (err) res.json({ output: err.message });
    else res.json({ output: stdout });
  });
});

app.listen(3000, () => console.log('🛰️ Command-module на порту 3000'));