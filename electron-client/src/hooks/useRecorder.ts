import { useRef, useState } from 'react';
import { getSavedDevice, SYSTEM_DEFAULT } from '@/lib/audioDevices';

// Records one clip from the microphone: start() turns the mic on, stop() turns
// it off and hands the finished clip to onRecorded. While recording, `stream`
// is the live mic input (used to draw the spectrum).
export function useRecorder(onRecorded: (clip: Blob) => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  async function start() {
    setError(null);
    const deviceId = getSavedDevice('audioinput');
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        // Echo cancellation keeps the music out of the mic; the server only needs mono
        audio: {
          // A plain deviceId (not { exact }) falls back to another mic if the
          // chosen one was unplugged, instead of failing
          ...(deviceId !== SYSTEM_DEFAULT && { deviceId }),
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch {
      setError('No microphone access. Check Settings.');
      return;
    }

    // WebM/Opus by default, which the server's Whisper decodes directly
    const recorder = new MediaRecorder(mic);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      mic.getTracks().forEach((track) => track.stop()); // mic indicator off
      setStream(null);
      onRecorded(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.start();
    recorderRef.current = recorder;
    setStream(mic);
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  return { recording: stream !== null, stream, error, start, stop };
}
