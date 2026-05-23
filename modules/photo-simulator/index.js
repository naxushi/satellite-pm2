const redis = require('redis');

(async () => {
    const client = redis.createClient({ url: 'redis://localhost:6379' });
    await client.connect();
    
    const id = Date.now();
    const currentTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    
    // Создаём PNG с текстом времени (реальное изображение)
    const { createCanvas } = require('canvas');
    let imageBase64;
    
    try {
        // Пытаемся использовать canvas для генерации реального изображения
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext('2d');
        
        // Чёрный фон
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 800, 600);
        
        // Белый текст с датой и временем
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('🛰️ СПУТНИК', 400, 200);
        
        ctx.font = '32px monospace';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(currentTime, 400, 320);
        
        ctx.font = '24px monospace';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(`ID фото: ${id}`, 400, 420);
        
        ctx.fillStyle = '#888888';
        ctx.font = '18px monospace';
        ctx.fillText('Отказоустойчивая система на PM2', 400, 520);
        
        imageBase64 = canvas.toBuffer('image/png').toString('base64');
    } catch (err) {
        // Fallback: если canvas не установлен, используем текстовое представление
        console.log('Canvas не установлен, использую текстовое фото');
        imageBase64 = Buffer.from(`
╔════════════════════════════════════════╗
║           🛰️ СПУТНИК                    ║
║                                        ║
║         ${currentTime}                  ║
║                                        ║
║         ID: ${id}                        ║
║                                        ║
║   Отказоустойчивая система на PM2      ║
╚════════════════════════════════════════╝
        `).toString('base64');
    }
    
    // Проверка лимита (не более 5 фото)
    const existing = await client.keys('photo:*');
    if (existing.length >= 5) {
        console.log(`❌ Лимит 5 фото! Удалите старые через веб-пульт. Текущее количество: ${existing.length}`);
        process.exit(0);
    }
    
    // Сохраняем фото с временем
    await client.hSet(`photo:${id}`, 
        'timestamp', id.toString(),
        'image', imageBase64
    );
    
    console.log(`📷 ФОТО СОЗДАНО!`);
    console.log(`   ID: ${id}`);
    console.log(`   Время: ${currentTime}`);
    console.log(`   Всего фото: ${existing.length + 1}/5`);
    
    process.exit(0);
})();