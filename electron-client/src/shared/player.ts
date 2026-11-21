// Shared by main, both preloads and the page: the server's player commands and
// the IPC channel that carries them to the YouTube Music window.

export type PlayerCommand =
  | { type: 'play'; videoId: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'volume'; level: number } // 0–100
  | { type: 'duck'; on: boolean }; // from the page while it records, never the server

export type PlayerApi = {
  send: (command: PlayerCommand) => void;
};

export const PLAYER_CHANNEL = 'player:command';

const COMMAND_TYPES = new Set(['play', 'pause', 'resume', 'volume']);

export function isPlayerCommand(message: {
  type: string;
}): message is PlayerCommand {
  return COMMAND_TYPES.has(message.type);
}
