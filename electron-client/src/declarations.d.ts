/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

// Added to the page by preload.ts
interface Window {
  mic: import('./shared/mic').MicApi;
}
