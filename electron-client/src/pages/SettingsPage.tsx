import { type ReactNode, useEffect, useState } from 'react';
import { ArrowLeft, Mic, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type DeviceKind,
  getSavedDevice,
  saveDevice,
  SYSTEM_DEFAULT,
  useAudioDevices,
} from '@/lib/audioDevices';
import type { MicStatus } from '@/shared/mic';

type Props = {
  onBack: () => void;
};

export function SettingsPage({ onBack }: Props) {
  const micStatus = useMicStatus();

  return (
    <main className="flex h-screen flex-col overflow-y-auto">
      <header className="flex items-center gap-2 border-b px-6 py-4">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          className="text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <h1 className="text-lg font-medium">Settings</h1>
      </header>

      <div className="flex flex-col divide-y px-6 py-4">
        <MicrophoneSection {...micStatus} />
        {/* Remount when the permission changes: device names only appear once
            the mic is allowed, so the list has to be read again. Wait for
            the first status so it doesn't load twice and flash */}
        <SpeakerSection
          key={micStatus.status}
          loading={micStatus.status === null}
        />
      </div>
    </main>
  );
}

const STATUS_TEXT: Record<MicStatus, string> = {
  'not-determined': 'Not requested',
  granted: 'Allowed',
  denied: 'Blocked',
  restricted: 'Blocked by system',
  unknown: 'Unknown',
};

function useMicStatus() {
  // null until the first answer from the main process arrives
  const [status, setStatus] = useState<MicStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const refresh = () => window.mic.getStatus().then(setStatus);
    refresh();
    // Re-check when the window gets focus again, e.g. after the user
    // changed the permission in System Settings
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function request() {
    setRequesting(true);
    try {
      setStatus(await window.mic.request());
    } finally {
      setRequesting(false);
    }
  }

  return { status, requesting, request };
}

type SectionProps = {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
};

function SettingsSection({ title, description, aside, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

type MicrophoneSectionProps = ReturnType<typeof useMicStatus>;

function MicrophoneSection({
  status,
  requesting,
  request,
}: MicrophoneSectionProps) {
  const blocked = status === 'denied' || status === 'restricted';

  return (
    <SettingsSection
      title="Microphone"
      description="Needed to hear your voice commands."
      aside={status ? STATUS_TEXT[status] : 'Checking…'}
    >
      {status === null ? (
        // Still asking the main process; don't flash the "Allow" button
        <SelectSkeleton />
      ) : status === 'granted' ? (
        <DeviceSelect kind="audioinput" label="Microphone" />
      ) : blocked ? (
        // After a "no", the OS won't ask again; only System Settings can change it
        <Button
          variant="outline"
          className="self-start"
          onClick={() => window.mic.openSystemSettings()}
        >
          <Settings />
          Open System Settings
        </Button>
      ) : (
        <Button
          className="self-start"
          onClick={request}
          disabled={requesting}
        >
          <Mic />
          Allow microphone
        </Button>
      )}
    </SettingsSection>
  );
}

function SpeakerSection({ loading }: { loading: boolean }) {
  return (
    <SettingsSection title="Speaker" description="Where the music plays.">
      {loading ? (
        <SelectSkeleton />
      ) : (
        <DeviceSelect kind="audiooutput" label="Speaker" />
      )}
    </SettingsSection>
  );
}

function DeviceSelect({ kind, label }: { kind: DeviceKind; label: string }) {
  const devices = useAudioDevices(kind);
  const [selected, setSelected] = useState(() => getSavedDevice(kind));

  function choose(deviceId: string) {
    setSelected(deviceId);
    saveDevice(kind, deviceId);
  }

  // Until the list is read we can't tell whether the saved device is plugged
  // in, so show a placeholder instead of briefly showing "Unplugged device"
  if (!devices) return <SelectSkeleton />;

  // A saved device that is unplugged right now still shows as the choice, so
  // it comes back by itself when plugged in again; meanwhile the system
  // default is used
  const missing =
    selected !== SYSTEM_DEFAULT && !devices.some((d) => d.id === selected);

  return (
    <Select value={selected} onValueChange={choose}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SYSTEM_DEFAULT}>System default</SelectItem>
        {devices.map((device) => (
          <SelectItem key={device.id} value={device.id}>
            {device.label}
          </SelectItem>
        ))}
        {missing && (
          <SelectItem value={selected} disabled>
            Unplugged device
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// Same size as the select trigger, so nothing jumps when it loads
function SelectSkeleton() {
  return <Skeleton className="h-8 w-full rounded-lg" />;
}
