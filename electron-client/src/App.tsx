import { useState } from 'react';
import { PlayerPage } from '@/pages/PlayerPage';
import { SettingsPage } from '@/pages/SettingsPage';

type Page = 'player' | 'settings';

export function App() {
  const [page, setPage] = useState<Page>('player');

  if (page === 'settings') {
    return <SettingsPage onBack={() => setPage('player')} />;
  }
  return <PlayerPage onOpenSettings={() => setPage('settings')} />;
}
