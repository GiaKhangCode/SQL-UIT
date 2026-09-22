import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { problems } from "../../data/mockData";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Dialog, Empty, Loading, Status } from "../../components/ui";
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
  const [visibleCount, setVisibleCount] = useState(8);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { data: prefData, mutate: mutatePref } = useLoad(
    studentApi.getPreferences,
  );
  const { data: dashData } = useLoad(studentApi.getDashboard);

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
                {[...new Set(problems.map((p) => p.topic))].map((t) => (
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
            <div>
              <button
                className="button"
                aria-label="Show all practice problems"
                aria-pressed={!favoritesOnly && !selectedList}
                onClick={() => {
                  setFavoritesOnly(false);
                  setSelectedList("");
                }}
              >
                ✎
              </button>
              <button
                className="button"
                aria-label="Show favorite problems"
                aria-pressed={favoritesOnly}
                onClick={() => {
                  setFavoritesOnly((value) => !value);
                  setSelectedList("");
                }}
              >
                ☆
              </button>
            </div>
          </div>
          <div className="problem-list" aria-busy={loading}>
            {loading && rawProblems && (
              <span className="sr-only" role="status">
                Updating problem results…
              </span>
            )}
            {loading && !rawProblems ? (
              <Loading />
            ) : error ? (
              <p role="alert">{error}</p>
            ) : !data?.length ? (
              <Empty
                title={
                  problems.length
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
                      <span className="problem-topic">{p.topic}</span>
                      <span
                        className={"difficulty " + p.difficulty.toLowerCase()}
                      >
                        {p.difficulty}
                      </span>
                    </div>
                    <Status
                      value={p.progress}
                      tone={
                        p.progress === "In progress"
                          ? p.topic === "GROUP BY"
                            ? "warning"
                            : "neutral"
                          : undefined
                      }
                    />
                  </Link>
                ))}
                <div
                  ref={loadMoreRef}
                  className="practice-load-more"
                  aria-live="polite"
                >
                  {visibleCount < data.length
                    ? "Loading more problems…"
                    : `Showing all ${data.length} problems`}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="practice-sidebar">
          <PracticeActivity submissions={dashData?.submissionsPerDay || []} />
          <section className="practice-lists">
            <div className="practice-lists-heading">
              <h3>My Lists</h3>
              <button
                aria-label="Create problem list"
                onClick={() => {
                  setListName("");
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
                values: [
                  ...new Set(
                    problems
                      .filter((p) => p.practiceListed !== false)
                      .map((p) => p.topic),
                  ),
                ],
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
              await studentApi.createList(
                listName,
                data?.map((p) => p.id) || [],
              );
              mutatePref();
              setCreateList(false);
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
              Save the current {data?.length || 0} problem results as a private
              local list.
            </p>
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
                disabled={!listName.trim() || loading}
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
