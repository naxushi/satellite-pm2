const redis = require('redis');
const { exec } = require('child_process');
let client;

async function init() {
  client = redis.createClient({ url: 'redis://localhost:6379' });
  await client.connect();
  console.log('Scheduler: Redis подключён');

  // Восстановление очереди
  const saved = await client.get('saved_queue');
  if (saved) {
    const queue = JSON.parse(saved);
    for (let task of queue.reverse()) {
      await client.lPush('photo_queue', JSON.stringify(task));
    }
    await client.del('saved_queue');
    console.log(`Scheduler: восстановлено ${queue.length} задач`);
  }

  setInterval(processTask, 5000);
}

async function processTask() {
  const taskJson = await client.rPop('photo_queue');
  if (!taskJson) return;

  const task = JSON.parse(taskJson);
  console.log(`📸 Обработка фото-задачи ${task.id}`);
  exec('pm2 start photo-simulator', (err) => {
    if (err) console.error('Ошибка запуска photo-simulator');
  });
}

// Graceful stop для PM2 reload
process.on('SIGINT', async () => {
  console.log('🛑 Scheduler получает SIGINT — сохраняем очередь');
  const queue = [];
  let task;
  while ((task = await client.rPop('photo_queue'))) {
    queue.push(JSON.parse(task));
  }
  await client.set('saved_queue', JSON.stringify(queue));
  console.log(`Сохранено ${queue.length} задач`);
  process.exit(0);
});

init();