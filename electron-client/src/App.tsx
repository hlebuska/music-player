import { useRef, useState } from 'react';
import { useWakeWord } from '@/hooks/useWakeWord';
import { PlayerPage } from '@/pages/PlayerPage';
import { SettingsPage } from '@/pages/SettingsPage';

type Page = 'player' | 'settings';

const HEARD_MS = 3000; // how long the blue outline stays after the wake word

export function App() {
  const [page, setPage] = useState<Page>('player');
  const [heard, setHeard] = useState(false);
  const heardTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Lives here, not in PlayerPage, so it keeps listening while settings is open
  const { status, stream } = useWakeWord(() => {
    console.log('wake word heard');
    setHeard(true);
    clearTimeout(heardTimer.current); // heard again: restart the 3 s
    heardTimer.current = setTimeout(() => setHeard(false), HEARD_MS);
  });

  if (page === 'settings') {
    return <SettingsPage onBack={() => setPage('player')} />;
  }
  return (
    <PlayerPage
      status={status}
      stream={stream}
      heard={heard}
      onOpenSettings={() => setPage('settings')}
    />
  );
}
