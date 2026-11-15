// Runs before the page loads, with access to Electron's IPC. contextBridge copies
// only the functions listed here into the page as `window.mic`; the page itself
// never gets Node.js or ipcRenderer.
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { MIC_CHANNELS, type MicApi } from './shared/mic';

const mic: MicApi = {
  getStatus: () => ipcRenderer.invoke(MIC_CHANNELS.getStatus),
  request: () => ipcRenderer.invoke(MIC_CHANNELS.request),
  openSystemSettings: () => ipcRenderer.invoke(MIC_CHANNELS.openSystemSettings),
};

contextBridge.exposeInMainWorld('mic', mic);
