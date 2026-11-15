import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const BAR_COUNT = 7;
// The voice range; bands are spaced evenly on a log scale, like octaves
const MIN_HZ = 100;
const MAX_HZ = 8000;

type Props = {
  stream: MediaStream;
  className?: string;
};

// A few bars showing how loud each frequency band of the mic input is.
// Plain divs, so they're styled with Tailwind like everything else.
export function Spectrum({ stream, className }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; // ~47 Hz per bin at 48 kHz: enough detail for the low bands
    analyser.smoothingTimeConstant = 0.7;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -20;
    // Only into the analyser, never to ctx.destination: playing the mic out loud would feed back
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bins = new Uint8Array(analyser.frequencyBinCount);
    const hzPerBin = ctx.sampleRate / analyser.fftSize;
    const bands = Array.from({ length: BAR_COUNT }, (_, i) => {
      const fromHz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / BAR_COUNT);
      const toHz = MIN_HZ * (MAX_HZ / MIN_HZ) ** ((i + 1) / BAR_COUNT);
      const from = Math.floor(fromHz / hzPerBin);
      return [from, Math.max(from + 1, Math.ceil(toHz / hzPerBin))];
    });

    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(bins); // loudness per bin, 0–255
      bands.forEach(([from, to], i) => {
        let sum = 0;
        for (let b = from; b < to; b++) sum += bins[b];
        const level = sum / (to - from) / 255;
        // Updating the DOM directly: re-rendering React 60 times a second isn't needed
        const bar = barRefs.current[i];
        if (bar) bar.style.height = `max(2px, ${level * 100}%)`;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect(); // useRecorder owns the mic tracks and stops them
      void ctx.close();
    };
  }, [stream]);

  return (
    <div className={cn('flex items-end justify-center gap-0.75', className)}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="h-0.5 w-1 rounded-[1.5px] bg-foreground"
        />
      ))}
    </div>
  );
}
