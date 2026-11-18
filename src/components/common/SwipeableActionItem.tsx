import React, { useEffect, useId, useRef, useState } from 'react';
import { trackInteraction } from '../../lib/perfMonitor';

export type SwipeActionTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface SwipeActionConfig {
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
  tone: SwipeActionTone;
  onAction: () => void;
  disabled?: boolean;
}

interface SwipeableActionItemProps {
  children: React.ReactNode;
  leftAction?: SwipeActionConfig; // Revealed when swiping right (dx > 0)
  rightAction?: SwipeActionConfig; // Revealed when swiping left (dx < 0)
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

const REVEAL_WIDTH = 92;
const SNAP_THRESHOLD = 46;
const FULL_SWIPE_THRESHOLD = 136;
const MAX_OFFSET = 148;
const SWIPE_EVENT_NAME = 'dip:swipe-item-open';

const TONE_CLASSES: Record<SwipeActionTone, string> = {
  primary: 'bg-[#FF671F] hover:bg-[#E55B1B] text-white',
  success: 'bg-[#138808] hover:bg-emerald-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  neutral: 'bg-slate-700 hover:bg-slate-800 text-white',
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('button, a, input, select, textarea, label, [data-no-swipe="true"]')
  );
}

export const SwipeableActionItem: React.FC<SwipeableActionItemProps> = ({
  children,
  leftAction,
  rightAction,
  onClick,
  className = 'rounded-2xl',
  contentClassName = '',
  disabled = false,
}) => {
  const itemId = useId();
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const offsetRef = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  const gestureLock = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const didSwipeRef = useRef(false);

  const setOffsetSafe = (next: number) => {
    offsetRef.current = next;
    setOffsetX(next);
  };

  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail !== itemId && offsetRef.current !== 0) {
        setOffsetSafe(0);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && offsetRef.current !== 0) {
        setOffsetSafe(0);
      }
    };
    window.addEventListener(SWIPE_EVENT_NAME, handleOtherOpen);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener(SWIPE_EVENT_NAME, handleOtherOpen);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [itemId]);

  const canSwipeLeft = Boolean(rightAction && !rightAction.disabled);
  const canSwipeRight = Boolean(leftAction && !leftAction.disabled);

  const announceOpen = () => {
    window.dispatchEvent(new CustomEvent<string>(SWIPE_EVENT_NAME, { detail: itemId }));
  };

  const triggerAction = (action: SwipeActionConfig, direction: 'left' | 'right') => {
    setOffsetSafe(0);
    trackInteraction('gesture', `swipe_${direction}`, action.shortLabel || action.label);
    action.onAction();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || (!canSwipeLeft && !canSwipeRight)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;

    activePointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    baseOffset.current = offsetRef.current;
    gestureLock.current = 'none';
    didSwipeRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId || disabled) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (gestureLock.current === 'none') {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 8 && absY < 8) return;

      if (absY > absX * 1.15) {
        gestureLock.current = 'vertical';
        activePointerId.current = null;
        return;
      }

      gestureLock.current = 'horizontal';
      didSwipeRef.current = true;
      setIsDragging(true);
      announceOpen();
    }

    if (gestureLock.current !== 'horizontal') return;

    let raw = baseOffset.current + dx;
    if (raw > 0 && !canSwipeRight) raw = 0;
    if (raw < 0 && !canSwipeLeft) raw = 0;

    if (raw > MAX_OFFSET) raw = MAX_OFFSET + (raw - MAX_OFFSET) * 0.2;
    if (raw < -MAX_OFFSET) raw = -MAX_OFFSET + (raw + MAX_OFFSET) * 0.2;

    setOffsetSafe(raw);
  };

  const finishGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setIsDragging(false);

    if (gestureLock.current !== 'horizontal') {
      gestureLock.current = 'none';
      return;
    }

    const current = offsetRef.current;
    gestureLock.current = 'none';

    if (current > 0 && leftAction && !leftAction.disabled) {
      if (current >= FULL_SWIPE_THRESHOLD && leftAction.tone !== 'danger') {
        triggerAction(leftAction, 'right');
        return;
      }
      if (current >= SNAP_THRESHOLD) {
        setOffsetSafe(REVEAL_WIDTH);
        return;
      }
    }

    if (current < 0 && rightAction && !rightAction.disabled) {
      if (Math.abs(current) >= FULL_SWIPE_THRESHOLD && rightAction.tone !== 'danger') {
        triggerAction(rightAction, 'left');
        return;
      }
      if (Math.abs(current) >= SNAP_THRESHOLD) {
        setOffsetSafe(-REVEAL_WIDTH);
        return;
      }
    }

    setOffsetSafe(0);
  };

  const handleForegroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didSwipeRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didSwipeRef.current = false;
      return;
    }
    if (offsetRef.current !== 0) {
      e.preventDefault();
      e.stopPropagation();
      setOffsetSafe(0);
      return;
    }
    onClick?.();
  };

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      {/* Left Revealed Tray (when swiped right) */}
      {leftAction && !leftAction.disabled && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center justify-start transition-opacity ${
            offsetX > 4 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ width: Math.max(REVEAL_WIDTH, offsetX) }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerAction(leftAction, 'right');
            }}
            aria-label={leftAction.label}
            className={`w-full h-full px-3 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${TONE_CLASSES[leftAction.tone]}`}
          >
            {leftAction.icon}
            <span className="leading-tight text-center">{leftAction.shortLabel || leftAction.label}</span>
          </button>
        </div>
      )}

      {/* Right Revealed Tray (when swiped left) */}
      {rightAction && !rightAction.disabled && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-end transition-opacity ${
            offsetX < -4 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ width: Math.max(REVEAL_WIDTH, Math.abs(offsetX)) }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerAction(rightAction, 'left');
            }}
            aria-label={rightAction.label}
            className={`w-full h-full px-3 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${TONE_CLASSES[rightAction.tone]}`}
          >
            {rightAction.icon}
            <span className="leading-tight text-center">{rightAction.shortLabel || rightAction.label}</span>
          </button>
        </div>
      )}

      {/* Foreground Card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onClick={handleForegroundClick}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          touchAction: 'pan-y',
        }}
        className={`relative z-10 ${
          isDragging ? '' : 'transition-transform duration-200 ease-out'
        } ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
