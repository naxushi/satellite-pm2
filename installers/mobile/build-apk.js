const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// 1. Создаём временную папку для Cordova-проекта
const cordovaDir = './cordova_temp';
if (fs.existsSync(cordovaDir)) fs.removeSync(cordovaDir);
fs.mkdirSync(cordovaDir);
process.chdir(cordovaDir);

// 2. Создаём Cordova проект
execSync('cordova create satellite-app com.satellite.operator "Пульт спутника"', { stdio: 'inherit' });
process.chdir('satellite-app');

// 3. Добавляем платформу Android
execSync('cordova platform add android', { stdio: 'inherit' });

// 4. Копируем веб-интерфейс в www
fs.copySync('../../web-dashboard', './www', { overwrite: true });

// 5. Настраиваем config.xml
fs.copySync('../config.xml', './config.xml', { overwrite: true });

// 6. Добавляем плагин WebView (уже встроен)
execSync('cordova plugin add cordova-plugin-whitelist', { stdio: 'inherit' });

// 7. Сборка APK
console.log('🔨 Сборка APK...');
execSync('cordova build android --release', { stdio: 'inherit' });

// 8. Копируем APK в корень installers
const apkPath = './platforms/android/app/build/outputs/apk/release/app-release.apk';
if (fs.existsSync(apkPath)) {
    fs.copySync(apkPath, '../../satellite-operator.apk');
    console.log('✅ APK создан: installers/satellite-operator.apk');
} else {
    console.error('❌ Ошибка: APK не найден');
}