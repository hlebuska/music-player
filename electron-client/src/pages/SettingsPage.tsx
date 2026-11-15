import { useEffect, useState } from 'react';
import { ArrowLeft, Mic, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <main className="flex h-screen flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-center gap-2">
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

      <MicrophoneCard {...micStatus} />
      {/* Remount when the permission changes: device names only appear once
          the mic is allowed, so the list has to be read again */}
      <SpeakerCard key={micStatus.status} />
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

type MicrophoneCardProps = ReturnType<typeof useMicStatus>;

function MicrophoneCard({ status, requesting, request }: MicrophoneCardProps) {
  const blocked = status === 'denied' || status === 'restricted';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Microphone</CardTitle>
        <CardDescription>Needed to hear your voice commands.</CardDescription>
        <CardAction className="text-sm text-muted-foreground">
          {status ? STATUS_TEXT[status] : 'Checking…'}
        </CardAction>
      </CardHeader>

      {status === 'granted' ? (
        <CardContent>
          <DeviceSelect kind="audioinput" label="Microphone" />
        </CardContent>
      ) : (
        <CardFooter>
          {blocked ? (
            // After a "no", the OS won't ask again; only System Settings can change it
            <Button
              variant="outline"
              onClick={() => window.mic.openSystemSettings()}
            >
              <Settings />
              Open System Settings
            </Button>
          ) : (
            <Button onClick={request} disabled={status === null || requesting}>
              <Mic />
              Allow microphone
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function SpeakerCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Speaker</CardTitle>
        <CardDescription>Where the music plays.</CardDescription>
      </CardHeader>
      <CardContent>
        <DeviceSelect kind="audiooutput" label="Speaker" />
      </CardContent>
    </Card>
  );
}

function DeviceSelect({ kind, label }: { kind: DeviceKind; label: string }) {
  const devices = useAudioDevices(kind);
  const [selected, setSelected] = useState(() => getSavedDevice(kind));

  // A saved device that is unplugged right now still shows as the choice, so
  // it comes back by itself when plugged in again; meanwhile the system
  // default is used
  const missing =
    selected !== SYSTEM_DEFAULT && !devices.some((d) => d.id === selected);

  function choose(deviceId: string) {
    setSelected(deviceId);
    saveDevice(kind, deviceId);
  }

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
