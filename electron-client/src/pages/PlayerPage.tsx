import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VolumeKnob } from '@/components/VolumeKnob';

type Props = {
  onOpenSettings: () => void;
};

export function PlayerPage({ onOpenSettings }: Props) {
  return (
    <main className="relative flex h-screen items-center justify-center">
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <VolumeKnob />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          className="text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings />
        </Button>
      </div>

      <div className="size-16 rounded-full bg-primary" />
    </main>
  );
}
