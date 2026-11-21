import { useEffect, useRef, useState } from 'react';
import { VoiceActivityDetector } from '@/vad/detector';
import { SAMPLE_RATE } from '@/wakeword/detector';

const MAX_MS = 12_000; // so a TV or a song with vocals can't keep it recording
const NO_VAD_MS = 6000; // fixed length when the VAD model failed to load
const NO_SPEECH_MS = 3000; // nobody spoke after the wake word: drop the clip
const MIN_SPEECH_MS = 240; // longer than the tail of the wake word itself
const SILENCE_MS = 800; // pause that ends the command
const SPEECH_START = 0.5;
const SPEECH_END = 0.35; // below SPEECH_START so pauses between words don't end it

type Take = {
  recorder: MediaRecorder;
  timer: ReturnType<typeof setTimeout>;
  queue: Promise<void>;
  elapsedMs: number;
  speechMs: number;
  silenceMs: number;
  heard: boolean;
  discard: boolean;
};

// Records from the wake word's already-open stream, so the mic stays on for it.
// Stops when the speaker goes quiet, judged from the same mic's chunks via feed().
export function useRecorder(onRecorded: (clip: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const takeRef = useRef<Take | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    let stopped = false;
    VoiceActivityDetector.create()
      .then((vad) => {
        if (!stopped) vadRef.current = vad;
      })
      .catch((error) => console.error('VAD failed to load', error));
    return () => {
      stopped = true;
      finish(true);
    };
  }, []);

  function start(stream: MediaStream) {
    if (takeRef.current) return;

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const take: Take = {
      recorder,
      timer: setTimeout(
        () => finish(false),
        vadRef.current ? MAX_MS : NO_VAD_MS,
      ),
      queue: Promise.resolve(),
      elapsedMs: 0,
      speechMs: 0,
      silenceMs: 0,
      heard: false,
      discard: false,
    };
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      setRecording(false);
      if (take.discard) {
        console.log('no speech after the wake word, clip dropped');
        return;
      }
      onRecordedRef.current(new Blob(chunks, { type: recorder.mimeType }));
    };
    vadRef.current?.reset();
    recorder.start();
    takeRef.current = take;
    setRecording(true);
  }

  function finish(discard: boolean) {
    const take = takeRef.current;
    if (!take) return;
    takeRef.current = null;
    take.discard = discard;
    clearTimeout(take.timer);
    take.recorder.stop();
  }

  function feed(chunk: Float32Array) {
    const take = takeRef.current;
    const vad = vadRef.current;
    if (!take || !vad) return;

    take.queue = take.queue.then(async () => {
      const probability = await vad.process(chunk);
      if (takeRef.current !== take || probability === null) return;

      const ms = (chunk.length / SAMPLE_RATE) * 1000;
      take.elapsedMs += ms;
      if (!take.heard) {
        take.speechMs = probability >= SPEECH_START ? take.speechMs + ms : 0;
        if (take.speechMs >= MIN_SPEECH_MS) take.heard = true;
        else if (take.speechMs === 0 && take.elapsedMs >= NO_SPEECH_MS) {
          finish(true);
        }
        return;
      }
      take.silenceMs = probability < SPEECH_END ? take.silenceMs + ms : 0;
      if (take.silenceMs >= SILENCE_MS) finish(false);
    });
  }

  return { recording, start, feed };
}
