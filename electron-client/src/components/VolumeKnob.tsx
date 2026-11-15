import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

// Visual-only for now: the value is kept and saved, but nothing plays at it yet

const STORAGE_KEY = 'volumeKnob';
const DEFAULT_VALUE = 0.8;
const DRAG_RANGE_PX = 200; // dragging this far up or down covers 0 → 100%
const FINE_FACTOR = 0.25; // Shift held: 4× finer
const STEP = 0.05; // one arrow key press

// The knob turns from 7 o'clock (0%) to 5 o'clock (100%)
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

const SIZE = 16;
const CENTER = SIZE / 2;

type Props = {
  onChange?: (value: number) => void;
  className?: string;
};

export function VolumeKnob({ onChange, className }: Props) {
  const [value, setValue] = useState(loadValue);
  const [dragging, setDragging] = useState(false);
  // The drag moves the value by how far the pointer travelled since the last
  // move, so pressing or releasing Shift mid-drag doesn't make it jump
  const lastY = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Storage can be unavailable; the knob just won't remember its position
    }
    onChange?.(value);
  }, [value, onChange]);

  function change(delta: number) {
    setValue((v) => clamp(v + delta));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Keep receiving moves even when the pointer leaves the knob
    e.currentTarget.setPointerCapture(e.pointerId);
    lastY.current = e.clientY;
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    // The release can go missing (let go outside the window, focus switched
    // away), so a move with the button already up ends the drag
    if ((e.buttons & 1) === 0) {
      setDragging(false);
      return;
    }
    const moved = lastY.current - e.clientY; // up is positive
    lastY.current = e.clientY;
    change((moved / DRAG_RANGE_PX) * (e.shiftKey ? FINE_FACTOR : 1));
  }

  function onPointerUp() {
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? STEP * FINE_FACTOR : STEP;
    const keys: Record<string, () => void> = {
      ArrowUp: () => change(step),
      ArrowRight: () => change(step),
      ArrowDown: () => change(-step),
      ArrowLeft: () => change(-step),
      Home: () => setValue(0),
      End: () => setValue(1),
    };
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  }

  const percent = Math.round(value * 100);
  const angle = MIN_ANGLE + value * (MAX_ANGLE - MIN_ANGLE);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      className={cn(
        'relative flex mt-[4px] touch-none flex-col items-center gap-[3px] rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'cursor-ns-resize',
        className,
      )}
      style={{ width: SIZE }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onDoubleClick={() => setValue(DEFAULT_VALUE)}
      onKeyDown={onKeyDown}
    >
      {/* The knob: a plain circle with a line showing where it points */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER - 0.75}
            strokeWidth={1.5}
            className="fill-background stroke-muted-foreground"
          />
          <line
            x1={CENTER}
            y1={2.5}
            x2={CENTER}
            y2={CENTER - 2.5}
            strokeWidth={1.5}
            strokeLinecap="round"
            className="stroke-foreground"
          />
        </g>
      </svg>

      {/* The level: light track, black fill */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-foreground"
          style={{ width: `${percent}%` }}
        />
      </div>

      {dragging && (
        <span className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-xs whitespace-nowrap text-background tabular-nums">
          {percent}%
        </span>
      )}
    </div>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function loadValue() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (localStorage.getItem(STORAGE_KEY) !== null && Number.isFinite(saved)) {
      return clamp(saved);
    }
  } catch {
    // Fall through to the default
  }
  return DEFAULT_VALUE;
}
