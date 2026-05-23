const redis = require('redis');
const client = redis.createClient({ url: 'redis://localhost:6379' });
await client.connect();

const id = Date.now();
const fakeImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photoData = {
  timestamp: id,
  image: fakeImageBase64
};

// Ограничение: не более 5 фото
const existing = await client.keys('photo:*');
if (existing.length >= 5) {
  console.log('❌ Лимит 5 фото, удалите старые');
  process.exit(0);
}

await client.hSet(`photo:${id}`, 'timestamp', id, 'image', fakeImageBase64);
console.log(`📷 Фото ${id} сохранено в Redis (лимит: ${existing.length + 1}/5)`);
process.exit(0);