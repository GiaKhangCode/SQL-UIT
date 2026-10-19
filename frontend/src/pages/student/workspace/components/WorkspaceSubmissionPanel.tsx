import { DataGrid, Loading, Status } from "../../../../components/ui";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import type { QueryResult } from "../../../../services/studentApi";
import { SqlErrorMessage } from "./SqlErrorMessage";

export type WorkspaceAttempt = { id: number; kind: "run" | "submit"; result: QueryResult; };

export function WorkspaceSubmissionPanel({ attempts, busy, notice, submissionsUsed, maxSubmissions }: { attempts: WorkspaceAttempt[]; busy: boolean; notice: string; submissionsUsed?: number; maxSubmissions?: number | null }) {
  const { t: tr } = useLanguage("workspace");
  return <div className="workspace-submission-content" aria-live="polite">
    <header><h2><TranslatedText>{tr("Submission")}</TranslatedText></h2></header>
    {submissionsUsed != null && <p className="muted">{tr("Submissions")} · {submissionsUsed} / {maxSubmissions ?? tr("Unlimited")}</p>}
    {busy && <Loading label={tr("Running query…")} />}
    {notice && <div role="status" className="form-message"><SqlErrorMessage message={notice} /></div>}
    {!attempts.length && !busy && <p className="muted"><TranslatedText>{tr("Your submission history will appear here.")}</TranslatedText></p>}
    {attempts.map((attempt) => <article className="workspace-attempt" key={attempt.id}>
      <header><strong><TranslatedText>{tr(attempt.kind === "submit" ? "Submission" : "Run result")}</TranslatedText></strong><Status value={attempt.result.status} /></header>
      {attempt.kind === "submit" && attempt.result.scoreVisible != null && <p><strong>{tr("Score")}</strong> · {attempt.result.scoreVisible === false ? tr("Score hidden by instructor") : attempt.result.score == null ? tr("Awaiting grading") : `${attempt.result.score}/${attempt.result.maxScore ?? 100}`}</p>}
      {attempt.result.executionTimeMs != null && <p className="workspace-execution-time"><TranslatedText>{tr("Execution time")}</TranslatedText> · {attempt.result.executionTimeMs.toFixed(2)} ms</p>}
      {/error|time limit/i.test(attempt.result.status) ? <SqlErrorMessage message={attempt.result.message} /> : <p>{tr(attempt.result.message)}</p>}
      {attempt.result.table && <DataGrid table={attempt.result.table} />}
      {attempt.result.tables?.map((table, index) => <DataGrid key={`${table.name}-${index}`} table={table} />)}
    </article>)}
  </div>;
}
