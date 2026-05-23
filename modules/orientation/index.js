const redis = require('redis');
const client = redis.createClient({ url: 'redis://localhost:6379' });
client.connect();

let coords = { x: 0, y: 0, z: 0 };
let reference = { x: 100, y: 100, z: 100 };
const MAX_DEVIATION = 5;

async function correctOrientation() {
  try {
    const saved = await client.hGetAll('coords');
    if (saved && saved.x) {
      coords = { x: parseFloat(saved.x), y: parseFloat(saved.y), z: parseFloat(saved.z) };
      reference = { x: parseFloat(saved.ref_x), y: parseFloat(saved.ref_y), z: parseFloat(saved.ref_z) };
    } else {
      await client.hSet('coords', 'x', coords.x, 'y', coords.y, 'z', coords.z, 'ref_x', reference.x, 'ref_y', reference.y, 'ref_z', reference.z);
    }

    // Симуляция изменения координат (дрейф)
    coords.x += (Math.random() - 0.5) * 2;
    coords.y += (Math.random() - 0.5) * 2;
    coords.z += (Math.random() - 0.5) * 2;

    // Коррекция
    let dx = Math.abs(coords.x - reference.x);
    let dy = Math.abs(coords.y - reference.y);
    let dz = Math.abs(coords.z - reference.z);

    if (dx > MAX_DEVIATION || dy > MAX_DEVIATION || dz > MAX_DEVIATION) {
      console.log(`⚠️ [${process.pid}] КОРРЕКЦИЯ: отклонение (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}) > ${MAX_DEVIATION}`);
      coords.x = reference.x;
      coords.y = reference.y;
      coords.z = reference.z;
    } else {
      console.log(`✅ [${process.pid}] Ориентация стабильна: (${coords.x.toFixed(2)}, ${coords.y.toFixed(2)}, ${coords.z.toFixed(2)})`);
    }

    await client.hSet('coords', 'x', coords.x, 'y', coords.y, 'z', coords.z);
  } catch (err) {
    console.error(`❌ Ошибка orientation (PID ${process.pid}):`, err);
    // Симуляция отказа для демонстрации
    if (Math.random() < 0.01) throw new Error('Сбой датчика ориентации!');
  }
}

setInterval(correctOrientation, 500);
console.log(`🛰️ Orientation worker ${process.pid} запущен`);