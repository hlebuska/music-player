/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

// Added to the page by preload.ts
interface Window {
  mic: import('./shared/mic').MicApi;
  player: import('./shared/player').PlayerApi;
}

interface ImportMetaEnv {
  readonly VITE_VOICE_SERVER_URL: string;
  readonly VITE_CLIENT_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
