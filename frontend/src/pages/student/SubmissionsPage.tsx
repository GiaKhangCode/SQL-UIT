import { useState } from "react";
import { Link } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { problems, type Submission } from "../../data/mockData";
import { SubmissionDetails } from "../../components/SubmissionDetails";
import { useLoad } from "../../components/useLoad";
import { Empty, Loading, PageHeading, Status } from "../../components/ui";
export function SubmissionsPage() {
  const [selected, setSelected] = useState<Submission | null>(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const [source, setSource] = useState("");
  const { data, loading, error } = useLoad(
    () => studentApi.getSubmissions({ search, result, source }),
    [search, result, source],
  );
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
        <label className="field">
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {["Practice", "Assignments", "Contests"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !data?.length ? (
        <Empty title="No submissions found">
          Your attempts will appear here. Try changing the filters or{" "}
          <Link to="/practice">open a practice problem</Link>.
        </Empty>
      ) : (
        <>
          <p className="tiny muted">{data.length} submissions</p>
          <div
            className="table-scroll"
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
                  <th>Score</th>
                  <th>Submitted (ICT)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const p = problems.find((p) => p.id === s.problemId)!;
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
                      <td>{s.score}/100</td>
                      <td className="muted">
                        {new Date(s.submittedAt).toLocaleString("en-GB", {
                          timeZone: "Asia/Ho_Chi_Minh",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelected(s)}
                        >
                          View details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tiny">
            Newest first · Each row is one mock submission.
          </p>
        </>
      )}
      {selected && (
        <SubmissionDetails
          submission={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
