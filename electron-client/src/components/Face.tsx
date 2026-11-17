import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type FaceState = 'idle' | 'alert';

type Gaze = { x: number; y: number }; // px the eyes are shifted from centre
export type Point = { x: number; y: number }; // viewport px

const CENTER: Gaze = { x: 0, y: 0 };
const ALERT_GAZE: Gaze = { x: 0, y: -5 };
const GLANCE_X = 6;
const SWEEP_CHANCE = 0.3; // a glance sometimes carries on to the other side
const FIDGET_X = 2.5;
const FIDGET_Y = 1;
const LOOK_DISTANCE = 8;
const BLINK_MS = 110;
const DOUBLE_BLINK_CHANCE = 0.2;

type Props = {
  state: FaceState;
  lookAt?: Point | null; // overrides the state's own eye movement
  className?: string;
};

export function Face({ state, lookAt, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Offset from where the current state centres the eyes
  const [gaze, setGaze] = useState(CENTER);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let stop = () => {};
    if (lookAt && ref.current) {
      setGaze(towards(ref.current.getBoundingClientRect(), lookAt));
    } else {
      stop = state === 'alert' ? fidget(setGaze) : wander(setGaze);
    }
    return () => {
      stop();
      setGaze(CENTER);
    };
  }, [state, lookAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function blink(times: number) {
      setBlinking(true);
      timer = setTimeout(() => {
        setBlinking(false);
        timer =
          times > 1
            ? setTimeout(() => blink(times - 1), BLINK_MS)
            : setTimeout(scheduleBlink, random(2500, 6000));
      }, BLINK_MS);
    }

    function scheduleBlink() {
      blink(Math.random() < DOUBLE_BLINK_CHANCE ? 2 : 1);
    }

    timer = setTimeout(scheduleBlink, random(1000, 3000));
    return () => clearTimeout(timer);
  }, []);

  const alert = state === 'alert' && !lookAt;
  const base = alert ? ALERT_GAZE : CENTER;
  const x = base.x + gaze.x;
  const y = base.y + gaze.y;

  return (
    <div
      ref={ref}
      data-state={state}
      className={cn(
        'flex size-16 items-center justify-center rounded-full bg-primary',
        className,
      )}
    >
      <div
        className={cn(
          'flex gap-3.5 transition-transform',
          // Perking up overshoots a little; glances are quick darts
          alert
            ? 'duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]'
            : 'duration-200 ease-out',
        )}
        style={{ transform: `translate(${x}px, ${y}px)` }}
      >
        <Eye blinking={blinking} />
        <Eye blinking={blinking} />
      </div>
    </div>
  );
}

function Eye({ blinking }: { blinking: boolean }) {
  return (
    <div
      className="size-2 rounded-full bg-primary-foreground transition-transform duration-75"
      style={{ transform: `scaleY(${blinking ? 0.1 : 1})` }}
    />
  );
}

function towards(from: DOMRect, to: Point): Gaze {
  const dx = to.x - (from.left + from.width / 2);
  const dy = to.y - (from.top + from.height / 2);
  const length = Math.hypot(dx, dy) || 1;
  return { x: (dx / length) * LOOK_DISTANCE, y: (dy / length) * LOOK_DISTANCE };
}

// Idle: mostly looks ahead, now and then glances to one side
function wander(setGaze: (gaze: Gaze) => void) {
  let timer: ReturnType<typeof setTimeout>;
  let current = CENTER;
  let swept = false;

  function look(next: Gaze, holdMs: number) {
    current = next;
    setGaze(next);
    timer = setTimeout(step, holdMs);
  }

  function step() {
    if (current === CENTER) {
      swept = false;
      const side = Math.random() < 0.5 ? -1 : 1;
      look({ x: side * GLANCE_X, y: 0 }, random(700, 1600));
    } else if (!swept && Math.random() < SWEEP_CHANCE) {
      swept = true;
      look({ x: -current.x, y: 0 }, random(700, 1400));
    } else {
      look(CENTER, random(2500, 6000));
    }
  }

  timer = setTimeout(step, random(1500, 4000));
  return () => clearTimeout(timer);
}

// Alert: small, frequent shifts so it looks attentive rather than frozen
function fidget(setGaze: (gaze: Gaze) => void) {
  let timer: ReturnType<typeof setTimeout>;

  function step() {
    setGaze({
      x: random(-FIDGET_X, FIDGET_X),
      y: random(-FIDGET_Y, FIDGET_Y),
    });
    timer = setTimeout(step, random(400, 1100));
  }

  timer = setTimeout(step, random(400, 700));
  return () => clearTimeout(timer);
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}
