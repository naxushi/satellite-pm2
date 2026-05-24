const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let serverProcess;
let isShuttingDown = false;

// Определяем пути
const isDev = !app.isPackaged;
const resourcesPath = isDev ? path.join(__dirname, '../..') : process.resourcesPath;

// Создаём папку для логов
const logsDir = path.join(os.homedir(), '.satellite-control', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'icon.ico'),
        title: 'Спутник-ЦУП',
        backgroundColor: '#0a0f1e'
    });
    
    // Загружаем локальный сервер
    mainWindow.loadURL('http://localhost:3000');
    
    // Открываем внешние ссылки в браузере
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    
    // Обработка ошибок загрузки
    mainWindow.webContents.on('did-fail-load', () => {
        setTimeout(() => {
            if (mainWindow && !isShuttingDown) {
                mainWindow.loadURL('http://localhost:3000');
            }
        }, 3000);
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startServer() {
    return new Promise((resolve, reject) => {
        const serverPath = resourcesPath;
        
        // Запускаем command-module напрямую (без PM2 для простоты)
        serverProcess = spawn('node', ['modules/command-module/index.js'], {
            cwd: serverPath,
            env: { ...process.env, PORT: '3000' },
            stdio: 'pipe'
        });
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[SERVER] ${output}`);
            if (output.includes('запущен на порту 3000') || output.includes('listening on port 3000')) {
                resolve();
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            console.error(`[SERVER ERROR] ${data}`);
        });
        
        serverProcess.on('error', (err) => {
            console.error(`[SERVER PROCESS ERROR] ${err.message}`);
            reject(err);
        });
        
        // Таймаут на случай если сервер не запустился
        setTimeout(() => {
            resolve(); // Всё равно продолжаем
        }, 5000);
    });
}

function showErrorAndQuit(message) {
    dialog.showErrorBox('Ошибка запуска', message);
    app.quit();
}

app.whenReady().then(async () => {
    try {
        // Запускаем сервер
        await startServer();
        
        // Создаём окно
        createWindow();
        
        // Проверяем что сервер отвечает
        const http = require('http');
        const checkInterval = setInterval(() => {
            const req = http.get('http://localhost:3000/api/health', (res) => {
                if (res.statusCode === 200) {
                    // Сервер работает
                }
            });
            req.on('error', () => {
                if (mainWindow && !isShuttingDown) {
                    mainWindow.loadURL('data:text/html,<html><body style="background:#0a0f1e;color:#0f0;display:flex;justify-content:center;align-items:center;height:100vh;"><h1>⚠️ Сервер перезапускается...</h1><p>Пожалуйста, подождите</p></body></html>');
                }
            });
            req.end();
        }, 5000);
        
        app.on('before-quit', () => clearInterval(checkInterval));
        
    } catch (err) {
        showErrorAndQuit(`Не удалось запустить сервер: ${err.message}`);
    }
});

app.on('window-all-closed', () => {
    if (serverProcess && !isShuttingDown) {
        isShuttingDown = true;
        serverProcess.kill('SIGTERM');
        setTimeout(() => {
            if (serverProcess && !serverProcess.killed) {
                serverProcess.kill('SIGKILL');
            }
        }, 3000);
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Обработка неожиданного закрытия
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('SIGTERM', () => {
    if (serverProcess) serverProcess.kill();
    app.quit();
});