// Runs inside the YouTube Music page. Controls the page's <video> element
// rather than YouTube's buttons, which change with every redesign.
import { ipcRenderer } from 'electron';
import { PLAYER_CHANNEL, type PlayerCommand } from './shared/player';

let volume: number | null = null;

function video() {
  return document.querySelector('video');
}

function applyVolume() {
  const element = video();
  if (element && volume !== null) element.volume = volume / 100;
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
  }
});

// YouTube Music resets the volume to its own setting when a track starts.
// Media events don't bubble, so this listens in the capture phase.
document.addEventListener('playing', applyVolume, true);
