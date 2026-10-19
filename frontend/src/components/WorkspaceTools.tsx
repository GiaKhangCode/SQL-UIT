import { TranslatedText } from "./TranslatedText";
import { useLanguage } from "../context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { Check, LayoutDashboard, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { storage } from "../services/storage";
import { elapsedTime, formatTime, layouts, readTimer, toggleTimer, type Layout } from "../utils/workspacePreferences";
export function WorkspaceTools({ layout, onLayout, focus, onFocus, timerKey }: {
  layout: Layout; onLayout: (value: Layout) => void; focus: boolean; onFocus: () => void; timerKey: string;
}) {
  const { t: tr } = useLanguage("workspace");
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState(() => readTimer(timerKey));
  const [now, setNow] = useState(Date.now);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTimer(readTimer(timerKey)); setNow(Date.now()); }, [timerKey]);
  useEffect(() => {
    if (timer.startedAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [timer.startedAt]);
  function updateTimer(value: typeof timer) {
    storage.set(timerKey, JSON.stringify(value)); setNow(Date.now()); setTimer(value);
  }
  useEffect(() => {
    function sync(event: StorageEvent) { if (event.key === timerKey) { setTimer(readTimer(timerKey)); setNow(Date.now()); } }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [timerKey]);
  useEffect(() => {
    if (!open) return;
    firstChoice.current?.focus();
    function outside(event: PointerEvent) { if (!anchor.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  return <div className="workspace-tools">
    {focus && <button className="button focus-exit" onClick={onFocus}><Minimize2 size={15} /> <TranslatedText>{tr("Exit Focus Mode")}</TranslatedText></button>}
    <div className="layout-anchor" ref={anchor}>
      <button ref={trigger} className="icon-button layout-trigger" aria-label={tr("Choose layout")} title={tr("Choose layout")} aria-expanded={open} aria-controls="workspace-layout-popover" onClick={() => setOpen(!open)}><LayoutDashboard size={19} /></button>
      {open && <div id="workspace-layout-popover" className="layout-popover" role="region" aria-label={tr("Layouts")}>
        <h2><TranslatedText>{tr("Layouts")}</TranslatedText></h2>
        <div className="layout-choices">{layouts.map((name, index) => <button key={name} ref={index === 0 ? firstChoice : undefined} className="layout-choice" aria-pressed={layout === name} onClick={() => { onLayout(name); setOpen(false); trigger.current?.focus(); }}>
          <span className={`layout-preview preview-${name.toLowerCase()}`} aria-hidden="true"><i /><i /><i />{name === "Note-taking" && <i />}</span>
          <span><TranslatedText>{tr(name)}</TranslatedText>{layout === name && <Check size={16} />}</span>
        </button>)}</div>
        <button className="button layout-focus" aria-pressed={focus} onClick={() => { onFocus(); setOpen(false); trigger.current?.focus(); }}><Maximize2 size={16} /><TranslatedText>{focus ? tr("Exit Focus Mode") : tr("Focus Mode")}</TranslatedText></button>
      </div>}
    </div>
    <div className="workspace-timer" role="group" aria-label={tr("Self-tracking timer")}>
      <button className="icon-button" aria-label={timer.startedAt === null ? tr("Start timer") : tr("Pause timer")} title={timer.startedAt === null ? tr("Start / resume timer") : tr("Pause timer")} onClick={() => updateTimer(toggleTimer(timer))}>{timer.startedAt === null ? <Play size={15} /> : <Pause size={15} />}</button>
      <span className="timer-digits" title={tr("Practice time - for self-tracking only")}>{formatTime(elapsedTime(timer, now))}</span>
      <button className="icon-button" aria-label={tr("Reset timer")} title={tr("Reset and stop timer")} onClick={() => updateTimer({ elapsed: 0, startedAt: null })}><RotateCcw size={15} /></button>
    </div>
  </div>;
}
