import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  onOpenSettings: () => void;
};

export function PlayerPage({ onOpenSettings }: Props) {
  return (
    <main className="relative flex h-screen items-center justify-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        className="absolute top-3 right-3 text-muted-foreground"
        onClick={onOpenSettings}
      >
        <Settings />
      </Button>

      <div className="size-16 rounded-full bg-primary" />
    </main>
  );
}
