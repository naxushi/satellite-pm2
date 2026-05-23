const { execSync } = require('child_process');
execSync('npm init -y', {cwd: './desktop-installer'});
execSync('npm install electron electron-builder --save-dev', {cwd: './desktop-installer'});
// Создаём main.js и package.json для electron
// (упрощённо: копируем web-dashboard в electron приложение)