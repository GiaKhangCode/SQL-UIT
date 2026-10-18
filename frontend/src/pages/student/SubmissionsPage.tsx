import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Submission } from "../../data/models";
import { SubmissionDetails } from "../../components/SubmissionDetails";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
import { submissionTimeLabel } from "../../utils/serverDateTime";

const SUBMISSION_PAGE_SIZE = 15;

export function SubmissionsPage() {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const desktopListRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const { data, loading, error } = useLoad(
    () => studentApi.getSubmissions({ search, result, source }),
    [search, result, source],
  );
  
  const { data: problemsList } = useLoad(() => studentApi.getProblems({ includePrivate: true }), []);
  const pageCount = Math.max(1, Math.ceil((data?.length || 0) / SUBMISSION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * SUBMISSION_PAGE_SIZE;
  const pageSubmissions = (data || []).slice(firstIndex, firstIndex + SUBMISSION_PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [search, source, result]);
  useEffect(() => {
    desktopListRef.current?.scrollTo({ top: 0 });
    mobileListRef.current?.scrollTo({ top: 0 });
  }, [currentPage, search, source, result]);
  useEffect(() => {
    const visible = (data || []).slice(firstIndex, firstIndex + SUBMISSION_PAGE_SIZE);
    setSelected((previous) => visible.find((submission: Submission) => submission.id === previous?.id) || visible[0] || null);
  }, [data, firstIndex]);
  return (
    <section className="page submissions-page compact-tables-page compact-student-submissions">
      <h1 className="sr-only"><TranslatedText>{tr("Submissions")}</TranslatedText></h1>
      <div className="submissions-split">
      <div className="submissions-list-column">
      <div className="filters submissions-filters">
        <label className="field search-field">
          <TranslatedText>{tr("Search")}</TranslatedText>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Search SQL problems…")}
          />
        </label>
        <label className="field">
          <TranslatedText>{tr("Source")}</TranslatedText>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{tr("All sources")}</option>
            {["Practice", "Assignments", "Contests"].map((v) => (
              <option key={v} value={v}>{tr(v)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <TranslatedText>{tr("Result")}</TranslatedText>
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">{tr("All results")}</option>
            {[
              "Accepted",
              "Wrong Answer",
              "Runtime Error",
              "Time Limit Exceeded",
              "Rejected",
            ].map((v) => (
              <option key={v} value={v}>{tr(v)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="submissions-results-frame">
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState title={tr("Could not load submissions")} message={tr(error)} onRetry={() => window.location.reload()} />
      ) : !data?.length ? (
        <Empty title={tr("No submissions found")}>
          <TranslatedText>{tr("Your attempts will appear here. Try changing the filters or")}</TranslatedText>{" "}
          <Link to="/assignments"><TranslatedText>{tr("view assignments")}</TranslatedText></Link>.
        </Empty>
      ) : (
        <>
          <div
            className="table-scroll submissions-desktop"
            ref={desktopListRef}
            aria-busy={loading}
            tabIndex={0}
            aria-label={tr("Submission history")}
          >
            <table className="submissions-table">
              <colgroup><col style={{ width: "40%" }} /><col style={{ width: "23%" }} /><col style={{ width: "15%" }} /><col style={{ width: "22%" }} /></colgroup>
              <thead>
                <tr>
                  <th><TranslatedText>{tr("SQL problem")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Source")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Result")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Submitted ↓")}</TranslatedText></th>
                </tr>
              </thead>
              <tbody>
                {pageSubmissions.map((s: Submission) => {
                  const p =
                    problemsList?.find((p: any) => p.id === s.problemId) || {
                      number: "?",
                      title: "Unknown problem",
                    };
                  return (
                    <tr key={s.id} className={selected?.id === s.id ? "selected" : undefined} onClick={() => setSelected(s)}>
                      <td>
                        <button type="button" className="submission-select-button" onClick={() => setSelected(s)} aria-pressed={selected?.id === s.id}>
                          {p.number}. {p.title}
                        </button>
                      </td>
                      <td>
                        <TranslatedText>{tr(s.source)}</TranslatedText>
                        <small>{s.contextTitle || s.context}</small>
                      </td>
                      <td>
                        <Status value={s.result} />
                      </td>
                      <td className="muted">
                        <TranslatedText>{tr(submissionTimeLabel(s.submittedAt, uiLocale))}</TranslatedText>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="submission-mobile-list"
            ref={mobileListRef}
            aria-busy={loading}
            aria-label={tr("Submission history")}
          >
            {pageSubmissions.map((s: Submission) => {
              const p =
                problemsList?.find((p: any) => p.id === s.problemId) || {
                  number: "?",
                  title: "Unknown problem",
                };
              return (
                <button
                  className={`submission-mobile-row${selected?.id === s.id ? " selected" : ""}`}
                  aria-pressed={selected?.id === s.id}
                  key={s.id}
                  onClick={() => setSelected(s)}
                >
                  <span className="submission-mobile-main">
                    <span className="submission-mobile-problem">
                      <b>
                        {p.number}. {p.title}
                      </b>
                      <small><TranslatedText>{tr(s.source)}</TranslatedText> · {s.contextTitle || s.context}</small>
                    </span>
                    <Status value={s.result} />
                  </span>
                  <span className="submission-mobile-meta">
                    <small><TranslatedText>{tr(submissionTimeLabel(s.submittedAt, uiLocale))}</TranslatedText></small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="submissions-pagination-footer">
            <p aria-live="polite"><TranslatedText>{tr("Showing")}</TranslatedText> {firstIndex + 1}–{Math.min(firstIndex + SUBMISSION_PAGE_SIZE, data.length)} <TranslatedText>{tr("of")}</TranslatedText> {data.length} <TranslatedText>{tr("submissions · Newest first")}</TranslatedText></p>
            <nav className="submissions-pagination" aria-label={tr("Submission pages")}>
              <button type="button" className="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
              <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
              <button type="button" className="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
            </nav>
          </div>
        </>
      )}
      </div>
      </div>
      <aside className="submission-inline-panel" aria-label={tr("Selected submission details")}>
      {selected ? (
        <SubmissionDetails
          key={selected.id}
          inline
          submission={selected}
          problem={
            problemsList?.find((p: any) => p.id === selected.problemId) || {
              number: "?",
              title: "Unknown problem",
              id: selected.problemId,
            }
          }
          onClose={() => setSelected(null)}
        />
      ) : (
        <Empty title={tr("Submission details")}><TranslatedText>{tr("Select a submission to view its result and submitted SQL.")}</TranslatedText></Empty>
      )}
      </aside>
      </div>
    </section>
  );
}
