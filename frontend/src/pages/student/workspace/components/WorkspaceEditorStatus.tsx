import { Clock3 } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { formatTime } from "../../../../utils/workspacePreferences";
import { useWorkspaceCountdown } from "./WorkspaceExamContext";

export function WorkspaceEditorStatus({ line, column, executionTimeMs }: { line: number; column: number; executionTimeMs?: number }) {
  const { t } = useLanguage("workspace");
  const remainingMs = useWorkspaceCountdown();
  return <div className="workspace-editor-status">
    <span className="cursor-position muted">{t("Ln")} {line}{t(", Col")} {column}</span>
    {remainingMs != null && <span className={`workspace-deadline${remainingMs <= 60000 ? " is-urgent" : ""}`} role="timer" aria-label={t("Time remaining")} title={t("Work is submitted automatically when time runs out.")}><Clock3 size={14} />{t("Time left")} <b>{formatTime(Math.max(0, remainingMs))}</b></span>}
    {executionTimeMs != null && <span className="workspace-execution-time muted">{t("Execution time")} · {executionTimeMs.toFixed(2)} ms</span>}
  </div>;
}
