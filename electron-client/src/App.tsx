import { useEffect, useState } from 'react';
import { useRecorder } from '@/hooks/useRecorder';
import { useVoiceServer } from '@/hooks/useVoiceServer';
import { isPlayerCommand } from '@/shared/player';
import { useWakeWord } from '@/hooks/useWakeWord';
import { PlayerPage } from '@/pages/PlayerPage';
import { SettingsPage } from '@/pages/SettingsPage';

type Page = 'player' | 'settings';

export function App() {
  const [page, setPage] = useState<Page>('player');

  const server = useVoiceServer((message) => {
    console.log('server:', message);
    if (isPlayerCommand(message)) window.player.send(message);
  });

  const recorder = useRecorder((clip) => {
    const sent = server.send(clip);
    console.log(
      `${sent ? 'sent' : 'not connected, dropped'} ${Math.round(clip.size / 1024)} KB clip`,
    );
  });

  // Lives here, not in PlayerPage, so it keeps listening while settings is open
  const { status, stream } = useWakeWord(() => {
    console.log('wake word heard');
    if (stream) recorder.start(stream);
  }, recorder.feed);

  // Quieter music while recording, for both the end-of-speech detection and the STT
  useEffect(() => {
    window.player.send({ type: 'duck', on: recorder.recording });
  }, [recorder.recording]);

  if (page === 'settings') {
    return <SettingsPage onBack={() => setPage('player')} />;
  }
  return (
    <PlayerPage
      status={status}
      stream={stream}
      recording={recorder.recording}
      serverStatus={server.status}
      onOpenSettings={() => setPage('settings')}
    />
  );
}
