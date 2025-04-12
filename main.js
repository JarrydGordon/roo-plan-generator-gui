// main.js - Main process for the Roo Plan Generator GUI (Refactored)

require('dotenv').config(); // Load environment variables
const { app, BrowserWindow, dialog, ipcMain } = require('electron'); // Import dialog and ipcMain
const path = require('path');
const log = require('electron-log'); // Import electron-log
const { setupIpcHandlers } = require('./src/ipcHandlers'); // Import plan generation IPC setup
const llm = require('./src/llm'); // Import the llm module

// --- Configure electron-log ---
// Optional: Adjust log level, file logging, etc.
// By default, it logs to console and a file in the app data directory.
log.transports.file.level = 'info'; // Log info level and above to file
log.transports.console.level = 'info'; // Log info level and above to console
log.info('App starting...'); // Log app start

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Use a preload script
      contextIsolation: true, // Recommended for security
      nodeIntegration: false // Disable Node.js integration in the renderer
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools (optional, for development)
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  log.info('App ready, loading config and initializing LLM...');
  // Load configuration and initialize LLM *after* app is ready
  try {
      await llm.loadConfigAndInitialize();
      log.info('LLM configuration loaded and initialization attempted.');
  } catch (error) {
       log.error('Critical error during LLM load/init:', error);
       // Optionally show error dialog here if llm module doesn't handle it
       // dialog.showErrorBox('Initialization Failed', `Failed to initialize LLM: ${error.message}`);
       // app.quit(); // Consider quitting if LLM is essential
       // return;
  }


  // Check for critical initialization errors after loading
  // Note: llm.js now handles internal error state, callLLM will throw if needed.
  // We could add an explicit check here if llm.js exported a status getter.
  // For now, we proceed and let callLLM handle errors during runtime.

  createWindow();

  // Setup Plan Generation IPC handlers (includes API key handlers now)
  setupIpcHandlers(); // This function now logs internally

  log.info("All IPC Handlers setup via setupIpcHandlers.");

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  log.info('All windows closed.');
  if (process.platform !== 'darwin') {
    log.info('Quitting app (non-macOS).');
    app.quit();
  }
});

// Log uncaught exceptions in the main process
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  // Optionally attempt graceful shutdown or show error dialog
});

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
