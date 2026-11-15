// Main process side of the microphone permission: only the main process can
// read the OS permission (systemPreferences) and open System Settings (shell).
import { ipcMain, shell, systemPreferences } from 'electron';
import { MIC_CHANNELS, type MicStatus } from './shared/mic';

const SETTINGS_URL: Partial<Record<NodeJS.Platform, string>> = {
  darwin:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  win32: 'ms-settings:privacy-microphone',
};

function getStatus(): MicStatus {
  // macOS and Windows have an OS-level microphone permission; Linux doesn't
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return systemPreferences.getMediaAccessStatus('microphone');
  }
  return 'granted';
}

export function registerMicPermissionHandlers() {
  ipcMain.handle(MIC_CHANNELS.getStatus, () => getStatus());

  ipcMain.handle(MIC_CHANNELS.request, async () => {
    // Shows the macOS prompt only the first time ('not-determined'); after a
    // "no" it returns false straight away and the user has to use System Settings
    if (process.platform === 'darwin') {
      await systemPreferences.askForMediaAccess('microphone');
    }
    return getStatus();
  });

  ipcMain.handle(MIC_CHANNELS.openSystemSettings, async () => {
    const url = SETTINGS_URL[process.platform];
    if (url) await shell.openExternal(url);
  });
}
