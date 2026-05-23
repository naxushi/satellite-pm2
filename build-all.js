const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Начинаем сборку всех установщиков...\n');

// 1. Desktop (Electron)
console.log('📦 Сборка Desktop installer...');
process.chdir('./installers/desktop');
execSync('npm install', { stdio: 'inherit' });
execSync('npm run build', { stdio: 'inherit' });
console.log('✅ Desktop installer готов: installers/desktop/dist/\n');

// 2. Mobile (Cordova APK)
console.log('📱 Сборка Mobile APK...');
process.chdir('../mobile');
execSync('npm install', { stdio: 'inherit' });
execSync('npm run build', { stdio: 'inherit' });
console.log('✅ APK готов: installers/satellite-operator.apk\n');

// 3. Портативная версия
console.log('💼 Создание портативной версии...');
const portableDir = '../portable';
if (!fs.existsSync(portableDir)) fs.mkdirSync(portableDir);
fs.copyFileSync('../../start.bat', `${portableDir}/start.bat`);
fs.copyFileSync('../../ecosystem.config.js', `${portableDir}/ecosystem.config.js`);
console.log('✅ Портативная версия: installers/portable/\n');

console.log('🎉 Все установщики собраны!');