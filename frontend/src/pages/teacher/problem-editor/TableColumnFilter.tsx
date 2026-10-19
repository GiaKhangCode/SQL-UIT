import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Filter } from "lucide-react";

/** Render outside the scrolling table so sticky headers cannot clip the controls. */
export function TableColumnFilter({ label, title, active = false, sorted = false, onOpen, children }: {
  label: string; title: string; active?: boolean; sorted?: boolean; onOpen?: () => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = panel.current.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8)),
        top: Math.max(8, anchor.bottom + box.height + 8 <= window.innerHeight ? anchor.bottom + 8 : anchor.top - box.height - 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className={`teacher-column-filter-trigger${active ? " is-active" : ""}`} aria-label={title} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" onClick={() => { if (!open) onOpen?.(); setOpen(value => !value); }}>
      {label}{sorted ? <ArrowUp size={13} aria-hidden="true" /> : <Filter size={13} aria-hidden="true" />}
    </button>
    {open && createPortal(<div ref={panel} id={id} className="teacher-column-filter-popover" role="dialog" aria-label={title} style={position}>{children}</div>, document.body)}
  </>;
}
