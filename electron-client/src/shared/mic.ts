// Shared by main, preload and the page: the names of the IPC channels and the
// shape of the API the page sees as `window.mic`.

export type MicStatus =
  | 'not-determined' // never asked
  | 'granted'
  | 'denied' // the user said no; only System Settings can change it now
  | 'restricted' // blocked by the OS, e.g. parental controls or company policy
  | 'unknown';

export type MicApi = {
  getStatus: () => Promise<MicStatus>;
  request: () => Promise<MicStatus>;
  openSystemSettings: () => Promise<void>;
};

export const MIC_CHANNELS = {
  getStatus: 'mic:get-status',
  request: 'mic:request',
  openSystemSettings: 'mic:open-system-settings',
} as const;
