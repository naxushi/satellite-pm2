const express = require('express');
const redis = require('redis');
const app = express();
const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect();

app.get('/telemetry', async (req, res) => {
  const coords = await redisClient.hGetAll('coords');
  res.json({
    timestamp: Date.now(),
    coords,
    health: 'OK'
  });
});
app.listen(3001, () => console.log('Telemetry на порту 3001'));