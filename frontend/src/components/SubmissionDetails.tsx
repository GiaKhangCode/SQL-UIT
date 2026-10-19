import { TranslatedText } from "./TranslatedText";
import { useLanguage } from "../context/LanguageContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type Submission } from "../data/models";
import { Dialog, Status } from "./ui";
import { submissionTimeLabel } from "../utils/serverDateTime";
export function SubmissionDetails({
  submission,
  problem,
  onClose,
  inline = false,
}: {
  submission: Submission;
  problem: any;
  onClose: () => void;
  inline?: boolean;
}) {
  const { t: tr, locale: uiLocale } = useLanguage("common");
  const [copy, setCopy] = useState("");
  const [showCode, setShowCode] = useState(false);
  const p = problem;
  // Read the immutable attempt snapshot, never the current draft.
  const query = submission.query;
  const maximumScore = submission.maxScore ?? 100;
  const manuallyGraded = submission.evaluatedScore != null;
  const finalScore = submission.evaluatedScore ?? submission.score;
  const scoreLabel = (score: number | null) => {
    if (submission.scoreVisible === false || score == null) return tr("Score hidden by instructor");
    if (submission.result === "Pending review" || submission.result === "Not answered") return tr("Awaiting grading");
    const normalized = maximumScore > 0 ? (score / maximumScore) * 10 : 0;
    return `${Math.round(normalized * 100) / 100}/10`;
  };
  const content = (
    <>
      <div className="submission-detail-content">
        <p className="tiny muted submission-detail-id">
          #{submission.id} <TranslatedText>{tr("· Read-only")}</TranslatedText>
        </p>
        <h1>
          {p.number}. {p.title}
        </h1>
        <div className="submission-attempt-meta">
          <p className="tiny muted"><TranslatedText>{tr(submissionTimeLabel(submission.submittedAt, uiLocale))}</TranslatedText></p>
          <div className="submission-source-verdict">
            <p className="tiny">
              <TranslatedText>{tr(submission.source)}</TranslatedText>
              {(submission.contextTitle || submission.context) && (submission.contextTitle || submission.context) !== submission.source && <> · {submission.contextTitle || submission.context}</>}
            </p>
            <Status value={submission.result} />
          </div>
        </div>
        <section
          className="submission-evaluation"
          aria-label={tr("Submission evaluation")}
        >
          <div className="submission-score-grid">
            <div>
              <small><TranslatedText>{tr("Auto score")}</TranslatedText></small>
              <strong>{scoreLabel(submission.score)}</strong>
            </div>
            <div>
              <small><TranslatedText>{tr("Final score")}</TranslatedText></small>
              <strong>{scoreLabel(finalScore)}</strong>
              {submission.scoreVisible !== false && submission.result !== "Pending review" && <small className="submission-grading-source">
                <TranslatedText>{manuallyGraded ? tr("Manually graded by instructor") : tr("Automatically graded")}</TranslatedText>
              </small>}
            </div>
          </div>
        </section>
        <section className="submitted-query">
          <div className="section-heading">
            <h3><TranslatedText>{tr("Submitted SQL")}</TranslatedText></h3>
            {query && (
              <div className="submitted-query-actions">
              <button type="button" className="text-button" onClick={() => setShowCode(true)}><TranslatedText>{tr("View code")}</TranslatedText></button>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(query);
                    setCopy("Copied SQL.");
                  } catch {
                    setCopy(
                      "Copy unavailable. Select the SQL below to copy manually.",
                    );
                  }
                }}
              >
                <TranslatedText>{tr("Copy")}</TranslatedText>
              </button>
              </div>
            )}
          </div>
          {query ? (
            <pre tabIndex={0} aria-label={tr("Submitted SQL snapshot")}>
              <code>{query}</code>
            </pre>
          ) : (
            <p className="tiny muted">
              <TranslatedText>{tr("SQL snapshot is unavailable for this submission.")}</TranslatedText>
            </p>
          )}
          <small className="muted">
            <TranslatedText>{tr("Submission snapshot ·")}</TranslatedText> <TranslatedText>{submission.database || tr("Database unavailable")}</TranslatedText> <TranslatedText>{tr("· Read-only")}</TranslatedText>
          </small>
          <p role="status" className="tiny">
            <TranslatedText>{tr(copy)}</TranslatedText>
          </p>
        </section>
        <section className="instructor-evaluation">
          <h3><TranslatedText>{tr("Instructor comments")}</TranslatedText></h3>
          <p className="tiny muted">
            <TranslatedText>{submission.feedback || tr("No instructor comments yet.")}</TranslatedText>
          </p>
        </section>
      </div>
      <footer className="submission-detail-footer">
        <Link className="button primary" to={"/workspace/" + p.id}>
          <TranslatedText>{tr("Open problem")}</TranslatedText>
        </Link>
      </footer>
      {showCode && query && <SubmittedSqlDialog query={query} database={submission.database} onClose={() => setShowCode(false)} />}
    </>
  );
  if (inline) {
    return <div className="submission-inline-details">
      <header className="submission-inline-heading"><h2><TranslatedText>{tr("Submission details")}</TranslatedText></h2></header>
      {content}
    </div>;
  }
  return <Dialog className="submission-drawer" title={tr("Submission details")} onClose={onClose}>{content}</Dialog>;
}

function SubmittedSqlDialog({ query, database, onClose }: { query: string; database?: string; onClose: () => void }) {
  const { t: tr } = useLanguage("common");
  const [code, setCode] = useState(query);
  const [formatState, setFormatState] = useState("Formatting SQL…");
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    let active = true;
    const databaseName = (database || "").toLowerCase();
    const language = databaseName.includes("postgres") ? "postgresql" : databaseName.includes("mysql") ? "mysql" : databaseName.includes("sqlite") ? "sqlite" : databaseName.includes("sql server") || databaseName.includes("mssql") ? "transactsql" : "sql";
    import("sql-formatter").then(({ format }) => {
      const formatted = format(query, { language, tabWidth: 2 });
      if (active) { setCode(formatted); setFormatState("Formatted SQL · " + (database || "SQL")); }
    }).catch(() => {
      if (active) setFormatState("Formatting unavailable for this query. Showing the original SQL.");
    });
    return () => { active = false; };
  }, [query, database]);
  return <Dialog title={tr("Submitted SQL")} className="submitted-sql-dialog" onClose={onClose}>
    <div className="submitted-sql-dialog-body">
      <p className="tiny muted" role="status"><TranslatedText>{formatState.startsWith("Formatted SQL · ") ? tr("Formatted SQL · {database}", { database: database || "SQL" }) : tr(formatState)}</TranslatedText></p>
      <pre tabIndex={0} aria-label={tr("Full submitted SQL")}><code>{code}</code></pre>
    </div>
    <footer className="submitted-sql-dialog-footer">
      <span className="tiny muted" role="status"><TranslatedText>{tr(copyState)}</TranslatedText></span>
      <button type="button" className="button primary" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopyState("Copied SQL."); }
        catch { setCopyState("Copy unavailable. Select the SQL above to copy manually."); }
      }}><TranslatedText>{tr("Copy SQL")}</TranslatedText></button>
    </footer>
  </Dialog>;
}
