import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Dialog, Empty, ErrorState, Loading, Status } from "../../components/ui";
import {
  PracticeActivity,
  PracticeTrending,
} from "../../components/PracticeSidebar";
export function PracticePage() {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [progress, setProgress] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filterDialog, setFilterDialog] = useState(false);
  const [pendingFilters, setPendingFilters] = useState({
    topic: "",
    difficulty: "",
    progress: "",
  });
  const [listsOpen, setListsOpen] = useState(true);
  const [selectedList, setSelectedList] = useState("");
  const [createList, setCreateList] = useState(false);
  const [listName, setListName] = useState("");
  const [listError, setListError] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { data: prefData, loading: prefLoading, error: prefError, mutate: mutatePref } = useLoad(
    studentApi.getPreferences,
  );
  const { data: dashData, loading: dashLoading, error: dashError } = useLoad(studentApi.getDashboard);
  const { data: catalogData } = useLoad(studentApi.getProblems);
  const topics = [...new Set((catalogData || []).flatMap((problem) =>
    (Array.isArray(problem.topics) ? problem.topics : String(problem.topic || "").split(","))
      .map((value: string) => value.trim()).filter(Boolean),
  ))].sort();

  const favoriteIds = prefData?.favorites || [];
  const lists = prefData?.customLists || [];

  const {
    data: rawProblems,
    loading,
    error,
  } = useLoad(
    async () =>
      await studentApi.getProblems({
        search,
        topic,
        difficulty,
        progress,
        includeTrending: true,
      }),
    [search, topic, difficulty, progress],
  );

  const data =
    rawProblems?.filter(
      (p) =>
        (!favoritesOnly || favoriteIds.includes(p.id)) &&
        (!selectedList ||
          lists
            .find((list: any) => list.id === selectedList)
            ?.problemIds.includes(p.id)),
    ) || [];
  useEffect(() => {
    setVisibleCount(8);
  }, [search, topic, difficulty, progress, favoritesOnly, selectedList]);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !data || visibleCount >= data.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + 8, data.length));
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [data, visibleCount]);
  function clear() {
    setSearch("");
    setTopic("");
    setDifficulty("");
    setProgress("");
    setFavoritesOnly(false);
    setSelectedList("");
  }
  return (
    <section className="page practice-page" aria-label="Practice problems">
      <div className="practice-layout">
        <div className="practice-main">
          <div className="filters">
            <label className="field search-field">
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or problem ID"
              />
            </label>
            <label className="field practice-desktop-filter">
              Topic
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">All</option>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field practice-desktop-filter">
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">All</option>
                {["Easy", "Medium", "Hard"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="field practice-desktop-filter">
              Status
              <select
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              >
                <option value="">All</option>
                {["Solved", "In progress", "Not started"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="practice-mobile-actions">
            <button
              className="button"
              onClick={() => {
                setPendingFilters({ topic, difficulty, progress });
                setFilterDialog(true);
              }}
            >
              Filters
              {[topic, difficulty, progress].filter(Boolean).length
                ? " · " + [topic, difficulty, progress].filter(Boolean).length
                : ""}
            </button>
            <select
              className="practice-mobile-list-select"
              aria-label="Choose problem list"
              value={favoritesOnly ? "favorites" : selectedList ? `list:${selectedList}` : ""}
              onChange={(event) => {
                if (event.target.value === "create") {
                  setListName("");
                  setListError("");
                  setCreateList(true);
                  return;
                }
                setFavoritesOnly(event.target.value === "favorites");
                setSelectedList(event.target.value.startsWith("list:") ? event.target.value.slice(5) : "");
              }}
            >
              <option value="">All problems</option>
              <option value="favorites" disabled={prefLoading || !!prefError}>Saved</option>
              {lists.map((list: any) => <option key={list.id} value={`list:${list.id}`}>{list.name}</option>)}
              <option value="create">+ New list</option>
            </select>
          </div>
          <div className="problem-list" aria-busy={loading}>
            {prefError && (favoritesOnly || selectedList) && <p role="alert">Could not load saved problems and lists.</p>}
            {loading && rawProblems && (
              <span className="sr-only" role="status">
                Updating problem results…
              </span>
            )}
            {loading && !rawProblems ? (
              <Loading />
            ) : error ? (
              <ErrorState title="Could not load problems" message={error} onRetry={() => window.location.reload()} />
            ) : !data?.length ? (
              <Empty
                title={
                  catalogData?.length
                    ? "No matching problems"
                    : "No problems available"
                }
              >
                Try another search or filter.{" "}
                <button className="text-button" onClick={clear}>
                  Clear filters
                </button>
              </Empty>
            ) : (
              <>
                <div className="problem-list-heading">
                  <span>ID</span>
                  <b>Problem</b>
                  <span>Topic</span>
                  <span>Difficulty</span>
                  <span>Status</span>
                </div>
                {data.slice(0, visibleCount).map((p) => (
                  <Link
                    className="problem-row"
                    key={p.id}
                    to={"/workspace/" + p.id}
                  >
                    <span className="problem-number muted">{p.number}</span>
                    <b>{p.title}</b>
                    <div className="problem-details">
                      <span className="problem-topic">{Array.isArray(p.topics) && p.topics.length ? p.topics.join(" · ") : p.topic || "—"}</span>
                      <span
                        className={"difficulty " + p.difficulty.toLowerCase()}
                      >
                        {p.difficulty}
                      </span>
                    </div>
                    <Status value={p.progress} />
                  </Link>
                ))}
                <div
                  ref={loadMoreRef}
                  className="practice-load-more"
                  aria-live="polite"
                >
                  {visibleCount < data.length
                    ? "Loading more problems…"
                    : `Showing all ${data.length} problem${data.length === 1 ? "" : "s"}`}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="practice-sidebar">
          {dashLoading ? <Loading label="Loading activity…" /> : dashError ? <p role="alert">Could not load activity.</p> : <PracticeActivity submissions={dashData?.submissionsPerDay || []} />}
          <section className="practice-lists">
            <div className="practice-lists-heading">
              <h3>My Lists</h3>
              <button
                aria-label="Create problem list"
                onClick={() => {
                  setListName("");
                  setListError("");
                  setCreateList(true);
                }}
              >
                +
              </button>
              <button
                aria-label={listsOpen ? "Collapse lists" : "Expand lists"}
                aria-expanded={listsOpen}
                aria-controls="practice-list-items"
                onClick={() => setListsOpen((value) => !value)}
              >
                {listsOpen ? "⌄" : "›"}
              </button>
            </div>
            {listsOpen && (
              <div id="practice-list-items">
                <button
                  className="favorite-list-toggle"
                  aria-pressed={favoritesOnly}
                  disabled={prefLoading || !!prefError}
                  onClick={() => {
                    setFavoritesOnly((value) => !value);
                    setSelectedList("");
                  }}
                >
                  <span>★</span> Favorite{" "}
                  <small aria-label="Private list">♙</small>
                </button>
                {lists.map((list: any) => (
                  <button
                    className="custom-list-toggle"
                    key={list.id}
                    aria-pressed={selectedList === list.id}
                    onClick={() => {
                      setSelectedList((value) =>
                        value === list.id ? "" : list.id,
                      );
                      setFavoritesOnly(false);
                    }}
                  >
                    {list.name}
                    <small>{list.problemIds.length}</small>
                  </button>
                ))}
                {prefLoading && <p className="tiny muted" role="status">Loading saved lists…</p>}
                {prefError && <p className="tiny muted" role="alert">Could not load saved lists.</p>}
              </div>
            )}
          </section>
          <PracticeTrending />
        </aside>
      </div>
      {filterDialog && (
        <Dialog
          title="Filters"
          className="practice-filter-dialog"
          onClose={() => setFilterDialog(false)}
        >
          <div className="practice-filter-fields">
            {[
              {
                label: "Topic",
                key: "topic" as const,
                values: topics,
              },
              {
                label: "Difficulty",
                key: "difficulty" as const,
                values: ["Easy", "Medium", "Hard"],
              },
              {
                label: "Status",
                key: "progress" as const,
                values: ["Solved", "In progress", "Not started"],
              },
            ].map((field) => (
              <label className="field" key={field.key}>
                {field.label}
                <select
                  value={pendingFilters[field.key]}
                  onChange={(e) =>
                    setPendingFilters((value) => ({
                      ...value,
                      [field.key]: e.target.value,
                    }))
                  }
                >
                  <option value="">All</option>
                  {field.values.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="button"
              onClick={() =>
                setPendingFilters({ topic: "", difficulty: "", progress: "" })
              }
            >
              Clear filters
            </button>
            <button
              className="button primary"
              onClick={() => {
                setTopic(pendingFilters.topic);
                setDifficulty(pendingFilters.difficulty);
                setProgress(pendingFilters.progress);
                setFilterDialog(false);
              }}
            >
              Apply
            </button>
          </div>
        </Dialog>
      )}
      {createList && (
        <Dialog
          title="Create problem list"
          onClose={() => setCreateList(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!listName.trim()) return;
              setListBusy(true);
              setListError("");
              try {
                await studentApi.createList(listName, data?.map((p) => p.id) || []);
                mutatePref();
                setCreateList(false);
              } catch (error) {
                setListError(error instanceof Error ? error.message : "Could not create the list.");
              } finally {
                setListBusy(false);
              }
            }}
          >
            <label className="field">
              List name
              <input
                value={listName}
                maxLength={60}
                required
                onChange={(e) => setListName(e.target.value)}
              />
            </label>
            <p className="tiny muted">
              Save the current {data?.length || 0} problem results to a private
              list in your account.
            </p>
            {listError && <p role="alert" className="field-error">{listError}</p>}
            <div className="dialog-actions">
              <button
                className="button"
                type="button"
                onClick={() => setCreateList(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!listName.trim() || loading || listBusy}
                type="submit"
              >
                Create list
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
