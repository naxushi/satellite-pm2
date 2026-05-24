const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Начинаем сборку Desktop установщика...\n');

// Проверяем наличие иконки
const iconPath = path.join(__dirname, 'icon.ico');
if (!fs.existsSync(iconPath)) {
    console.log('⚠️ Иконка не найдена, создаём заглушку...');
    // Можно скачать иконку или пропустить
}

// Устанавливаем зависимости
console.log('📦 Устанавливаем зависимости...');
execSync('npm install', { stdio: 'inherit', cwd: __dirname });

// Собираем приложение
console.log('🔨 Собираем приложение...');
try {
    execSync('npm run build:win', { stdio: 'inherit', cwd: __dirname });
    console.log('\n✅ Сборка завершена!');
    console.log(`📁 Установщик находится в: ${path.join(__dirname, 'dist')}`);
} catch (err) {
    console.error('❌ Ошибка сборки:', err.message);
}