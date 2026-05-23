const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let pm2Process;
let redisProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    // Запускаем Redis
    redisProcess = exec('redis-server', (err) => {
        if (err) console.error('Redis error:', err);
    });
    
    // Запускаем PM2
    setTimeout(() => {
        pm2Process = exec('pm2 start ecosystem.config.js', { cwd: path.join(__dirname, '../../') }, (err) => {
            if (err) console.error('PM2 error:', err);
        });
        createWindow();
    }, 2000);
});

app.on('window-all-closed', () => {
    exec('pm2 stop all');
    if (redisProcess) redisProcess.kill();
    if (pm2Process) pm2Process.kill();
    if (process.platform !== 'darwin') app.quit();
});