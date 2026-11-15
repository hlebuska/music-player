import { useEffect, useRef, useState } from 'react';

// Records from the wake word's already-open stream, so the mic stays on for it
export function useRecorder(onRecorded: (clip: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  function start(stream: MediaStream, maxMs: number) {
    if (recorderRef.current) return;

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      setRecording(false);
      onRecordedRef.current(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    timerRef.current = setTimeout(stop, maxMs);
  }

  function stop() {
    clearTimeout(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  useEffect(() => stop, []);

  return { recording, start, stop };
}
