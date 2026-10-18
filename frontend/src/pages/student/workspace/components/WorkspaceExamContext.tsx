import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../../../services/apiClient";
import { storage } from "../../../../services/storage";
import { Dialog, Loading } from "../../../../components/ui";
import { useLanguage } from "../../../../context/LanguageContext";
import { useAuth } from "../../../../context/AuthContext";
import "../../../../styles/workspace-exam.css";

type Scripts = { ddl: string; dml: string; query: string; revision?: number };
type Attempt = { examMode: boolean; problemIds: string[]; status: "not_started" | "active" | "submitted"; violationCount: number; drafts: Record<string, Scripts>; finishReason?: string };
type Violation = "focus_lost" | "external_paste" | "leave_attempt";
type ExamContext = { enabled: boolean; busy: boolean; violations: number; draft: (id: string) => Scripts | undefined; update: (id: string, change: Partial<Scripts>) => void; requestSubmit: () => void };
const Context = createContext<ExamContext | null>(null);
export const useWorkspaceExam = () => useContext(Context);

export function WorkspaceExamProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage("workspace");
  const { session } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const source = params.get("source") || "Practice";
  const activity = params.get("context") || "";
  const eligible = session?.role === "student" && ["Assignments", "Contests"].includes(source) && Boolean(activity);
  const endpoint = `/api/student/activity-attempts/${encodeURIComponent(activity)}`;
  const out = source === "Contests" ? `/contests/${encodeURIComponent(activity)}` : `/assignments/work/${encodeURIComponent(activity)}`;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(eligible);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const current = useRef<Attempt | null>(null);
  const drafts = useRef<Record<string, Scripts>>({});
  const activeProblem = useRef("");
  const allowExit = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef(Promise.resolve());
  const pendingKey = `sql-practice:exam-events:${session?.id}:${activity}`;
  const pending = useRef<{ id: string; kind: Violation; snapshot: object }[]>([]);
  const enabled = Boolean(attempt?.examMode);
  const active = enabled && attempt?.status === "active";

  function accept(value: Attempt) {
    if (current.current?.status === "submitted" && value.status !== "submitted") return;
    value = { ...value, violationCount: Math.max(current.current?.violationCount || 0, value.violationCount) };
    current.current = value;
    setAttempt(value);
    if (value.status === "submitted") { setWarning(false); setConfirm(false); setStopping(false); }
    else if (value.status === "active") setStopping(value.violationCount + pending.current.length >= 2);
  }
  const snapshot = useCallback(() => {
    const id = activeProblem.current;
    return id ? { problemId: id, ...drafts.current[id] } : {};
  }, []);

  useEffect(() => {
    if (!eligible) { setLoading(false); return; }
    let alive = true;
    apiFetch<Attempt>(`${endpoint}?source=${source}`).then(value => {
      if (!alive) return;
      drafts.current = { ...value.drafts };
      if (value.status === "active") {
        try {
          const local = JSON.parse(storage.get(pendingKey + ":drafts") || "{}");
          for (const [id, script] of Object.entries(local) as [string, Scripts][]) {
            if (value.problemIds.includes(id) && (script.revision || 0) > (drafts.current[id]?.revision || 0)) drafts.current[id] = script;
          }
        } catch { /* Use the server snapshot if local storage is invalid. */ }
      }
      try { pending.current = JSON.parse(storage.get(pendingKey) || "[]"); } catch { pending.current = []; }
      if (value.status === "active" && value.violationCount + pending.current.length >= 2) setStopping(true);
      accept(value);
    }).catch(e => { if (alive) setError(String(e.message)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(saveTimer.current); };
  }, [eligible, endpoint, source, pendingKey]);

  // Serialize writes. A late autosave must never replace a newer final snapshot.
  const send = useCallback((action: string, data: object = {}, keepalive = false) => {
    const body = JSON.stringify({ source, ...data });
    const task = () => apiFetch<Attempt>(`${endpoint}/${action}`, { method: "POST", keepalive: keepalive && new Blob([body]).size < 60000, body });
    const result = queue.current.then(task, task);
    queue.current = result.then(() => undefined, () => undefined);
    return result;
  }, [endpoint, source]);

  const flushViolations = useCallback(async () => {
    for (const event of [...pending.current]) {
      // A violation can occur before autosave fires, including just after switching problems.
      for (const [problemId, script] of Object.entries(drafts.current)) await send("save", { problemId, ...script }, true);
      const value = await send("violation", { ...event.snapshot, eventId: event.id, kind: event.kind }, true);
      pending.current = pending.current.filter(item => item.id !== event.id);
      storage.set(pendingKey, JSON.stringify(pending.current));
      accept(value);
    }
  }, [pendingKey, send]);

  const report = useCallback((kind: Violation) => {
    if (!current.current?.examMode || current.current.status !== "active") return;
    if (current.current.violationCount + pending.current.length >= 2) return;
    // Keep idempotent events locally until the server acknowledges them, including offline/reload.
    const event = { id: crypto.randomUUID(), kind, snapshot: snapshot() };
    pending.current.push(event);
    storage.set(pendingKey, JSON.stringify(pending.current));
    if (current.current.violationCount + pending.current.length >= 2) { setStopping(true); setConfirm(false); }
    setWarning(true);
    void flushViolations().catch(() => setError(t("Connection lost. Keep this page open while your work is saved.")));
  }, [pendingKey, snapshot, flushViolations, t]);

  useEffect(() => {
    if (!active) return;
    const retry = () => {
      void (async () => {
        for (const [problemId, script] of Object.entries(drafts.current)) await send("save", { problemId, ...script });
        await flushViolations();
      })().catch(() => {});
    };
    retry();
    window.addEventListener("online", retry);
    const poll = setInterval(() => {
      void apiFetch<Attempt>(`${endpoint}?source=${source}`).then(accept).catch(() => {});
    }, 5000);
    return () => { window.removeEventListener("online", retry); clearInterval(poll); };
  }, [active, flushViolations, send, endpoint, source]);

  const blocker = useBlocker(({ nextLocation }) => {
    if (!active || allowExit.current) return false;
    const next = new URLSearchParams(nextLocation.search);
    const id = decodeURIComponent(nextLocation.pathname.replace(/^\/workspace\//, ""));
    return !(nextLocation.pathname.startsWith("/workspace/") && next.get("source") === source && next.get("context") === activity && attempt?.problemIds.includes(id));
  });
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    blocker.reset();
    report("leave_attempt");
  }, [blocker, report]);

  useEffect(() => {
    if (!active) return;
    let away = false;
    let copied = "";
    const lostFocus = () => {
      if (away) return;
      away = true;
      report("focus_lost");
    };
    const visibility = () => { if (document.hidden) lostFocus(); else if (document.hasFocus()) away = false; };
    const focus = () => { if (!document.hidden) away = false; };
    const copy = (event: ClipboardEvent) => { copied = event.clipboardData?.getData("text/plain") || window.getSelection()?.toString() || ""; };
    const paste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain") || "";
      if (copied && text === copied) return;
      event.preventDefault(); event.stopImmediatePropagation(); report("external_paste");
    };
    const drop = (event: DragEvent) => { event.preventDefault(); event.stopImmediatePropagation(); report("external_paste"); };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if ((event.target as Element)?.closest?.("[data-workspace-exit]")) {
        event.preventDefault(); event.stopImmediatePropagation(); report("leave_attempt"); return;
      }
      const link = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hash && link.pathname === location.pathname && link.search === location.search) return;
      const url = new URL(link.href);
      const id = decodeURIComponent(url.pathname.replace(/^\/workspace\//, ""));
      if (url.origin === location.origin && url.pathname.startsWith("/workspace/") && url.searchParams.get("context") === activity && url.searchParams.get("source") === source && current.current?.problemIds.includes(id)) return;
      event.preventDefault(); event.stopImmediatePropagation(); report("leave_attempt");
    };
    window.addEventListener("blur", lostFocus);
    window.addEventListener("focus", focus);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("copy", copy);
    document.addEventListener("cut", copy);
    document.addEventListener("paste", paste, true);
    document.addEventListener("drop", drop, true);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("blur", lostFocus); window.removeEventListener("focus", focus); window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", visibility); document.removeEventListener("copy", copy); document.removeEventListener("cut", copy);
      document.removeEventListener("paste", paste, true); document.removeEventListener("drop", drop, true); document.removeEventListener("click", click, true);
    };
  }, [active, activity, source, report]);

  const update = useCallback((id: string, change: Partial<Scripts>) => {
    if (!current.current?.examMode || current.current.status !== "active") return;
    if (activeProblem.current && activeProblem.current !== id) {
      const previousId = activeProblem.current;
      void send("save", { problemId: previousId, ...drafts.current[previousId] }).then(accept)
        .catch(() => setError(t("Connection lost. Keep this page open while your work is saved.")));
    }
    activeProblem.current = id;
    const previous = drafts.current[id] || { ddl: "", dml: "", query: "" };
    drafts.current[id] = { ...previous, ...change, revision: Math.max(Date.now(), (previous.revision || 0) + 1) };
    storage.set(pendingKey + ":drafts", JSON.stringify(drafts.current));
    clearTimeout(saveTimer.current);
    const data = { problemId: id, ...drafts.current[id] };
    saveTimer.current = setTimeout(() => { void send("save", data).then(accept).catch(() => setError(t("Connection lost. Keep this page open while your work is saved."))); }, 600);
  }, [send, t, pendingKey]);

  async function start() {
    setBusy(true); setError("");
    try { const value = await send("start"); drafts.current = value.drafts; accept(value); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError(""); clearTimeout(saveTimer.current);
    try {
      // Save every visited problem, including one whose debounce was cancelled by switching problems.
      for (const [problemId, script] of Object.entries(drafts.current)) await send("save", { problemId, ...script });
      await flushViolations();
      const value = await send("submit", snapshot());
      accept(value);
      if (value.status === "submitted" && value.finishReason !== "violations") {
        allowExit.current = true;
        navigate(out, { replace: true });
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const value = useMemo<ExamContext>(() => ({ enabled, busy, violations: attempt?.violationCount || 0,
    draft: id => drafts.current[id], update, requestSubmit: () => setConfirm(true) }), [enabled, busy, attempt?.violationCount, update]);
  if (loading) return <Loading />;
  if (eligible && !attempt) return <div className="workspace-exam-gate" role="alert"><h1>{t("Exam unavailable")}</h1><p>{error}</p><Link to={out}>{t("Back")}</Link></div>;
  if (enabled && attempt?.status === "not_started") return <div className="workspace-exam-gate"><h1>{t("Exam mode")}</h1><p>{t("Stay in this activity until you submit. Switching tabs or apps, leaving the activity, and pasting outside content count as violations. Your second violation automatically submits all problems.")}</p><p>{t("You can switch between problems and DDL, DML, SQL inside this activity.")}</p>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy} onClick={() => void start()}>{t("Start exam")}</button><Link to={out}>{t("Back")}</Link></div>;
  if (enabled && attempt?.status === "submitted") return <div className="workspace-exam-gate"><h1>{t("Exam submitted")}</h1><p>{t(attempt.finishReason === "violations" ? "Your work was automatically submitted after two violations." : "All your work has been submitted for teacher review.")}</p><button className="button primary" onClick={() => navigate(out, { replace: true })}>{t("Exit")}</button></div>;
  return <Context.Provider value={value}>
    {children}
    {active && stopping && <Dialog title={t("Submitting…")} hideClose closeOnBackdrop={false} closeOnCancel={false} onClose={() => {}}><p>{t("Your work is locked after two violations. Keep this page open until submission finishes.")}</p>{error && <p role="alert">{error}</p>}</Dialog>}
    {active && error && <div className="workspace-exam-notice" role="alert">{error}<button onClick={() => { setError(""); void submit(); }}>{t("Save & submit again")}</button></div>}
    {warning && active && !stopping && <Dialog title={t("Exam warning")} onClose={() => setWarning(false)}><p>{t("Stay in the exam. A second violation will automatically submit all your work.")}</p><p>{t("External paste is blocked. Copying within this workspace is allowed.")}</p><button className="button primary" onClick={() => setWarning(false)}>{t("Continue exam")}</button></Dialog>}
    {confirm && <Dialog title={t("Submit & Exit")} onClose={() => { if (!busy) setConfirm(false); }}><p>{t("Submit all problems in this activity? You cannot edit them after submitting.")}</p><div className="workspace-finish-actions"><button className="button" disabled={busy} onClick={() => setConfirm(false)}>{t("Cancel")}</button><button className="button primary" disabled={busy} onClick={() => void submit()}>{t(busy ? "Submitting…" : "Submit & Exit")}</button></div></Dialog>}
  </Context.Provider>;
}

export function WorkspaceExamFinishButton() {
  const exam = useWorkspaceExam();
  const { t } = useLanguage("workspace");
  if (!exam?.enabled) return null;
  return <div className="workspace-exam-controls"><span>{t("Exam mode")} · {exam.violations}/2</span><button className="button primary" disabled={exam.busy} onClick={exam.requestSubmit}>{t("Submit & Exit")}</button></div>;
}
