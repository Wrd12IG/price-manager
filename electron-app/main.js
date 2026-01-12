const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

// Configurazione
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let isQuitting = false;
let nodePath = null;
let npmPath = null;

// ============================================================================
// FUNZIONI PER TROVARE NODE.JS SU WINDOWS
// ============================================================================

function findNodeOnWindows() {
    if (process.platform !== 'win32') return null;
    
    const possiblePaths = [
        // Installazione standard
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        // NVM for Windows
        path.join(process.env.APPDATA || '', 'nvm'),
        path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'nvm'),
        path.join(process.env.NVM_HOME || '', ''),
        // Chocolatey
        'C:\\ProgramData\\chocolatey\\lib\\nodejs\\tools\\node',
        // Scoop
        path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'nodejs', 'current'),
        // fnm
        path.join(process.env.USERPROFILE || '', '.fnm', 'node-versions'),
        // Portable
        path.join(process.env.USERPROFILE || '', 'nodejs'),
        // Volta
        path.join(process.env.USERPROFILE || '', '.volta', 'bin'),
    ];

    // Cerca nelle directory comuni
    for (const dir of possiblePaths) {
        if (!dir || dir === '') continue;
        
        if (fs.existsSync(dir)) {
            // Cerca node.exe direttamente
            const nodeExe = path.join(dir, 'node.exe');
            if (fs.existsSync(nodeExe)) {
                console.log(`Node trovato in: ${dir}`);
                return dir;
            }
            // Cerca nelle sottocartelle (per nvm)
            try {
                const subDirs = fs.readdirSync(dir);
                for (const subDir of subDirs) {
                    const subPath = path.join(dir, subDir);
                    const subNodeExe = path.join(subPath, 'node.exe');
                    if (fs.existsSync(subNodeExe)) {
                        console.log(`Node trovato in: ${subPath}`);
                        return subPath;
                    }
                }
            } catch (e) {
                // Ignora errori di lettura directory
            }
        }
    }

    // Prova a trovarlo nel PATH usando where
    try {
        const result = execSync('where node', { encoding: 'utf8', timeout: 5000 });
        const nodeBin = result.split('\n')[0].trim();
        if (nodeBin && fs.existsSync(nodeBin)) {
            const nodeDir = path.dirname(nodeBin);
            console.log(`Node trovato nel PATH: ${nodeDir}`);
            return nodeDir;
        }
    } catch (e) {
        console.log('Node non trovato con where command');
    }

    return null;
}

function setupWindowsEnvironment() {
    if (process.platform !== 'win32') return true;

    const nodeDir = findNodeOnWindows();
    if (!nodeDir) {
        console.error('Node.js non trovato su Windows');
        return false;
    }

    nodePath = path.join(nodeDir, 'node.exe');
    npmPath = path.join(nodeDir, 'npm.cmd');

    // Aggiungi al PATH
    const currentPath = process.env.PATH || '';
    if (!currentPath.toLowerCase().includes(nodeDir.toLowerCase())) {
        process.env.PATH = `${nodeDir};${currentPath}`;
        console.log(`PATH aggiornato con: ${nodeDir}`);
    }

    return true;
}

// ============================================================================
// PERCORSI APP
// ============================================================================

function getAppPath() {
    if (isDev) {
        return path.join(__dirname, '..');
    }
    return path.join(process.resourcesPath, 'app');
}

// ============================================================================
// SPLASH SCREEN
// ============================================================================

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 450,
        height: 350,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
}

// ============================================================================
// FINESTRA PRINCIPALE
// ============================================================================

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'E-commerce Price Manager',
        backgroundColor: '#1a1a2e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                { label: 'Ricarica', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
                { type: 'separator' },
                { label: 'Esci', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }
            ]
        },
        {
            label: 'Modifica',
            submenu: [
                { label: 'Annulla', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Ripeti', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Taglia', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copia', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Incolla', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: 'Visualizza',
            submenu: [
                { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { label: 'Zoom Reset', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Schermo intero', accelerator: 'F11', role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
            ]
        },
        {
            label: 'Aiuto',
            submenu: [
                { label: 'Informazioni', click: () => showAboutDialog() },
                { type: 'separator' },
                { label: 'Apri Backend API', click: () => shell.openExternal(BACKEND_URL) }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http') && !url.includes('localhost')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function showAboutDialog() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'E-commerce Price Manager',
        message: 'E-commerce Price Manager',
        detail: `Versione: 1.0.0\n\nSistema completo di gestione automatizzata dei listini per e-commerce.\n\n© 2024 W[r]Digital`,
        buttons: ['OK']
    });
}

// ============================================================================
// SYSTEM TRAY
// ============================================================================

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    
    if (!fs.existsSync(iconPath)) {
        console.log('Icona tray non trovata, skip');
        return;
    }

    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Apri Price Manager', click: () => { mainWindow.show(); mainWindow.focus(); } },
        { type: 'separator' },
        { label: 'Riavvia Server', click: () => restartServers() },
        { type: 'separator' },
        { label: 'Esci', click: () => { isQuitting = true; app.quit(); } }
    ]);

    tray.setToolTip('E-commerce Price Manager');
    tray.setContextMenu(contextMenu);
    
    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

// ============================================================================
// CONTROLLO SERVER
// ============================================================================

function checkServerHealth(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// ============================================================================
// INSTALLAZIONE DIPENDENZE
// ============================================================================

async function installDependencies(appPath) {
    const npmCommand = process.platform === 'win32' ? (npmPath || 'npm.cmd') : 'npm';
    
    const dirs = [
        appPath,
        path.join(appPath, 'backend'),
        path.join(appPath, 'frontend')
    ];

    for (const dir of dirs) {
        const nodeModulesPath = path.join(dir, 'node_modules');
        const packageJsonPath = path.join(dir, 'package.json');

        if (fs.existsSync(packageJsonPath) && !fs.existsSync(nodeModulesPath)) {
            console.log(`Installazione dipendenze in: ${dir}`);
            
            await new Promise((resolve, reject) => {
                const installProcess = spawn(npmCommand, ['install'], {
                    cwd: dir,
                    shell: true,
                    stdio: 'pipe',
                    env: process.env
                });

                installProcess.stdout.on('data', (data) => {
                    console.log(`npm: ${data}`);
                });

                installProcess.stderr.on('data', (data) => {
                    console.error(`npm error: ${data}`);
                });

                installProcess.on('error', (err) => {
                    console.error(`Errore npm install in ${dir}:`, err);
                    reject(err);
                });

                installProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(`Dipendenze installate in: ${dir}`);
                        resolve();
                    } else {
                        reject(new Error(`npm install fallito in ${dir} con codice ${code}`));
                    }
                });
            });
        }
    }
}

// ============================================================================
// AVVIO SERVER
// ============================================================================

function startBackend(appPath) {
    return new Promise((resolve, reject) => {
        const npmCommand = process.platform === 'win32' ? (npmPath || 'npm.cmd') : 'npm';
        const backendPath = path.join(appPath, 'backend');
        
        console.log(`Avvio backend da: ${backendPath}`);
        
        backendProcess = spawn(npmCommand, ['run', 'dev'], {
            cwd: backendPath,
            shell: true,
            stdio: 'pipe',
            env: { ...process.env, BROWSER: 'none' }
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend: ${data}`);
            if (data.toString().includes('listening') || data.toString().includes('3000')) {
                resolve();
            }
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend Error: ${data}`);
        });

        backendProcess.on('error', (error) => {
            console.error('Errore avvio backend:', error);
            reject(error);
        });

        // Timeout
        setTimeout(() => resolve(), 10000);
    });
}

function startFrontend(appPath) {
    return new Promise((resolve, reject) => {
        const npmCommand = process.platform === 'win32' ? (npmPath || 'npm.cmd') : 'npm';
        const frontendPath = path.join(appPath, 'frontend');
        
        console.log(`Avvio frontend da: ${frontendPath}`);
        
        frontendProcess = spawn(npmCommand, ['run', 'dev'], {
            cwd: frontendPath,
            shell: true,
            stdio: 'pipe',
            env: { ...process.env, BROWSER: 'none' }
        });

        frontendProcess.stdout.on('data', (data) => {
            console.log(`Frontend: ${data}`);
            if (data.toString().includes('ready') || data.toString().includes('5173') || data.toString().includes('Local')) {
                resolve();
            }
        });

        frontendProcess.stderr.on('data', (data) => {
            console.error(`Frontend Error: ${data}`);
        });

        frontendProcess.on('error', (error) => {
            console.error('Errore avvio frontend:', error);
            reject(error);
        });

        // Timeout
        setTimeout(() => resolve(), 15000);
    });
}

async function restartServers() {
    stopServers();
    const appPath = getAppPath();
    await startBackend(appPath);
    await startFrontend(appPath);
    if (mainWindow) {
        mainWindow.reload();
    }
}

function stopServers() {
    if (backendProcess) {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${backendProcess.pid} /T /F`);
        } else {
            backendProcess.kill('SIGTERM');
        }
        backendProcess = null;
    }
    
    if (frontendProcess) {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${frontendProcess.pid} /T /F`);
        } else {
            frontendProcess.kill('SIGTERM');
        }
        frontendProcess = null;
    }
}

async function waitForServer(url, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const isReady = await checkServerHealth(url);
        if (isReady) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

// ============================================================================
// INIZIALIZZAZIONE APP
// ============================================================================

app.whenReady().then(async () => {
    createSplashWindow();
    createMainWindow();

    try {
        // Configura ambiente Windows (cerca Node.js)
        if (process.platform === 'win32') {
            const nodeFound = setupWindowsEnvironment();
            if (!nodeFound) {
                if (splashWindow) splashWindow.close();
                dialog.showErrorBox(
                    'Node.js Non Trovato',
                    'Node.js non è stato trovato sul sistema.\n\n' +
                    'Per favore installa Node.js da:\nhttps://nodejs.org/\n\n' +
                    'Scarica la versione LTS (20.x o superiore).\n' +
                    'Dopo l\'installazione, riavvia l\'applicazione.'
                );
                app.quit();
                return;
            }
        }

        const appPath = getAppPath();
        console.log(`App path: ${appPath}`);

        // Verifica e installa dipendenze se necessario
        try {
            await installDependencies(appPath);
        } catch (err) {
            console.error('Errore installazione dipendenze:', err);
        }

        // Controlla se i server sono già in esecuzione
        const backendRunning = await checkServerHealth(BACKEND_URL);
        const frontendRunning = await checkServerHealth(FRONTEND_URL);

        if (!backendRunning) {
            console.log('Avvio backend...');
            await startBackend(appPath);
        }

        if (!frontendRunning) {
            console.log('Avvio frontend...');
            await startFrontend(appPath);
        }

        // Attendi che i server siano pronti
        console.log('Attendo che i server siano pronti...');
        const frontendReady = await waitForServer(FRONTEND_URL, 60);

        if (!frontendReady) {
            if (splashWindow) splashWindow.close();
            dialog.showErrorBox(
                'Errore Avvio',
                'Impossibile avviare i server.\n\n' +
                'Verifica che Node.js sia installato correttamente e riprova.'
            );
            app.quit();
            return;
        }

        // Carica l'app
        await mainWindow.loadURL(FRONTEND_URL);
        
        // Crea tray dopo che tutto è pronto
        createTray();

        // Chiudi splash e mostra finestra principale
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }

        mainWindow.show();
        mainWindow.focus();

    } catch (error) {
        console.error('Errore inizializzazione:', error);
        if (splashWindow) splashWindow.close();
        dialog.showErrorBox('Errore', `Impossibile avviare l'applicazione:\n\n${error.message}`);
        app.quit();
    }
});

// ============================================================================
// GESTIONE CHIUSURA
// ============================================================================

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('will-quit', () => {
    stopServers();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    } else {
        mainWindow.show();
    }
});
