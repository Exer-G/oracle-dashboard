// Oracle Time Tracker - Electron Main Process
// Window management, system tray, IPC handlers for native APIs
// ============================================================

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let activityCounts = { keyboard: 0, mouse: 0, clicks: 0 };
let uiohookInstance = null;
let uiohookStarted = false;

// ============================================================
// APP ICON (generated programmatically)
// ============================================================
function createTrayIcon() {
    // Create a simple 32x32 icon programmatically (black square with TT)
    const size = 32;
    const canvas = Buffer.alloc(size * size * 4); // RGBA

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            // Black background with slight rounding
            const isCorner = (x < 3 && y < 3) || (x >= size-3 && y < 3) ||
                           (x < 3 && y >= size-3) || (x >= size-3 && y >= size-3);
            if (isCorner) {
                canvas[idx] = 0;     // R
                canvas[idx+1] = 0;   // G
                canvas[idx+2] = 0;   // B
                canvas[idx+3] = 0;   // A (transparent)
            } else {
                canvas[idx] = 20;    // R
                canvas[idx+1] = 20;  // G
                canvas[idx+2] = 25;  // B
                canvas[idx+3] = 255; // A
            }
        }
    }

    // Draw "TT" text in white (simple pixel font)
    const drawPixel = (x, y) => {
        if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 4;
            canvas[idx] = 255;
            canvas[idx+1] = 255;
            canvas[idx+2] = 255;
            canvas[idx+3] = 255;
        }
    };

    // T1: x=6-14, T2: x=18-26
    // Top bar of T1
    for (let x = 6; x <= 14; x++) { drawPixel(x, 9); drawPixel(x, 10); }
    // Stem of T1
    for (let y = 11; y <= 22; y++) { drawPixel(9, y); drawPixel(10, y); drawPixel(11, y); }
    // Top bar of T2
    for (let x = 18; x <= 26; x++) { drawPixel(x, 9); drawPixel(x, 10); }
    // Stem of T2
    for (let y = 11; y <= 22; y++) { drawPixel(21, y); drawPixel(22, y); drawPixel(23, y); }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ============================================================
// WINDOW CREATION
// ============================================================
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 900,
        minHeight: 600,
        title: 'Oracle Tracker',
        icon: createTrayIcon(),
        backgroundColor: '#f8f9fa',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        },
        show: false // Show after ready-to-show
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Open DevTools in development
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Minimize to tray instead of taskbar
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
        if (tray) {
            tray.displayBalloon({
                title: 'Oracle Tracker',
                content: 'Minimized to system tray. Timer continues running.'
            });
        }
    });

    // Intercept close → hide to tray (unless actually quitting)
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============================================================
// SYSTEM TRAY
// ============================================================
function createTray() {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip('Oracle Tracker - Idle');

    updateTrayMenu('idle');

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.focus();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function updateTrayMenu(timerState, elapsed) {
    const elapsedStr = elapsed || '0:00:00';
    const isRunning = timerState === 'running';

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Oracle Tracker',
            enabled: false
        },
        { type: 'separator' },
        {
            label: isRunning ? `Tracking: ${elapsedStr}` : 'Timer: Idle',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Open Tracker',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                if (uiohookStarted && uiohookInstance) {
                    try { uiohookInstance.stop(); } catch(e) {}
                }
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(isRunning ? `Oracle Tracker - Tracking: ${elapsedStr}` : 'Oracle Tracker - Idle');
}

// ============================================================
// IPC HANDLERS
// ============================================================
function setupIPC() {
    // ---- SCREENSHOT CAPTURE ----
    ipcMain.handle('screenshot:capture', async (event, quality) => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });

            if (sources.length === 0) {
                console.log('[Screenshot] No screen sources found');
                return null;
            }

            // Get the primary display source
            const primaryDisplay = screen.getPrimaryDisplay();
            const primarySource = sources.find(s => {
                // Match by display id or just use first screen
                return s.display_id === String(primaryDisplay.id);
            }) || sources[0];

            // Convert thumbnail to JPEG buffer
            const jpegQuality = Math.round((quality || 0.6) * 100);
            const jpegBuffer = primarySource.thumbnail.toJPEG(jpegQuality);

            // Convert to base64 data URL
            const base64 = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
            return base64;
        } catch (err) {
            console.error('[Screenshot] Capture error:', err);
            return null;
        }
    });

    // ---- ACTIVITY TRACKING ----
    ipcMain.handle('activity:start', async () => {
        if (uiohookStarted) return true;

        try {
            const { uIOhook, UiohookKey } = require('uiohook-napi');
            uiohookInstance = uIOhook;

            // Reset counts
            activityCounts = { keyboard: 0, mouse: 0, clicks: 0 };

            uiohookInstance.on('keydown', () => {
                activityCounts.keyboard++;
            });

            uiohookInstance.on('mousemove', () => {
                activityCounts.mouse++;
            });

            uiohookInstance.on('click', () => {
                activityCounts.clicks++;
            });

            uiohookInstance.start();
            uiohookStarted = true;
            console.log('[Activity] Global hooks started');
            return true;
        } catch (err) {
            console.error('[Activity] Failed to start uiohook:', err);
            // Fallback: return true but tracking will be limited
            return false;
        }
    });

    ipcMain.handle('activity:stop', async () => {
        if (uiohookInstance && uiohookStarted) {
            try {
                uiohookInstance.stop();
                uiohookInstance.removeAllListeners();
            } catch (err) {
                console.error('[Activity] Stop error:', err);
            }
        }
        uiohookStarted = false;
        activityCounts = { keyboard: 0, mouse: 0, clicks: 0 };
        console.log('[Activity] Global hooks stopped');
        return true;
    });

    ipcMain.handle('activity:get-counts', async () => {
        const counts = { ...activityCounts };
        // Reset window counters after reading
        activityCounts = { keyboard: 0, mouse: 0, clicks: 0 };
        return counts;
    });

    // ---- TRAY STATE ----
    ipcMain.on('tray:update-state', (event, data) => {
        if (tray) {
            updateTrayMenu(data.state, data.elapsed);
        }
    });

    // ---- OAUTH AUTH ----
    ipcMain.handle('auth:open-oauth', async (event, url) => {
        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 600,
                height: 700,
                parent: mainWindow,
                modal: true,
                title: 'Sign in with Google',
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false
                }
            });

            authWindow.loadURL(url);

            // Remove menu bar from auth window
            authWindow.setMenuBarVisibility(false);

            // Monitor URL changes for OAuth callback
            const handleNavigation = (navUrl) => {
                try {
                    const parsedUrl = new URL(navUrl);
                    const hash = parsedUrl.hash;

                    // Check if this is the OAuth callback with access_token
                    if (hash && hash.includes('access_token')) {
                        // Parse the hash fragment
                        const params = new URLSearchParams(hash.substring(1));
                        const accessToken = params.get('access_token');
                        const refreshToken = params.get('refresh_token');

                        if (accessToken) {
                            authWindow.close();
                            resolve({ accessToken, refreshToken });
                            return;
                        }
                    }

                    // Check for error in callback
                    if (parsedUrl.searchParams.has('error')) {
                        authWindow.close();
                        reject(new Error(parsedUrl.searchParams.get('error_description') || 'Auth failed'));
                    }
                } catch (e) {
                    // URL parsing failed, ignore
                }
            };

            authWindow.webContents.on('will-navigate', (e, navUrl) => {
                handleNavigation(navUrl);
            });

            authWindow.webContents.on('did-navigate', (e, navUrl) => {
                handleNavigation(navUrl);
            });

            authWindow.webContents.on('will-redirect', (e, navUrl) => {
                handleNavigation(navUrl);
            });

            authWindow.on('closed', () => {
                resolve(null); // User closed the window
            });
        });
    });
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(() => {
    createWindow();
    createTray();
    setupIPC();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // On Windows, keep app running in tray
    // Only quit if isQuitting flag is set
    if (isQuitting || process.platform !== 'win32') {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    if (uiohookStarted && uiohookInstance) {
        try { uiohookInstance.stop(); } catch(e) {}
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
