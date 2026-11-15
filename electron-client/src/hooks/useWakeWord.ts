import { useEffect, useRef, useState } from 'react';
import { SAMPLE_RATE, WakeWordDetector } from '@/wakeword/detector';

const MODEL = 'hay_broe.onnx'; // custom "hey bro", trained with openWakeWord's Colab notebook
const THRESHOLD = 0.5;
const COOLDOWN_MS = 2000; // one phrase keeps scoring high for a few chunks

export type WakeWordStatus = 'starting' | 'listening' | 'no-mic' | 'failed';

export function useWakeWord(onDetected: () => void) {
  const [status, setStatus] = useState<WakeWordStatus>('starting');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let stopped = false;
    let mic: MediaStream | undefined;
    let ctx: AudioContext | undefined;

    async function start() {
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });
      } catch {
        if (!stopped) setStatus('no-mic');
        return;
      }
      if (stopped) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      setStream(mic);

      try {
        const detector = await WakeWordDetector.create(MODEL);
        // Chromium resamples the mic (usually 48 kHz) to the context's 16 kHz for us
        ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        await ctx.audioWorklet.addModule('pcm-chunker.js');
        if (stopped) return;

        const chunker = new AudioWorkletNode(ctx, 'pcm-chunker');
        ctx.createMediaStreamSource(mic).connect(chunker); // not to the speakers

        // Chunks arrive every 80 ms; run them one at a time, in order
        let queue = Promise.resolve();
        let lastDetection = 0;
        chunker.port.onmessage = (event: MessageEvent<Float32Array>) => {
          queue = queue.then(async () => {
            const score = await detector.process(event.data);
            const now = performance.now();
            if (
              score !== null &&
              score > THRESHOLD &&
              now - lastDetection > COOLDOWN_MS
            ) {
              lastDetection = now;
              onDetectedRef.current();
            }
          });
        };
        setStatus('listening');
      } catch (error) {
        console.error('wake word failed to start', error);
        if (!stopped) setStatus('failed');
      }
    }

    void start();
    return () => {
      stopped = true;
      mic?.getTracks().forEach((track) => track.stop());
      void ctx?.close();
      setStream(null);
    };
  }, []);

  return { status, stream };
}
