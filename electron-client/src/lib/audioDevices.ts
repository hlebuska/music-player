import { useEffect, useState } from 'react';

// Which microphone and speaker the user picked in Settings. Kept in
// localStorage, so the choice survives restarts. 'default' means "whatever
// the system uses", which also follows the user when they plug in headphones.

export type DeviceKind = 'audioinput' | 'audiooutput';

export const SYSTEM_DEFAULT = 'default';

const STORAGE_KEY: Record<DeviceKind, string> = {
  audioinput: 'audio.inputDeviceId',
  audiooutput: 'audio.outputDeviceId',
};

export function getSavedDevice(kind: DeviceKind): string {
  return localStorage.getItem(STORAGE_KEY[kind]) ?? SYSTEM_DEFAULT;
}

export function saveDevice(kind: DeviceKind, deviceId: string) {
  localStorage.setItem(STORAGE_KEY[kind], deviceId);
}

export type AudioDevice = { id: string; label: string };

// Lists the devices of one kind and keeps the list current as devices are
// plugged in or out. Names are only visible after the mic permission is granted;
// before that the browser hides them, so we number the devices instead.
export function useAudioDevices(kind: DeviceKind): AudioDevice[] {
  const [devices, setDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    const noun = kind === 'audioinput' ? 'Microphone' : 'Speaker';

    async function refresh() {
      const all = await navigator.mediaDevices.enumerateDevices();
      const list = all
        .filter((d) => d.kind === kind)
        // Chromium adds its own "default" and "communications" entries, which
        // duplicate a real device; we offer our own "System default" instead
        .filter(
          (d) => d.deviceId !== 'default' && d.deviceId !== 'communications',
        )
        .map((d, i) => ({
          id: d.deviceId,
          label: d.label || `${noun} ${i + 1}`,
        }));
      setDevices(list);
    }

    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () =>
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, [kind]);

  return devices;
}
