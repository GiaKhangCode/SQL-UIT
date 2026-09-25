import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Contest } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
export function ContestsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useLoad(studentApi.getContests);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  if (loading) return <section className="page contests-page"><Loading label="Loading contests…" /></section>;
  if (error || !data) return <section className="page contests-page"><ErrorState title="Contests unavailable" message={error || "Could not load contests."} onRetry={() => window.location.reload()} /></section>;
  const selected = data.find((c) => c.id === params.get("contest"));
  const filtered = data.filter(
    (c) =>
      (tab === "All" ||
        c.status ===
          (tab === "Live"
            ? "Active"
            : tab === "Past"
              ? "Closed"
              : "Upcoming")) &&
      c.title.toLowerCase().includes(search.toLowerCase()),
  );
  const contestCounts = {
    All: data.length,
    Upcoming: data.filter((c) => c.status === "Upcoming").length,
    Live: data.filter((c) => c.status === "Active").length,
    Past: data.filter((c) => c.status === "Closed").length,
  };
  function details(c: Contest) {
    navigate("/contests/" + c.id);
  }
  if (selected) return <Navigate replace to={"/contests/" + selected.id} />;
  return (
    <section className="page contests-page">
      <div className="page-heading"><h1>Contests</h1><p>Timed SQL challenges for your classes</p></div>
      <div className="contest-toolbar">
        <div
          className="underline-tabs"
          role="tablist"
          aria-label="Contest status"
        >
          {["All", "Upcoming", "Live", "Past"].map((t) => (
            <button
              role="tab"
              aria-selected={t === tab}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t}{" "}
              <span className="contest-tab-count">
                {contestCounts[t as keyof typeof contestCounts]}
              </span>
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="contest-search">
          Search contests
        </label>
        <input
          id="contest-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="⌕ Search contests"
        />
      </div>
      <div className="contest-columns">
        <div id="contest-feed">
          <div className="section-heading">
            <h2>{tab === "All" ? "All contests" : tab + " contests"}</h2>
            <span className="tiny muted">{filtered.length} available</span>
          </div>
          {filtered.map((c) => (
            <article className="contest-item" key={c.id}>
              <div>
                <div className="contest-title">
                  <h3>{c.title}</h3>
                  <Status value={c.status} />
                </div>
                <small>{c.scope}</small>
                <p>{c.description}</p>
                <span className="tiny">
                  {c.date} {c.time} → {c.endDate || c.date} {c.endTime} · {c.problemIds.length}{" "}
                  problem{c.problemIds.length === 1 ? "" : "s"} · {c.submitters ?? "—"} student{c.submitters === 1 ? "" : "s"} submitted on included problems
                </span>
              </div>
              <button className="text-button" onClick={() => details(c)}>
                View details →
              </button>
            </article>
          ))}
          {!filtered.length && <Empty title="No matching contests" />}
        </div>
        <aside className="hall-of-fame" aria-label="Contest guidance">
          <h2>Ready to compete?</h2>
          <p className="tiny muted">Open a contest to see its schedule and problems. Your submissions are saved to your account.</p>
          <Link className="fame-results-link" to="/submissions">View your submissions →</Link>
        </aside>
      </div>
    </section>
  );
}
