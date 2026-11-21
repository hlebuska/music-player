// Runs inside the YouTube Music page. Controls the page's <video> element
// rather than YouTube's buttons, which change with every redesign.
import { ipcRenderer } from 'electron';
import { PLAYER_CHANNEL, type PlayerCommand } from './shared/player';

const DUCK_FACTOR = 0.2;

let volume: number | null = null;
let ducked = false;
// YouTube Music's own volume (0..1), saved while ducked if we never set one
let pageVolume: number | null = null;

function video() {
  return document.querySelector('video');
}

function applyVolume() {
  const element = video();
  const level = volume !== null ? volume / 100 : pageVolume;
  if (element && level !== null) {
    element.volume = ducked ? level * DUCK_FACTOR : level;
  }
}

ipcRenderer.on(PLAYER_CHANNEL, (_event, command: PlayerCommand) => {
  switch (command.type) {
    case 'pause':
      video()?.pause();
      break;
    case 'resume':
      video()
        ?.play()
        .catch((error) => console.error('resume failed', error));
      break;
    case 'volume':
      volume = command.level;
      applyVolume();
      break;
    case 'duck':
      if (command.on === ducked) break;
      if (command.on && volume === null) pageVolume = video()?.volume ?? null;
      ducked = command.on;
      applyVolume();
      if (!ducked) pageVolume = null;
      break;
  }
});

// YouTube Music resets the volume to its own setting when a track starts.
// Media events don't bubble, so this listens in the capture phase.
document.addEventListener('playing', applyVolume, true);
