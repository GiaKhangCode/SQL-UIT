import { useRef, type PointerEvent as ReactPointerEvent, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { clamp } from "../../../../utils/workspacePreferences";

type Axis = "vertical" | "horizontal";

export function WorkspaceResizeHandle({
  axis,
  containerRef,
  value,
  min,
  max,
  label,
  controls,
  valueText,
  className = "",
  onResize,
  onReset,
  onResizeStart,
  onResizeEnd,
}: {
  axis: Axis;
  containerRef: RefObject<HTMLElement | null>;
  value: number;
  min: number;
  max: number;
  label: string;
  controls: string;
  valueText?: string;
  className?: string;
  onResize: (value: number) => void;
  onReset?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const pointerId = useRef<number | null>(null);
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    const size = axis === "vertical" ? bounds?.width : bounds?.height;
    if (!bounds || !size) return;
    const offset = axis === "vertical" ? event.clientX - bounds.left : event.clientY - bounds.top;
    onResize(clamp((offset / size) * 100, min, max));
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerId.current = event.pointerId;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    onResizeStart?.();
    updateFromPointer(event);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current === event.pointerId) updateFromPointer(event);
  };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerId.current = null;
    onResizeEnd?.();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction = axis === "vertical"
      ? event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
      : event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    onResize(clamp(value + direction * 2, min, max));
  };
  return <div
    className={`workspace-splitter workspace-splitter-${axis}${className ? ` ${className}` : ""}`}
    role="separator"
    aria-label={label}
    aria-orientation={axis}
    aria-controls={controls}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={Math.round(value)}
    aria-valuetext={valueText || `${label} ${Math.round(value)} percent`}
    tabIndex={0}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishPointer}
    onPointerCancel={finishPointer}
    onLostPointerCapture={() => { pointerId.current = null; onResizeEnd?.(); }}
    onDoubleClick={onReset}
    onKeyDown={handleKeyDown}
  />;
}
