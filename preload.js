// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // --- Invoke methods (Renderer -> Main -> Renderer) ---

  // Send project idea to main process for plan generation
  generatePlan: (projectIdea) => ipcRenderer.invoke('generate-plan', projectIdea),

  // Request to export the generated plan content to a file
  exportPlan: (planContent) => ipcRenderer.invoke('export-plan', planContent),

  // Request to save generated config files
  saveConfigFiles: (configFiles) => ipcRenderer.invoke('save-config-files', configFiles),

  // --- Send methods (Renderer -> Main) ---
  // (Could add one-way messages if needed, e.g., notifications)

  // --- On methods (Main -> Renderer) ---
  // Example: Handle updates or messages pushed from main process
  // handlePlanUpdate: (callback) => ipcRenderer.on('plan-update', (_event, value) => callback(value))
  // We will primarily use invoke for request/response in this simple app.
});

console.log('Preload script loaded.');