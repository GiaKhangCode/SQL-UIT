import { DataGrid, Loading, Status } from "../../../../components/ui";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import type { QueryResult } from "../../../../services/studentApi";
import { SqlErrorMessage } from "./SqlErrorMessage";

export type WorkspaceAttempt = { id: number; kind: "run" | "submit"; result: QueryResult; };

export function WorkspaceSubmissionPanel({ attempts, busy, notice }: { attempts: WorkspaceAttempt[]; busy: boolean; notice: string }) {
  const { t: tr } = useLanguage("workspace");
  return <div className="workspace-submission-content" aria-live="polite">
    <header><h2>Submission</h2></header>
    {busy && <Loading label={tr("Running query…")} />}
    {notice && <div role="status" className="form-message"><SqlErrorMessage message={notice} /></div>}
    {!attempts.length && !busy && <p className="muted"><TranslatedText>{tr("Run the query to preview returned data. Submit when ready for evaluation.")}</TranslatedText></p>}
    {attempts.map((attempt) => <article className="workspace-attempt" key={attempt.id}>
      <header><strong><TranslatedText>{tr(attempt.kind === "submit" ? "Submission" : "Run result")}</TranslatedText></strong><Status value={attempt.result.status} /></header>
      {attempt.result.executionTimeMs != null && <p className="workspace-execution-time"><TranslatedText>{tr("Execution time")}</TranslatedText> · {attempt.result.executionTimeMs.toFixed(2)} ms</p>}
      {/error|time limit/i.test(attempt.result.status) ? <SqlErrorMessage message={attempt.result.message} /> : <p>{tr(attempt.result.message)}</p>}
      {attempt.result.table && <DataGrid table={attempt.result.table} />}
      {attempt.result.tables?.map((table, index) => <DataGrid key={`${table.name}-${index}`} table={table} />)}
    </article>)}
  </div>;
}
