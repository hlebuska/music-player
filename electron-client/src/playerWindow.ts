// The YouTube Music window that plays the music. Commands come from the page
// over IPC; play navigates here, the rest go to playerPreload.ts.
import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { PLAYER_CHANNEL, type PlayerCommand } from './shared/player';

const MUSIC_URL = 'https://music.youtube.com';
const VIDEO_ID = /^[\w-]{11}$/;

// Google blocks sign-in from embedded Chromium, so the player poses as Firefox:
// Firefox's user agent, and without the Sec-CH-UA headers only Chromium sends
const FIREFOX_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0';

let playerWindow: BrowserWindow | null = null;
let volume: number | null = null;
let ducked = false;

// Visible for testing; will be hidden later
export function createPlayerWindow() {
  playerWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      partition: 'persist:ytmusic', // keeps the Google sign-in across restarts
      preload: path.join(__dirname, 'playerPreload.cjs'),
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });

  const { session } = playerWindow.webContents;
  session.setUserAgent(FIREFOX_USER_AGENT);
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = Object.fromEntries(
      Object.entries(details.requestHeaders).filter(
        ([name]) => !name.toLowerCase().startsWith('sec-ch-ua'),
      ),
    );
    callback({ requestHeaders });
  });

  // Every play is a new page, which starts from YouTube Music's own saved volume
  playerWindow.webContents.on('dom-ready', () => {
    if (volume !== null) {
      playerWindow?.webContents.send(PLAYER_CHANNEL, {
        type: 'volume',
        level: volume,
      });
    }
    if (ducked) {
      playerWindow?.webContents.send(PLAYER_CHANNEL, {
        type: 'duck',
        on: true,
      });
    }
  });
  playerWindow.on('closed', () => {
    playerWindow = null;
  });

  playerWindow.loadURL(MUSIC_URL);
  playerWindow.webContents.openDevTools();
}

export function registerPlayerHandlers() {
  ipcMain.on(PLAYER_CHANNEL, (_event, command: PlayerCommand) => {
    if (!playerWindow) return;
    switch (command.type) {
      case 'play':
        if (VIDEO_ID.test(command.videoId)) {
          playerWindow.loadURL(`${MUSIC_URL}/watch?v=${command.videoId}`);
        }
        break;
      case 'volume':
        volume = Math.max(0, Math.min(100, Number(command.level) || 0));
        playerWindow.webContents.send(PLAYER_CHANNEL, {
          type: 'volume',
          level: volume,
        });
        break;
      case 'duck':
        ducked = command.on === true;
        playerWindow.webContents.send(PLAYER_CHANNEL, {
          type: 'duck',
          on: ducked,
        });
        break;
      case 'pause':
      case 'resume':
        playerWindow.webContents.send(PLAYER_CHANNEL, { type: command.type });
        break;
    }
  });
}
