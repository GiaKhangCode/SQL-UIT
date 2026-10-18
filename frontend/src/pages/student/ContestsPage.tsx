import { TranslatedText } from "../../components/TranslatedText";
import type { Translator } from "../../i18n";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Contest } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
import { contestBannerClass, contestBannerStyle } from "../../utils/contestBanner";
import { selectFeaturedContests } from "../../utils/featuredContests";

const CONTEST_PAGE_SIZE = 10;

function ContestCountdown({ contest }: { contest: Contest }) {
  const { t: tr } = useLanguage("student");
  const [now, setNow] = useState(Date.now);
  const active = contest.status === "Live" || contest.status === "Upcoming";
  const value = contest.status === "Live" ? contest.closesAt : contest.opensAt;
  // The API stores UTC timestamps without a timezone suffix.
  const target = new Date(value && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value + "Z" : value).getTime();
  useEffect(() => {
    if (!active || !Number.isFinite(target)) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, target]);
  if (!active || !Number.isFinite(target)) return null;
  const remaining = Math.max(0, Math.ceil((target - now) / 1000));
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const duration = `${days ? days + "d " : ""}${hours}h ${minutes}m ${seconds}s`;
  const label = remaining === 0
    ? contest.status === "Live" ? tr("Ended") : tr("Starting now")
    : `${tr(contest.status === "Live" ? "Ends in" : "Starts in")} ${duration}`;
  return <span className={`contest-countdown ${contest.status.toLowerCase()}`} role="timer" aria-live="off"><TranslatedText>{tr(label)}</TranslatedText></span>;
}

function contestTimestamp(contest: Contest) {
  const timestamp = new Date(contest.opensAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function featureMeta(contest: Contest, tr: Translator) {
  const problemLabel = tr("{count} problems", { count: contest.problemCount });
  const participants = contest.submitters
    ? ` · ${tr("{count} participants", { count: contest.submitters })}`
    : "";
  if (contest.status === "Live") return `${tr("Live now")} · ${problemLabel}${participants}`;
  return `${contest.date} ${contest.time} · ${problemLabel}${participants}`;
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] || "th"}`;
}

function completionMonth(contest: Contest, locale: string) {
  const date = new Date(contest.closesAt);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(locale, { month: "short", year: "numeric" })
    : contest.endDate || contest.date;
}

function selectHallOfFame(contests: Contest[]) {
  return contests
    .filter((contest) => contest.status === "Closed" && contest.leaderboardEnabled)
    .sort((left, right) => contestTimestamp(right) - contestTimestamp(left))
    .flatMap((contest) => contest.leaderboard.map((entry) => ({ contest, ...entry })))
    .slice(0, 3);
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

function useFeaturedCardsInView() {
  const [cardsInView, setCardsInView] = useState(2);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 960px)");
    const update = () => setCardsInView(query.matches ? 1 : 2);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return cardsInView;
}

function FeaturedContestCard({ contest, onOpen, sentinel = false }: {
  contest: Contest;
  onOpen: (contest: Contest) => void;
  sentinel?: boolean;
}) {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  return <button
    className={`featured-contest ${contestBannerClass(contest.id)}${contest.bannerUrl ? " has-image" : ""}`}
    type="button"
    onClick={() => onOpen(contest)}
    tabIndex={sentinel ? -1 : undefined}
    aria-hidden={sentinel || undefined}
    aria-label={tr("Open {value0} contest details", { value0: contest.title })}
    style={contestBannerStyle(contest.bannerUrl)}
  >
    <span><TranslatedText>{tr(contest.status).toLocaleUpperCase(uiLocale)}</TranslatedText> · SQL</span>
    <h3>{contest.title}</h3>
    <p><TranslatedText>{contest.shortDescription || tr("SQL challenges for {value0}.", { value0: contest.scope.toLowerCase() })}</TranslatedText></p>
    <small className="featured-contest-meta"><ContestCountdown contest={contest} /><span>{featureMeta(contest, tr)}</span></small>
  </button>;
}

function FeaturedContests({ contests, onOpen }: { contests: Contest[]; onOpen: (contest: Contest) => void }) {
  const { t: tr } = useLanguage("student");
  const viewport = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<number>();
  const gestureStartX = useRef<number | null>(null);
  const suppressCardOpen = useRef(false);
  const reducedMotion = useReducedMotion();
  const preferredCardsInView = useFeaturedCardsInView();
  const cardsInView = Math.min(preferredCardsInView, contests.length);
  const canNavigate = contests.length > cardsInView;
  const [displayIndex, setDisplayIndex] = useState(canNavigate ? 1 : 0);
  const [slideStep, setSlideStep] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rotationVersion, setRotationVersion] = useState(0);
  const contestKey = contests.map((contest) => contest.id).join("|");
  const carouselContests = canNavigate ? [contests[contests.length - 1], ...contests, contests[0]] : contests;

  useLayoutEffect(() => {
    setDisplayIndex(canNavigate ? 1 : 0);
    setIsSliding(false);
  }, [canNavigate, contestKey]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !cardsInView) return;
    const updateStep = () => {
      const gap = Number.parseFloat(getComputedStyle(element).getPropertyValue("--featured-carousel-gap")) || 16;
      setSlideStep((element.clientWidth - gap * (cardsInView - 1)) / cardsInView + gap);
    };
    updateStep();
    const observer = new ResizeObserver(updateStep);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cardsInView]);

  function clearResumeTimer() {
    if (resumeTimer.current !== undefined) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = undefined;
    }
  }

  function pauseRotation() {
    clearResumeTimer();
    setIsPaused(true);
  }

  function resumeRotation() {
    clearResumeTimer();
    resumeTimer.current = window.setTimeout(() => {
      resumeTimer.current = undefined;
      setIsPaused(false);
    }, 1200);
  }

  function move(direction: -1 | 1, manual = false) {
    if (!canNavigate || isSliding) return;
    if (manual) setRotationVersion((version) => version + 1);
    if (reducedMotion) {
      setDisplayIndex((current) => {
        const next = current + direction;
        if (next === 0) return contests.length;
        if (next === contests.length + 1) return 1;
        return next;
      });
      return;
    }
    if (!slideStep) return;
    setIsSliding(true);
    setDisplayIndex((current) => current + direction);
  }

  useEffect(() => {
    const shouldRotate = contests.length >= 3 && canNavigate && !reducedMotion && !isPaused && !isSliding;
    if (!shouldRotate) return;
    const timer = window.setTimeout(() => move(1), 4000);
    return () => window.clearTimeout(timer);
  }, [canNavigate, contests.length, displayIndex, isPaused, isSliding, reducedMotion, rotationVersion]);

  useEffect(() => () => clearResumeTimer(), []);

  function finishSlide(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    setIsSliding(false);
    setDisplayIndex((current) => {
      if (current === 0) return contests.length;
      if (current === contests.length + 1) return 1;
      return current;
    });
  }

  function finishGesture(clientX: number) {
    if (gestureStartX.current === null) return;
    const movement = clientX - gestureStartX.current;
    gestureStartX.current = null;
    if (Math.abs(movement) >= 36) {
      suppressCardOpen.current = true;
      move(movement < 0 ? 1 : -1, true);
      window.setTimeout(() => { suppressCardOpen.current = false; }, 0);
    }
    resumeRotation();
  }

  if (!contests.length) return null;
  return <section className="featured-contest-section" aria-labelledby="featured-contests-heading">
    <div className="featured-contest-heading-row">
      <h2 id="featured-contests-heading" className="featured-heading"><TranslatedText>{tr("Featured contests")}</TranslatedText></h2>
      {canNavigate && <div className="featured-carousel-controls" aria-label={tr("Featured contest navigation")}>
        <button className="featured-carousel-control" type="button" onClick={() => move(-1, true)} aria-label={tr("Previous featured contests")}><ChevronLeft size={16} aria-hidden="true" /></button>
        <button className="featured-carousel-control" type="button" onClick={() => move(1, true)} aria-label={tr("Next featured contests")}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>}
    </div>
    <div
      ref={viewport}
      className="featured-carousel"
      data-visible={cardsInView}
      onPointerEnter={pauseRotation}
      onPointerLeave={resumeRotation}
      onFocusCapture={pauseRotation}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resumeRotation();
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") {
          pauseRotation();
          gestureStartX.current = event.clientX;
        }
      }}
      onPointerUp={(event) => finishGesture(event.clientX)}
      onPointerCancel={() => { gestureStartX.current = null; resumeRotation(); }}
    >
      <div
        className="featured-carousel-track"
        style={{ transform: `translate3d(-${displayIndex * slideStep}px, 0, 0)`, transition: isSliding && !reducedMotion ? "transform 420ms cubic-bezier(.2, .7, .2, 1)" : "none" }}
        onTransitionEnd={finishSlide}
      >
        {carouselContests.map((contest, index) => <FeaturedContestCard
          contest={contest}
          key={`${contest.id}-${index}`}
          onOpen={(selectedContest) => {
            if (suppressCardOpen.current) {
              suppressCardOpen.current = false;
              return;
            }
            onOpen(selectedContest);
          }}
          sentinel={canNavigate && (index === 0 || index === carouselContests.length - 1)}
        />)}
      </div>
    </div>
  </section>;
}

export function ContestsPage() {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  const navigate = useNavigate();
  const { data, loading, error } = useLoad(studentApi.getContests);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const feedRef = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  if (loading) return <section className="page contests-page"><Loading label={tr("Loading contests…")} /></section>;
  if (error || !data) return <section className="page contests-page"><ErrorState title={tr("Contests unavailable")} message={tr(error) || tr("Could not load contests.")} onRetry={() => window.location.reload()} /></section>;
  const selected = data.find((contest) => contest.id === params.get("contest"));
  const filtered = data.filter(
    (contest) =>
      (tab === "All" || contest.status === (tab === "Live" ? "Live" : tab === "Past" ? "Closed" : "Upcoming")) &&
      `${contest.title} ${contest.shortDescription} ${contest.scope}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / CONTEST_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * CONTEST_PAGE_SIZE;
  const pageContests = filtered.slice(firstIndex, firstIndex + CONTEST_PAGE_SIZE);
  function changePage(nextPage: number) {
    setPage(nextPage);
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0 }));
  }
  const contestCounts = {
    All: data.length,
    Upcoming: data.filter((contest) => contest.status === "Upcoming").length,
    Live: data.filter((contest) => contest.status === "Live").length,
    Past: data.filter((contest) => contest.status === "Closed").length,
  };
  const featured = selectFeaturedContests(data);
  const hallOfFame = selectHallOfFame(data);
  function details(contest: Contest) {
    navigate(`/contests/${contest.id}`);
  }
  if (selected) return <Navigate replace to={`/contests/${selected.id}`} />;
  return <section className="page contests-page">
    <h1 className="sr-only"><TranslatedText>{tr("Contests")}</TranslatedText></h1>
    <FeaturedContests contests={featured} onOpen={details} />
    <div className="contest-list-region">
    <div className="contest-toolbar">
      <div className="underline-tabs contest-status-tabs" role="tablist" aria-label={tr("Contest status")}>
        {["All", "Upcoming", "Live", "Past"].map((currentTab) => <button role="tab" aria-selected={currentTab === tab} className={currentTab === tab ? "active" : ""} onClick={() => { setTab(currentTab); setPage(1); feedRef.current?.scrollTo({ top: 0 }); }} key={currentTab}>
          <TranslatedText>{tr(currentTab)}</TranslatedText> <span className="contest-tab-count">{contestCounts[currentTab as keyof typeof contestCounts]}</span>
        </button>)}
      </div>
      <label className="sr-only" htmlFor="contest-search"><TranslatedText>{tr("Search contests")}</TranslatedText></label>
      <input id="contest-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); feedRef.current?.scrollTo({ top: 0 }); }} placeholder={tr("⌕ Search contests")} />
    </div>
    <div className="contest-columns">
      <div id="contest-feed" className="contest-feed-panel">
        <div className="section-heading"><h2><TranslatedText>{tab === "All" ? tr("All contests") : tr("{value0} contests", { value0: tab })}</TranslatedText></h2><div className="contest-list-controls">
          <span className="tiny muted" aria-live="polite"><TranslatedText>{tr("Showing")}</TranslatedText> {filtered.length ? firstIndex + 1 : 0}–{Math.min(firstIndex + CONTEST_PAGE_SIZE, filtered.length)} <TranslatedText>{tr("of")}</TranslatedText> {filtered.length}</span>
          <nav className="contest-list-pagination" aria-label={tr("Contest pages")}>
            <button type="button" className="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
            <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
            <button type="button" className="button" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
          </nav>
        </div></div>
        <div className="contest-feed-scroll" ref={feedRef} tabIndex={0} aria-label={tr("Contest list")}>
        {pageContests.map((contest) => <article className="contest-item" key={contest.id} id={`student-contest-${contest.id}`}>
          <div>
            <div className="contest-title"><h3>{contest.title}</h3><Status value={contest.status} /><ContestCountdown contest={contest} /></div>
            <small>{contest.scope}</small>
            <p>{contest.shortDescription}</p>
            <span className="tiny">{contest.date} {contest.time} → {contest.endDate || contest.date} {contest.endTime} · {contest.problemCount} <TranslatedText>{tr("problem")}</TranslatedText><TranslatedText>{contest.problemCount === 1 ? "" : tr("s")}</TranslatedText> · {contest.submitters ?? 0} <TranslatedText>{tr("student")}</TranslatedText><TranslatedText>{contest.submitters === 1 ? "" : tr("s")}</TranslatedText> <TranslatedText>{tr("participated")}</TranslatedText></span>
          </div>
          <button className="text-button" onClick={() => details(contest)}><TranslatedText>{tr("View details →")}</TranslatedText></button>
        </article>)}
        {!filtered.length && <Empty title={tr("No matching contests")} />}
        </div>
      </div>
      <aside className="hall-of-fame" aria-label={tr("Hall of Fame")}>
        <h2><TranslatedText>{tr("Hall of Fame")}</TranslatedText></h2>
        <p className="fame-description"><TranslatedText>{tr("Recent public achievements")}</TranslatedText></p>
        {hallOfFame.length > 0 ? <ol className="fame-list">
          {hallOfFame.map((entry, index) => <li className="fame-row" key={`${entry.contest.id}-${entry.rank}-${entry.student}`}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <div>
              <strong>{entry.student}</strong>
              <small className="fame-place"><TranslatedText>{uiLocale === "vi-VN" ? tr("Rank {rank}", { rank: entry.rank }) : `${ordinal(entry.rank)} place`}</TranslatedText></small>
              <small className="fame-contest">{entry.contest.title}</small>
              <time className="fame-date">{completionMonth(entry.contest, uiLocale)}</time>
            </div>
          </li>)}
        </ol> : <p className="fame-empty"><TranslatedText>{tr("Published results will appear here after a leaderboard contest closes.")}</TranslatedText></p>}
      </aside>
    </div>
    </div>
  </section>;
}
