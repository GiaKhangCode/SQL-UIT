import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { studentApi } from "../../services/studentApi";
import { type Submission } from "../../data/models";
import { SubmissionDetails } from "../../components/SubmissionDetails";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, PageHeading, Status } from "../../components/ui";
import { submissionTimeLabel } from "../../utils/serverDateTime";

export function SubmissionsPage() {
  const [selected, setSelected] = useState<Submission | null>(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const [source, setSource] = useState("");
  const { data, loading, error } = useLoad(
    () => studentApi.getSubmissions({ search, result, source }),
    [search, result, source],
  );
  
  const { data: problemsList } = useLoad(() => studentApi.getProblems(), []);
  return (
    <section className="page submissions-page">
      <PageHeading
        title="Submissions"
        sub="Your SQL attempts, results and feedback."
      />
      <div className="filters submissions-filters">
        <label className="field search-field">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SQL problems…"
          />
        </label>
        <label className="field">
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {["Practice", "Assignments", "Contests"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Result
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">All results</option>
            {[
              "Accepted",
              "Wrong Answer",
              "Runtime Error",
              "Time Limit Exceeded",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState title="Could not load submissions" message={error} onRetry={() => window.location.reload()} />
      ) : !data?.length ? (
        <Empty title="No submissions found">
          Your attempts will appear here. Try changing the filters or{" "}
          <Link to="/practice">open a practice problem</Link>.
        </Empty>
      ) : (
        <>
          <p className="tiny muted">{data.length} submission{data.length === 1 ? "" : "s"}</p>
          <div
            className="table-scroll submissions-desktop"
            aria-busy={loading}
            tabIndex={0}
            aria-label="Submission history"
          >
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>SQL problem</th>
                  <th>Source</th>
                  <th>Result</th>
                  <th>Submitted ↓</th>
                  <th>
                    <span className="sr-only">Open submission</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((s: Submission) => {
                  const p =
                    problemsList?.find((p: any) => p.id === s.problemId) || {
                      number: "?",
                      title: "Unknown problem",
                    };
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>
                          {p.number}. {p.title}
                        </b>
                      </td>
                      <td>
                        {s.source}
                        <small>{s.context}</small>
                      </td>
                      <td>
                        <Status value={s.result} />
                      </td>
                      <td className="muted">
                        {submissionTimeLabel(s.submittedAt)}
                      </td>
                      <td className="submission-open-cell">
                        <button
                          className="icon-button submission-open-button"
                          onClick={() => setSelected(s)}
                          aria-label={`View details for ${p.title}`}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="submission-mobile-list"
            aria-busy={loading}
            aria-label="Submission history"
          >
            {data.map((s: Submission) => {
              const p =
                problemsList?.find((p: any) => p.id === s.problemId) || {
                  number: "?",
                  title: "Unknown problem",
                };
              return (
                <button
                  className="submission-mobile-row"
                  key={s.id}
                  onClick={() => setSelected(s)}
                >
                  <span className="submission-mobile-main">
                    <span className="submission-mobile-problem">
                      <b>
                        {p.number}. {p.title}
                      </b>
                      <small>{s.source} · {s.context}</small>
                    </span>
                    <Status value={s.result} />
                  </span>
                  <span className="submission-mobile-meta">
                    <small>{submissionTimeLabel(s.submittedAt)}</small>
                    <ChevronRight size={18} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="tiny">Newest first</p>
        </>
      )}
      {selected && (
        <SubmissionDetails
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
      )}
    </section>
  );
}
