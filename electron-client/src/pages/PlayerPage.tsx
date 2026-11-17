import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Face, type Point } from '@/components/Face';
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

const LOOK_AT_KNOB_MS = 1200; // after the last turn

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
    (serverStatus === 'disconnected'
      ? "Can't reach the voice server."
      : undefined);

  const knob = useLookOnTurn();

  return (
    <main className="relative flex h-screen items-center justify-center">
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <div ref={knob.ref}>
          <VolumeKnob onChange={knob.onChange} />
        </div>
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
        <Face
          state={recording ? 'alert' : 'idle'}
          lookAt={knob.point}
          className={cn(
            'outline-3 outline-offset-4 outline-transparent transition-[outline-color] duration-300',
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

// Gives the point to look at for a while after the watched control changes
function useLookOnTurn() {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const last = useRef<number>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The knob also reports its saved value on mount; only a real turn counts
  const onChange = useCallback((value: number) => {
    const turned = last.current !== undefined && value !== last.current;
    last.current = value;
    if (!turned || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setPoint((current) => current ?? center);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPoint(null), LOOK_AT_KNOB_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { ref, point, onChange };
}
