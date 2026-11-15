import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spectrum } from '@/components/Spectrum';
import { VolumeKnob } from '@/components/VolumeKnob';
import { cn } from '@/lib/utils';
import type { ServerStatus } from '@/hooks/useVoiceServer';
import type { WakeWordStatus } from '@/hooks/useWakeWord';

type Props = {
  status: WakeWordStatus;
  stream: MediaStream | null; // the live mic input, once listening
  recording: boolean; // recording a command after the wake word
  serverStatus: ServerStatus;
  onOpenSettings: () => void;
};

const STATUS_TEXT: Partial<Record<WakeWordStatus, string>> = {
  'no-mic': 'No microphone access. Check Settings.',
  failed: "Couldn't start listening. See the console.",
};

export function PlayerPage({
  status,
  stream,
  recording,
  serverStatus,
  onOpenSettings,
}: Props) {
  const message =
    STATUS_TEXT[status] ??
    (serverStatus === 'disconnected' ? "Can't reach the voice server." : undefined);

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

      {/* The circle stays centred; the spectrum and messages hang below it */}
      <div className="relative">
        <div
          data-recording={recording}
          className={cn(
            'size-16 rounded-full bg-primary outline-3 outline-offset-4 outline-transparent transition-[outline-color] duration-300',
            recording && 'outline-blue-500',
          )}
        />
        <div className="absolute top-full left-1/2 mt-4 -translate-x-1/2">
          {stream && <Spectrum stream={stream} className="h-5" />}
          {message && (
            <p className="text-xs whitespace-nowrap text-destructive">
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
