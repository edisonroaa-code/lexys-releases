import { app, BrowserWindow, shell, ipcMain, session, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { release } from 'os';
import { join } from 'path';

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

let win: BrowserWindow | null = null;

// Preload path based on environment
const PRELOAD_PATH = process.env.VITE_DEV_SERVER_URL
    ? join(process.cwd(), 'src', 'renderer', 'dist-electron', 'preload.js')
    : join(__dirname, 'preload.js');

// CSP applied via headers (frame-ancestors is ignored in meta tags)
const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com",
    "font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com",
    "connect-src 'self' https://qtigmnjctvpyafxqxlow.supabase.co https://*.supabase.co https://*.supabase.in http://localhost:*",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join('; ');

console.log('=== ELECTRON STARTUP ===');
console.log('VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
console.log('PRELOAD_PATH:', PRELOAD_PATH);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());

app.whenReady().then(() => {
    // Enforce CSP via response headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
            },
        });
    });

    createWindow();
});

async function createWindow() {
    console.log('Creating window...');

    win = new BrowserWindow({
        title: 'LexSys PY',
        width: 1200,
        height: 800,
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        await win.loadURL(process.env.VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    } else {
        // In production, load from dist folder (asar root)
        // In production the app is bundled into dist-electron, so go one level up to reach dist/
        await win.loadFile(join(__dirname, '..', 'dist', 'index.html'));
    }

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.on('window-all-closed', () => {
    win = null;
    if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        allWindows[0].focus();
    } else {
        createWindow();
    }
});

// Example IPC handlers
ipcMain.handle('open-win', (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload: PRELOAD_PATH,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${arg}`);
    } else {
        childWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'), { hash: arg });
    }
});

function checkUpdates() {
    if (process.env.VITE_DEV_SERVER_URL) return;

    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Actualización Disponible',
            message: 'Hay una nueva versión de LexSys. ¿Deseas descargarla e instalarla?',
            buttons: ['Sí', 'No']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();
            }
        });
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Actualización Lista',
            message: 'La actualización se ha descargado. La aplicación se reiniciará para instalarla.',
            buttons: ['Reiniciar Ahora', 'Más Tarde']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('Error auto-updater:', err);
    });
}

app.whenReady().then(() => {
    checkUpdates();
});
