import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Contest } from "../../data/mockData";
import { useLoad } from "../../components/useLoad";
import { Empty, Loading, Status } from "../../components/ui";
export function ContestsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useLoad(studentApi.getContests);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  if (loading) return <Loading />;
  if (error || !data) return <p role="alert">{error}</p>;
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
      <h1 className="featured-heading">Featured contests</h1>
      <div className="featured-contests">
        {data.slice(0, 3).map((c, i) => (
          <button
            className={"featured-contest featured-" + i}
            key={c.id}
            onClick={() => details(c)}
          >
            <span>{"{ SQL }"}</span>
            <h2>{c.title}</h2>
            <p>
              {
                [
                  "Joins under pressure",
                  "Represent your class",
                  "Four-person team challenge",
                ][i]
              }
            </p>
            <small>
              {c.status.toUpperCase()} · {c.participants} participants ·{" "}
              {c.problemIds.length} problems
            </small>
          </button>
        ))}
      </div>
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
                  {c.date} · {c.time}–{c.endTime} ICT · {c.problemIds.length}{" "}
                  problems · {c.participants} participants
                </span>
                {c.status === "Active" && (
                  <p className="tiny muted">
                    Demo countdown · 42 minutes remaining
                  </p>
                )}
              </div>
              <button className="text-button" onClick={() => details(c)}>
                View details →
              </button>
            </article>
          ))}
          {!filtered.length && <Empty title="No matching contests" />}
        </div>
        <aside className="hall-of-fame" aria-labelledby="hall-of-fame-title">
          <h2 id="hall-of-fame-title">Hall of Fame</h2>
          <p className="tiny muted">Recent public achievements</p>
          {[
            ["Query Masters", "Team Champion", "SQL Team Challenge · Sep 2026"],
            ["Bao Tran", "1st place", "JOIN Masters Weekly"],
            ["Ngoc Linh", "Fastest solver", "SQL Sprint #04"],
          ].map((r, i) => (
            <div className="fame-row" key={r[0]}>
              <b>0{i + 1}</b>
              <div>
                <strong>{r[0]}</strong>
                <small>{r[1]}</small>
                <small>{r[2]}</small>
              </div>
            </div>
          ))}
          <a className="fame-results-link" href="#contest-feed" onClick={() => setTab("Past")}>
            View published results →
          </a>
        </aside>
      </div>
    </section>
  );
}
