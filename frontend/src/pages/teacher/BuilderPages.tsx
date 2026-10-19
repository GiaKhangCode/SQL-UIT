import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { CalendarDays, X } from "lucide-react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { Dialog, Loading } from "../../components/ui";
import { ProblemRichTextEditor } from "./problem-editor/ProblemRichTextEditor";
import { teacherService } from "../../services/teacherService";
import { ClassPicker, TeacherField, TeacherSectionTitle } from "./TeacherPageParts";
import { toDateTimeLocal } from "../../utils/serverDateTime";
import { ContestDetailView } from "../student/ContestDetailView";
import type { Contest, WorkspacePart } from "../../data/models";
import { ContestBannerCrop, defaultBannerCrop, type BannerCrop } from "../../components/ContestBannerCrop";
import { resolveContestBannerUrl } from "../../utils/contestBanner";
import { WORKSPACE_PARTS, WORKSPACE_PART_LABELS } from "../../utils/workspaceParts";

import "../../styles/problem-workspace.css";

type BuilderProblem = { id: string; points: number; workspaceParts?: WorkspacePart[] };
type BuilderDraft = {
  title: string;
  classIds: string[];
  audienceType: "classes" | "all_students";
  shortDescription: string;
  description: string;
  rules: string;
  bannerUrl: string | null;
  bannerSourceUrl: string | null;
  bannerCrop: string | null;
  instructions: string;
  opens: string;
  closes: string;
  problems: BuilderProblem[];
  studentOptions: { hints: boolean; comments: boolean; leaderboard: boolean; aiAllowed: boolean; examMode: boolean; showScoresAfterSubmit: boolean; maxSubmissions: number | null };
  published: boolean;
};

const assignmentSeed: BuilderDraft = {
  title: "",
  classIds: [],
  audienceType: "classes",
  shortDescription: "",
  description: "",
  rules: "",
  bannerUrl: null,
  bannerSourceUrl: null,
  bannerCrop: null,
  instructions: "",
  opens: "",
  closes: "",
  problems: [],
  studentOptions: { hints: true, comments: true, leaderboard: false, aiAllowed: true, examMode: false, showScoresAfterSubmit: true, maxSubmissions: null },
  published: false,
};
const contestSeed: BuilderDraft = {
  title: "",
  classIds: [],
  audienceType: "classes",
  shortDescription: "",
  description: "",
  rules: "",
  bannerUrl: null,
  bannerSourceUrl: null,
  bannerCrop: null,
  instructions: "",
  opens: "",
  closes: "",
  problems: [],
  studentOptions: { hints: false, comments: false, leaderboard: true, aiAllowed: false, examMode: false, showScoresAfterSubmit: true, maxSubmissions: null },
  published: false,
};

function assignmentWorkspaceParts(value: unknown): WorkspacePart[] {
  if (!Array.isArray(value)) return [...WORKSPACE_PARTS];
  return WORKSPACE_PARTS.filter((part) => value.includes(part));
}

function previewDate(value: string, locale: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Not set";
}

function formatDateForInput(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function parseDateFromInput(displayDate: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(displayDate.trim());
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function DateTimeInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const { t: tr } = useLanguage("teacher");
  const calendarRef = useRef<HTMLInputElement>(null);
  const lastCommittedValue = useRef(value);
  const [dayText, setDayText] = useState(() => value.slice(8, 10));
  const [monthText, setMonthText] = useState(() => value.slice(5, 7));
  const [yearText, setYearText] = useState(() => value.slice(0, 4));
  const initialHour = Number(value.slice(11, 13));
  const [hourText, setHourText] = useState(value ? String((initialHour + 11) % 12 + 1).padStart(2, "0") : "12");
  const [minuteText, setMinuteText] = useState(value.slice(14, 16) || "00");
  const [period, setPeriod] = useState<"AM" | "PM">(initialHour >= 12 ? "PM" : "AM");

  useEffect(() => {
    if (value === lastCommittedValue.current) return;
    lastCommittedValue.current = value;
    setDayText(value.slice(8, 10));
    setMonthText(value.slice(5, 7));
    setYearText(value.slice(0, 4));
    const hour24 = Number(value.slice(11, 13));
    setHourText(value ? String((hour24 + 11) % 12 + 1).padStart(2, "0") : "12");
    setMinuteText(value.slice(14, 16) || "00");
    setPeriod(hour24 >= 12 ? "PM" : "AM");
  }, [value]);

  const isoDate = value.slice(0, 10);
  const parsedDate = parseDateFromInput(`${dayText}/${monthText}/${yearText}`);

  function commit(next: string) {
    lastCommittedValue.current = next;
    onChange(next);
  }

  function commitDateAndTime(date: string, hour = hourText, minute = minuteText, meridiem = period) {
    if (!date || !/^(?:[1-9]|1[0-2])$/.test(hour) || !/^(?:[0-5]?\d)$/.test(minute)) {
      commit("");
      return;
    }
    const hour12 = Number(hour);
    const hour24 = hour12 % 12 + (meridiem === "PM" ? 12 : 0);
    commit(`${date}T${String(hour24).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`);
  }

  function updateDateSegment(part: "day" | "month" | "year", raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, part === "year" ? 4 : 2);
    const nextDay = part === "day" ? digits : dayText;
    const nextMonth = part === "month" ? digits : monthText;
    const nextYear = part === "year" ? digits : yearText;
    if (part === "day") setDayText(digits);
    if (part === "month") setMonthText(digits);
    if (part === "year") setYearText(digits);
    const date = parseDateFromInput(`${nextDay}/${nextMonth}/${nextYear}`);
    if (date) commitDateAndTime(date);
    else commit("");
  }

  function normalizeDateSegment(part: "day" | "month") {
    const valueToNormalize = part === "day" ? dayText : monthText;
    if (!valueToNormalize) return;
    const normalized = valueToNormalize.padStart(2, "0");
    if (part === "day") setDayText(normalized);
    else setMonthText(normalized);
    const date = parseDateFromInput(`${part === "day" ? normalized : dayText}/${part === "month" ? normalized : monthText}/${yearText}`);
    if (date) commitDateAndTime(date);
  }

  function updateDate(date: string) {
    const [year, month, day] = date.split("-");
    setDayText(day || "");
    setMonthText(month || "");
    setYearText(year || "");
    commitDateAndTime(date);
  }

  function updateHour(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 2);
    setHourText(digits);
    if (parsedDate && digits && Number(digits) >= 1 && Number(digits) <= 12) commitDateAndTime(parsedDate, digits);
    else commit("");
  }

  function updateMinute(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 2);
    setMinuteText(digits);
    if (parsedDate && digits && Number(digits) <= 59) commitDateAndTime(parsedDate, hourText, digits);
    else commit("");
  }

  function updatePeriod(next: "AM" | "PM") {
    setPeriod(next);
    if (parsedDate) commitDateAndTime(parsedDate, hourText, minuteText, next);
  }

  return <div className="teacher-datetime-input">
    <div className="teacher-date-segments" aria-label={tr("{value0} date, day month year", { value0: label })}>
      <input type="text" inputMode="numeric" maxLength={2} placeholder="DD" aria-label={tr("{value0} day", { value0: label })}
        value={dayText} onChange={(event) => updateDateSegment("day", event.target.value)}
        onBlur={() => normalizeDateSegment("day")} />
      <span>/</span>
      <input type="text" inputMode="numeric" maxLength={2} placeholder="MM" aria-label={tr("{value0} month", { value0: label })}
        value={monthText} onChange={(event) => updateDateSegment("month", event.target.value)}
        onBlur={() => normalizeDateSegment("month")} />
      <span>/</span>
      <input type="text" inputMode="numeric" maxLength={4} placeholder="YYYY" aria-label={tr("{value0} year", { value0: label })}
        value={yearText} onChange={(event) => updateDateSegment("year", event.target.value)} />
    </div>
    <div className="teacher-time-fields">
      <input type="text" inputMode="numeric" maxLength={2} placeholder="hh" aria-label={tr("{value0} hour", { value0: label })}
        value={hourText} onChange={(event) => updateHour(event.target.value)}
        onBlur={() => { if (hourText && Number(hourText) >= 1 && Number(hourText) <= 12) setHourText(String(Number(hourText)).padStart(2, "0")); }} />
      <span className="teacher-time-separator">:</span>
      <input type="text" inputMode="numeric" maxLength={2} placeholder="mm" aria-label={tr("{value0} minute", { value0: label })}
        value={minuteText} onChange={(event) => updateMinute(event.target.value)}
        onBlur={() => { if (minuteText && Number(minuteText) <= 59) setMinuteText(String(Number(minuteText)).padStart(2, "0")); }} />
      <div className="teacher-ampm-toggle" role="group" aria-label={tr("{value0} AM or PM", { value0: label })}>
        {(["AM", "PM"] as const).map((item) => <button key={item} type="button" className={period === item ? "is-active" : ""}
          aria-pressed={period === item} onClick={() => updatePeriod(item)}><TranslatedText>{tr(item)}</TranslatedText></button>)}
      </div>
    </div>
    <button type="button" className="teacher-date-picker-button" aria-label={tr("Choose {value0} date", { value0: label.toLowerCase() })} onClick={() => {
      const input = calendarRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
      if (!input) return;
      if (input.showPicker) input.showPicker();
      else input.click();
    }}><CalendarDays size={16} /></button>
    <input ref={calendarRef} className="teacher-native-date-picker" type="date" tabIndex={-1} aria-hidden="true" value={isoDate}
      onChange={(event) => updateDate(event.target.value)} />
  </div>;
}

function ActivityPreview({ draft, contest, classes, problems }: {
  draft: BuilderDraft;
  contest: boolean;
  classes: { id: string; course?: string }[];
  problems: { id: string; title: string; topic?: string; difficulty?: string }[];
}) {
  const { t: tr, locale: uiLocale } = useLanguage("teacher");
  const [phase, setPhase] = useState<"Upcoming" | "Live" | "Closed">("Upcoming");
  const [previewNow, setPreviewNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setPreviewNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [selectedClassId, setSelectedClassId] = useState(draft.classIds[0] || "");
  const classId = draft.classIds.includes(selectedClassId) ? selectedClassId : draft.classIds[0];
  const classLabel = classes.find((item) => item.id === classId)?.course || classId || "No class selected";
  const audience = contest && draft.audienceType === "all_students" ? "All students" : classLabel;
  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const title = draft.title.trim() || (contest ? "Untitled contest" : "Untitled assignment");

  return <div className="teacher-activity-preview">
    <div className="teacher-preview-mode-bar">
      <span><TranslatedText>{tr("STUDENT PREVIEW · Draft content is not published")}</TranslatedText></span>
      {draft.audienceType === "classes" && draft.classIds.length > 1 && <label><TranslatedText>{tr("View as class")}</TranslatedText>
        <select value={classId} onChange={(event) => setSelectedClassId(event.target.value)}>
          {draft.classIds.map((id) => <option value={id} key={id}>{classes.find((item) => item.id === id)?.course || id}</option>)}
        </select>
      </label>}
    </div>
    {contest ? <>
      <div className="teacher-preview-phase-tabs" role="group" aria-label={tr("Preview contest state")}>
        {(["Upcoming", "Live", "Closed"] as const).map((item) => <button type="button" key={item} className={phase === item ? "is-active" : ""} aria-pressed={phase === item} onClick={() => setPhase(item)}><TranslatedText>{tr(item)}</TranslatedText></button>)}
      </div>
      <ContestDetailView preview phase={phase} now={previewNow} contest={{
        id: "preview", title, status: phase, scope: audience, audienceType: draft.audienceType,
        shortDescription: draft.shortDescription, description: draft.description, rules: draft.rules,
        bannerUrl: draft.bannerUrl, opensAt: draft.opens ? new Date(draft.opens).toISOString() : "", closesAt: draft.closes ? new Date(draft.closes).toISOString() : "",
        date: draft.opens ? draft.opens.slice(0, 10) : "Not set",
        time: draft.opens ? draft.opens.slice(11, 16) : "",
        endDate: draft.closes ? draft.closes.slice(0, 10) : "Not set",
        endTime: draft.closes ? draft.closes.slice(11, 16) : "",
        problemCount: draft.problems.length, problemIds: draft.problems.map((item) => item.id),
        problemDetails: draft.problems.map((item) => { const problem = problems.find((row) => row.id === item.id); return {
          id: item.id, title: problem?.title || item.id, difficulty: problem?.difficulty || "SQL problem",
          topic: problem?.topic || "SQL", points: item.points,
        }; }),
        totalPoints, score: draft.studentOptions.showScoresAfterSubmit ? 0 : null, rank: null, leaderboardEnabled: draft.studentOptions.leaderboard && draft.studentOptions.showScoresAfterSubmit,
        showScoresAfterSubmit: draft.studentOptions.showScoresAfterSubmit, maxSubmissions: draft.studentOptions.examMode ? 1 : draft.studentOptions.maxSubmissions,
        aiAllowed: draft.studentOptions.aiAllowed, leaderboard: [], submitters: 0,
      } satisfies Contest} />
    </> : <>
      <header className="assignment-work-heading"><h1>{title}</h1><p><TranslatedText>{tr(audience)}</TranslatedText></p></header>
      <dl className="assignment-summary">
        <div><dt><TranslatedText>{tr("DUE DATE")}</TranslatedText></dt><dd><TranslatedText>{tr(previewDate(draft.closes, uiLocale))}</TranslatedText></dd></div>
        <div><dt><TranslatedText>{tr("PROBLEMS")}</TranslatedText></dt><dd>{draft.problems.length} <TranslatedText>{tr("SQL problem")}</TranslatedText><TranslatedText>{draft.problems.length === 1 ? "" : tr("s")}</TranslatedText></dd></div>
        <div><dt><TranslatedText>{tr("POINTS")}</TranslatedText></dt><dd>{totalPoints}</dd></div>
        <div><dt><TranslatedText>{tr("STATUS")}</TranslatedText></dt><dd><TranslatedText>{tr("Not started")}</TranslatedText></dd></div>
      </dl>
      <section className="assignment-instructions"><h2><TranslatedText>{tr("Instructions")}</TranslatedText></h2><ProblemMarkdown className="contest-markdown">{draft.instructions || tr("No instructions yet.")}</ProblemMarkdown></section>
      <section className="assignment-problems-card"><div className="section-heading"><h2><TranslatedText>{tr("Problems")}</TranslatedText></h2><small className="muted">{draft.problems.length} <TranslatedText>{tr("problem")}</TranslatedText><TranslatedText>{draft.problems.length === 1 ? "" : tr("s")}</TranslatedText></small></div>
        {draft.problems.map((item, index) => {
          const problem = problems.find((row) => row.id === item.id);
          return <div className="assignment-problem-row" key={item.id}><span className="assignment-problem-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{problem?.title || item.id}</h3><p>{problem?.topic || "SQL"} · <TranslatedText>{tr(problem?.difficulty) || tr("Problem")}</TranslatedText></p></div><span className="assignment-problem-status">{item.points} <TranslatedText>{tr("points")}</TranslatedText></span></div>;
        })}
        {!draft.problems.length && <p className="muted"><TranslatedText>{tr("No problems selected yet.")}</TranslatedText></p>}
      </section>
    </>}
  </div>;
}

export function AssignmentBuilderPage() {
  return <BuilderPage contest={false} />;
}

export function ContestBuilderPage() {
  return <BuilderPage contest />;
}

function BuilderPage({ contest }: { contest: boolean }) {
  const { t: tr } = useLanguage("teacher");
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allProblems, setAllProblems] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsError, setProblemsError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [alertText, setAlertText] = useState("");
  const [showPublishIssues, setShowPublishIssues] = useState(false);
  const [activeContestSection, setActiveContestSection] = useState(contest ? "contest-setup" : "assignment-setup");
  const [contestNavigationIndicator, setContestNavigationIndicator] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const contestNavigationRef = useRef<HTMLElement>(null);
  const activeContestNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const [addProblemOpen, setAddProblemOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewClosing, setPreviewClosing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [expandedTextField, setExpandedTextField] = useState<"description" | "instructions" | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<number | null>(null);
  const contestSplitLayoutRef = useRef<HTMLDivElement>(null);
  const bannerFileInput = useRef<HTMLInputElement>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropInitial, setCropInitial] = useState<BannerCrop>(defaultBannerCrop);

  useEffect(() => {
    if (!draft) return;
    const sections = contest
      ? ["contest-setup", "contest-banner", "contest-description", "contest-schedule", "contest-problems"]
      : ["assignment-setup", "assignment-instructions", "assignment-schedule", "assignment-options", "assignment-problems"];
    const observedSections = sections
      .map((sectionId) => document.getElementById(sectionId))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);
    if (!observedSections.length) return;

    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActiveContestSection(current.target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.1, 0.25, 0.5] });
    observedSections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [contest, Boolean(draft)]);

  useLayoutEffect(() => {
    const navigation = contestNavigationRef.current;
    const activeButton = activeContestNavigationButtonRef.current;
    if (!navigation || !activeButton) return;

    const updateIndicator = () => {
      const navigationBounds = navigation.getBoundingClientRect();
      const buttonBounds = activeButton.getBoundingClientRect();
      setContestNavigationIndicator({
        x: buttonBounds.left - navigationBounds.left,
        y: buttonBounds.top - navigationBounds.top,
        width: buttonBounds.width,
        height: buttonBounds.height,
      });
    };

    updateIndicator();
    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(navigation);
    resizeObserver.observe(activeButton);
    window.addEventListener("resize", updateIndicator);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeContestSection, Boolean(draft)]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !hasUnsavedChangesRef.current) return;
      if (destination.pathname === location.pathname && destination.search === location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleNavigationClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleNavigationClick, true);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const data = await teacherService.getClasses();
        const activeClasses = data.filter((c: any) => c.status === "Active");
        setAvailableClasses(activeClasses);
      } catch (e) {
        setClassesError(e instanceof Error ? e.message : "Could not load classes.");
      } finally {
        setClassesLoading(false);
      }
    }
    fetchClasses();

    async function fetchProblems() {
      try {
        const data = await teacherService.getAllProblems();
        setAllProblems(data);
      } catch (e) {
        setProblemsError(e instanceof Error ? e.message : "Could not load problems.");
      } finally {
        setProblemsLoading(false);
      }
    }
    fetchProblems();

    if (isNew) {
      setDraft(contest ? contestSeed : assignmentSeed);
      return;
    }
    
    async function fetchAssignment() {
      try {
        const data = await teacherService.getAssignment(id!);
        setDraft({
          title: data.title,
          classIds: data.classIds || [],
          audienceType: data.audienceType || "classes",
          shortDescription: data.shortDescription || "",
          description: data.description || "",
          rules: data.rules || (contest ? data.instructions || "" : ""),
          bannerUrl: contest ? data.bannerUrl || null : null,
          bannerSourceUrl: contest ? data.bannerSourceUrl || null : null,
          bannerCrop: contest ? data.bannerCrop || null : null,
          instructions: data.instructions || "",
          opens: toDateTimeLocal(data.opens),
          closes: toDateTimeLocal(data.closes),
          problems: (data.problemList || []).map((item: BuilderProblem) => ({
            ...item,
            workspaceParts: assignmentWorkspaceParts(item.workspaceParts),
          })),
          studentOptions: { ...(contest ? contestSeed.studentOptions : assignmentSeed.studentOptions), ...data.studentOptions },
          published: data.published
        });
      } catch (e) {
        setDraftError(e instanceof Error ? e.message : "Could not load this activity.");
      }
    }
    fetchAssignment();
  }, [id, isNew, contest]);

  const audienceType = draft?.audienceType;
  const selectedIds = draft?.classIds.join("|") || "";
  useEffect(() => {
    if (!audienceType || (audienceType === "classes" && !selectedIds)) {
      setEligibleStudents(0);
      return;
    }
    let active = true;
    setEligibleStudents(null);
    teacherService.getAudienceCount(audienceType, selectedIds ? selectedIds.split("|") : [])
      .then((result) => { if (active) setEligibleStudents(result.eligibleStudents); })
      .catch(() => { if (active) setEligibleStudents(null); });
    return () => { active = false; };
  }, [audienceType, selectedIds]);

  if (!draft) {
    return <div className="teacher-page">{draftError ? <div className="empty-state" role="alert"><TranslatedText>{tr(draftError)}</TranslatedText></div> : <Loading label={tr("Loading builder…")} />}</div>;
  }

  function markUnsaved() {
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
  }

  function markSaved() {
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
  }

  function requestNavigation(destination: string) {
    if (hasUnsavedChangesRef.current) setPendingNavigation(destination);
    else navigate(destination);
  }

  function update<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) {
    setDraft((current) => current ? ({ ...current, [field]: value }) : null);
    markUnsaved();
    setSaveState("Unsaved changes");
    setAlertText("");
    setShowPublishIssues(false);
  }

  function selectAudience(value: BuilderDraft["audienceType"]) {
    setDraft((current) => current ? { ...current, audienceType: value,
      classIds: value === "all_students" ? [] : current.classIds } : null);
    markUnsaved();
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  function closeCrop() {
    if (cropSource?.startsWith("blob:")) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  function chooseBanner(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAlertText("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAlertText("Choose an image smaller than 12 MB.");
      return;
    }
    closeCrop();
    setAlertText("");
    setCropInitial(defaultBannerCrop);
    setCropSource(URL.createObjectURL(file));
  }

  function adjustBanner() {
    if (!draft?.bannerSourceUrl) return;
    try {
      const saved = JSON.parse(draft.bannerCrop || "null") as BannerCrop | null;
      setCropInitial(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom) ? saved : defaultBannerCrop);
    } catch {
      setCropInitial(defaultBannerCrop);
    }
    setCropSource(resolveContestBannerUrl(draft.bannerSourceUrl) || draft.bannerSourceUrl);
  }

  async function applyBanner(banner: Blob, source: Blob, crop: BannerCrop) {
    const urls = await teacherService.uploadContestBanner(banner, source);
    setDraft((current) => current ? { ...current, ...urls, bannerCrop: JSON.stringify(crop) } : null);
    markUnsaved();
    setSaveState("Unsaved changes");
    setAlertText("");
    closeCrop();
  }

  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const scheduleValid =
    !!draft.opens && !!draft.closes && new Date(draft.opens) < new Date(draft.closes);
  const durationMinutes = scheduleValid ? Math.round((new Date(draft.closes).getTime() - new Date(draft.opens).getTime()) / 60000) : 0;
  function getPublishIssues() {
    if (!draft) return ["Wait for the builder to load."];
    const issues: string[] = [];
    if (!draft.title.trim()) issues.push("Enter a title.");
    if (!contest && draft.classIds.length === 0) issues.push("Select at least one class.");
    if (contest && draft.audienceType === "classes" && draft.classIds.length === 0) issues.push("Select at least one class or choose All students.");
    if (contest && !draft.shortDescription.trim()) issues.push("Add a short description.");
    if (contest && !draft.description.trim()) issues.push("Add a contest description.");
    if (draft.problems.length === 0) issues.push("Add at least one problem.");
    if (draft.problems.some((item) => !Number.isFinite(item.points) || item.points <= 0)) issues.push("Set points greater than zero for every problem.");
    if (draft.problems.some((item) => !(item.workspaceParts?.length))) issues.push("Select at least one section for each problem.");
    if (!draft.opens || !Number.isFinite(new Date(draft.opens).getTime())) issues.push(contest ? "Enter a valid start date and time." : "Enter a valid opening date and time.");
    if (!draft.closes || !Number.isFinite(new Date(draft.closes).getTime())) issues.push(contest ? "Enter a valid end date and time." : "Enter a valid due date and time.");
    if (draft.opens && draft.closes && Number.isFinite(new Date(draft.opens).getTime()) && Number.isFinite(new Date(draft.closes).getTime()) && new Date(draft.opens) >= new Date(draft.closes)) {
      issues.push("The end date and time must be after the start date and time.");
    }
    return issues;
  }
  const publishIssues = getPublishIssues();
  const readyToPublish = publishIssues.length === 0;

  async function saveToServer(isPublished: boolean, exitDestination?: string) {
    if (saveBusy) return;
    if (!draft) return;
    if (isPublished) {
      setAlertText("");
      setShowPublishIssues(true);
      if (!readyToPublish) return;
    }
    
    setSaveBusy(true);
    setSaveState("Saving to server...");
    try {
      const payload = {
        title: draft!.title,
        isContest: contest,
        classIds: draft!.classIds,
        audienceType: contest ? draft!.audienceType : "classes",
        shortDescription: contest ? draft!.shortDescription.trim() : "",
        description: contest ? draft!.description : "",
        rules: contest ? draft!.rules : "",
        ...(contest ? { bannerUrl: draft!.bannerUrl, bannerSourceUrl: draft!.bannerSourceUrl, bannerCrop: draft!.bannerCrop } : {}),
        instructions: contest ? "" : draft!.instructions,
        opens: draft!.opens ? new Date(draft!.opens).toISOString() : null,
        closes: draft!.closes ? new Date(draft!.closes).toISOString() : null,
        problems: draft!.problems,
        studentOptions: contest
          ? { leaderboard: draft!.studentOptions.leaderboard, aiAllowed: draft!.studentOptions.aiAllowed, examMode: draft!.studentOptions.examMode, showScoresAfterSubmit: draft!.studentOptions.showScoresAfterSubmit, maxSubmissions: draft!.studentOptions.examMode ? 1 : draft!.studentOptions.maxSubmissions }
          : { hints: draft!.studentOptions.hints, comments: draft!.studentOptions.comments, aiAllowed: draft!.studentOptions.aiAllowed, examMode: draft!.studentOptions.examMode, showScoresAfterSubmit: draft!.studentOptions.showScoresAfterSubmit, maxSubmissions: draft!.studentOptions.examMode ? 1 : draft!.studentOptions.maxSubmissions },
        published: isPublished
      };
      
      let savedActivity: any = null;
      if (isNew) {
        savedActivity = await teacherService.createAssignment(payload);
      } else {
        await teacherService.updateAssignment(id!, payload);
      }
      
      setDraft({ ...draft!, published: isPublished });
      markSaved();
      setSaveState("All changes saved");
      setAlertText(isPublished ? "Successfully published." : "Draft saved successfully.");
      setShowPublishIssues(false);
      
      const listPath = contest ? "/teacher/contests" : "/teacher/assignments";
      if (exitDestination) {
        navigate(exitDestination);
      } else if (isNew && isPublished) {
        navigate(listPath);
      } else if (isNew) {
        const savedId = savedActivity?.id;
        navigate(savedId ? `/teacher/${contest ? "contests" : "assignments"}/${savedId}/edit` : listPath, { replace: true });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save to server.";
      setSaveState(message);
      setAlertText(message);
    } finally {
      setSaveBusy(false);
    }
  }

  function saveDraft() {
    saveToServer(false);
  }

  function publishDraft() {
    saveToServer(true);
  }

  function getMaxPreviewWidth() {
    const availableWidth = contestSplitLayoutRef.current?.clientWidth ?? 1200;
    return window.innerWidth <= 900
      ? Math.max(320, Math.min(680, availableWidth - 332, window.innerWidth * 0.42))
      : Math.max(320, Math.min(680, availableWidth - 584));
  }

  function resizePreviewTo(width: number) {
    setPreviewWidth(Math.max(320, Math.min(getMaxPreviewWidth(), width)));
  }

  function closeContestPreview() {
    if (!previewOpen || previewClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPreviewOpen(false);
      return;
    }
    setPreviewClosing(true);
  }

  function toggleContestPreview() {
    if (previewOpen && !previewClosing) {
      closeContestPreview();
      return;
    }
    setPreviewClosing(false);
    setPreviewOpen(true);
  }

  function addProblem(problemId: string) {
    if (!draft!.problems.some((item) => item.id === problemId)) {
      update("problems", [...draft!.problems, {
        id: problemId,
        points: 10,
        workspaceParts: [...WORKSPACE_PARTS],
      }]);
    }
  }

  const availableProblems = allProblems.filter(
    (problem) => !draft!.problems.some((item) => item.id === problem.id),
  );

  function navigateToContestSection(sectionId: string) {
    setActiveContestSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  return (
    <section className={`teacher-page teacher-builder-page teacher-authoring-editor-page${contest ? " teacher-contest-editor-page" : " teacher-assignment-editor-page"}`}>
      <div
        ref={contestSplitLayoutRef}
        className={`teacher-problem-workspace-layout${previewOpen ? " has-live-preview" : ""}${previewClosing ? " is-closing-preview" : ""}`}
        style={{ "--teacher-preview-width": `${previewWidth}px` } as CSSProperties}
      >
      <div className={`teacher-builder-layout${contest ? " teacher-contest-builder-layout" : " teacher-assignment-builder-layout"}`}>
        <aside className={`teacher-contest-navigation${contest ? "" : " teacher-assignment-navigation"}`}>
          <div className="teacher-contest-navigation-heading">
            <h2><TranslatedText>{tr(isNew ? (contest ? "New contest" : "New assignment") : (contest ? "Edit contest" : "Edit assignment"))}</TranslatedText></h2>
            <p className={`teacher-contest-save-state${hasUnsavedChanges ? " is-unsaved" : ""}${saveBusy ? " is-saving" : ""}`}><span aria-hidden="true" /><TranslatedText>{saveBusy ? tr("Saving…") : hasUnsavedChanges ? tr("Unsaved changes") : tr("All changes saved")}</TranslatedText></p>
            <div className="teacher-contest-save-exit-actions">
              <button className="button" type="button" onClick={() => requestNavigation(contest ? "/teacher/contests" : "/teacher/assignments")}><TranslatedText>{tr("Exit")}</TranslatedText></button>
              <button className="button primary" type="button" onClick={saveDraft} disabled={saveBusy || !draft.title.trim()}>
                <TranslatedText>{saveBusy ? tr("Saving…") : tr("Save")}</TranslatedText>
              </button>
            </div>
          </div>
          <nav ref={contestNavigationRef} className="teacher-contest-page-nav" aria-label={tr(contest ? "Contest sections" : "Assignment sections")}>
            <span
              className="teacher-contest-page-nav-indicator"
              aria-hidden="true"
              style={{
                width: `${contestNavigationIndicator.width}px`,
                height: `${contestNavigationIndicator.height}px`,
                transform: `translate(${contestNavigationIndicator.x}px, ${contestNavigationIndicator.y}px)`,
              }}
            />
            <h3><TranslatedText>{tr("On this page")}</TranslatedText></h3>
            {(contest
              ? [["contest-setup", "Contest setup"], ["contest-banner", "Contest banner"], ["contest-description", "Description"], ["contest-schedule", "Schedule"], ["contest-problems", "Problems & points"]] as const
              : [["assignment-setup", "Assignment setup"], ["assignment-instructions", "Instructions"], ["assignment-schedule", "Schedule"], ["assignment-options", "Student options"], ["assignment-problems", "Problems & points"]] as const
            ).map(([sectionId, label]) => (
              <button key={sectionId} ref={activeContestSection === sectionId ? activeContestNavigationButtonRef : undefined} type="button" className={activeContestSection === sectionId ? "is-active" : ""}
                aria-current={activeContestSection === sectionId ? "location" : undefined}
                onClick={() => navigateToContestSection(sectionId)}><TranslatedText>{tr(label)}</TranslatedText></button>
            ))}
          </nav>
          {alertText && <p className="teacher-form-message" role="status"><TranslatedText>{tr(alertText)}</TranslatedText></p>}
          {showPublishIssues && publishIssues.length > 0 && <div className="teacher-publish-issues" role="alert" aria-live="polite">
            <strong><TranslatedText>{tr("Cannot publish yet. Please fix:")}</TranslatedText></strong>
            <ul>{publishIssues.map((issue) => <li key={issue}><TranslatedText>{tr(issue)}</TranslatedText></li>)}</ul>
          </div>}
          <div className="teacher-contest-navigation-actions">
            <button className="button" type="button" onClick={toggleContestPreview}><TranslatedText>{tr("Preview")}</TranslatedText> <TranslatedText>{tr(contest ? "contest" : "assignment")}</TranslatedText></button>
            <button className="button primary" type="button" onClick={publishDraft} disabled={saveBusy}><TranslatedText>{tr("Publish")}</TranslatedText></button>
          </div>
        </aside>
        <section className="teacher-builder-main">
          <div className="teacher-builder-setup" id={contest ? "contest-setup" : "assignment-setup"}>
            <TeacherSectionTitle title={contest ? tr("Contest setup") : tr("Assignment setup")} />
            <TeacherField label={tr("TITLE")}>
              <input
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </TeacherField>
            {contest && <fieldset className="teacher-field teacher-audience-field">
              <legend><TranslatedText>{tr("AUDIENCE")}</TranslatedText></legend>
              <div className="teacher-audience-options">
                <label><input type="radio" name="contest-audience" checked={draft.audienceType === "classes"} onChange={() => selectAudience("classes")} /> <TranslatedText>{tr("Selected classes")}</TranslatedText></label>
                <label><input type="radio" name="contest-audience" checked={draft.audienceType === "all_students"} onChange={() => selectAudience("all_students")} /> <TranslatedText>{tr("All students")}</TranslatedText></label>
              </div>
            </fieldset>}
            <div className="teacher-builder-class-assignment">
              <div className={`teacher-class-assignment-heading${contest && draft.audienceType !== "classes" ? " is-summary-only" : ""}`}>
                {(!contest || draft.audienceType === "classes") && <span className="teacher-class-assignment-label"><TranslatedText>{tr("CLASSES")}</TranslatedText></span>}
                <div className="teacher-assignment-summary">
                  <span><TranslatedText>{tr(contest ? "OPEN TO" : "ASSIGNED TO")}</TranslatedText></span>
                  <strong>
                    <span><TranslatedText>{contest && draft.audienceType === "all_students" ? tr("All students") : `${draft.classIds.length} ${draft.classIds.length === 1 ? "class" : "classes"}`}</TranslatedText></span>
                    <span className="teacher-assignment-summary-separator" aria-hidden="true">·</span>
                    <span><TranslatedText>{eligibleStudents !== null ? tr("{value0} eligible student{value1}", { value0: eligibleStudents, value1: eligibleStudents === 1 ? "" : "s" }) : tr("Student count unavailable")}</TranslatedText></span>
                  </strong>
                </div>
              </div>
              {(!contest || draft.audienceType === "classes") && <ClassPicker
                selected={draft.classIds}
                onChange={(classes) => update("classIds", classes)}
                classes={availableClasses}
                loading={classesLoading}
                error={classesError}
              />}
            </div>
            {contest && <>
              <TeacherField label={tr("SHORT DESCRIPTION")}>
                <input value={draft.shortDescription} maxLength={180} onChange={(event) => update("shortDescription", event.target.value)} placeholder={tr("One-line contest summary")} />
              </TeacherField>
              <div id="contest-banner" className="teacher-field teacher-banner-field">
                <span><TranslatedText>{tr("CONTEST BANNER")}</TranslatedText></span>
                <input ref={bannerFileInput} className="teacher-banner-file-input" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => { chooseBanner(event.target.files?.[0]); event.target.value = ""; }} />
                <div className={`teacher-banner-preview${draft.bannerUrl ? " has-image" : ""}`}
                  style={draft.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(14, 14, 51, .82), rgba(14, 14, 51, .48)), url("${resolveContestBannerUrl(draft.bannerUrl)}")` } : undefined}>
                  <span><TranslatedText>{draft.bannerUrl ? tr("Current contest banner") : tr("Default contest banner")}</TranslatedText></span>
                </div>
                <div className="teacher-banner-actions">
                  {draft.bannerUrl && <button className="button" type="button" onClick={adjustBanner}><TranslatedText>{tr("Adjust crop")}</TranslatedText></button>}
                  <button className="button" type="button" onClick={() => bannerFileInput.current?.click()}><TranslatedText>{draft.bannerUrl ? tr("Replace image") : tr("Upload banner")}</TranslatedText></button>
                  {draft.bannerUrl && <button className="button" type="button" onClick={() => {
                    setDraft((current) => current ? { ...current, bannerUrl: null, bannerSourceUrl: null, bannerCrop: null } : null);
                    markUnsaved();
                    setSaveState("Unsaved changes");
                  }}><TranslatedText>{tr("Remove image")}</TranslatedText></button>}
                </div>
                <small className="muted"><TranslatedText>{tr("JPEG, PNG, or WebP · up to 12 MB. Crop to a 3:1 banner before applying.")}</TranslatedText></small>
              </div>
              <div id="contest-description" className="teacher-field teacher-long-text-field teacher-contest-long-text-field">
                <div className="teacher-long-text-heading">
                  <span><TranslatedText>{tr("DESCRIPTION")}</TranslatedText></span>
                </div>
                <ProblemRichTextEditor
                  value={draft.description}
                  label={tr("DESCRIPTION")}
                  onChange={(value) => update("description", value)}
                  onOpenExpanded={() => setExpandedTextField("description")}
                />
                <small className="muted"><TranslatedText>{tr("Markdown text is saved as the contest description.")}</TranslatedText></small>
              </div>
            </>}
            {!contest && <div id="assignment-instructions" className="teacher-field teacher-long-text-field teacher-contest-long-text-field">
              <div className="teacher-long-text-heading">
                <span><TranslatedText>{tr("INSTRUCTIONS")}</TranslatedText></span>
              </div>
              <ProblemRichTextEditor
                value={draft.instructions}
                label={tr("INSTRUCTIONS")}
                onChange={(value) => update("instructions", value)}
                onOpenExpanded={() => setExpandedTextField("instructions")}
              />
            </div>}
          </div>

          <div className="teacher-schedule-section teacher-builder-schedule" id={contest ? "contest-schedule" : "assignment-schedule"}>
            <TeacherSectionTitle title={tr("Schedule")} />
            <div className="teacher-contest-schedule-fields">
              <TeacherField label={tr(contest ? "STARTS" : "OPENS")}>
                <DateTimeInput label={tr(contest ? "Starts" : "Opens")} value={draft.opens} onChange={(value) => update("opens", value)} />
              </TeacherField>
              <TeacherField label={tr(contest ? "ENDS" : "DUE DATE")}>
                <DateTimeInput label={tr(contest ? "Ends" : "Due date")} value={draft.closes} onChange={(value) => update("closes", value)} />
              </TeacherField>
            </div>
            {contest && durationMinutes > 0 && <p className="teacher-timezone"><TranslatedText>{tr("Duration ·")}</TranslatedText> {durationMinutes} <TranslatedText>{tr("min")}</TranslatedText></p>}
          </div>

          {!contest && <div className="teacher-student-options teacher-assignment-options" id="assignment-options">
            <TeacherSectionTitle title={tr("Student options")} />
            {([
              ["hints", "Hints", "Students can open hints while solving"],
              ["comments", "Comments", "Students can comment on each problem"],
              ["aiAllowed", "AI assistance", draft.studentOptions.aiAllowed ? "Students can use AI assistance while solving" : "AI assistance is not allowed"],
            ] as const).map(([key, label, help]) => (
              <div className="teacher-option-row" key={key}>
                <span><b><TranslatedText>{tr(label)}</TranslatedText></b><small><TranslatedText>{tr(help)}</TranslatedText></small></span>
                <button type="button" role="switch" aria-label={key === "aiAllowed" ? tr("Allow AI assistance") : tr(label)}
                  aria-checked={draft.studentOptions[key]} className={`teacher-toggle${draft.studentOptions[key] ? " is-on" : ""}`}
                  onClick={() => update("studentOptions", { ...draft.studentOptions, [key]: !draft.studentOptions[key] })}>
                  <span />
                </button>
              </div>
            ))}
          </div>}

          <div className="teacher-exam-mode-setting">
            <div className="teacher-option-row">
              <span><b><TranslatedText>{tr("Show scores after submission")}</TranslatedText></b><small><TranslatedText>{tr("Students can see their scores once their work has been graded.")}</TranslatedText></small></span>
              <button type="button" role="switch" aria-label={tr("Show scores after submission")} aria-checked={draft.studentOptions.showScoresAfterSubmit} className={`teacher-toggle${draft.studentOptions.showScoresAfterSubmit ? " is-on" : ""}`} onClick={() => update("studentOptions", { ...draft.studentOptions, showScoresAfterSubmit: !draft.studentOptions.showScoresAfterSubmit })}><span /></button>
            </div>
            <div className="teacher-option-row teacher-submission-limit">
              <span><b><TranslatedText>{tr("Submission limit")}</TranslatedText></b><small><TranslatedText>{tr(draft.studentOptions.examMode ? "Exam mode allows one final submission for the entire activity." : "Per problem. Leave blank for unlimited submissions.")}</TranslatedText></small></span>
              <input type="number" min="1" max="100" step="1" aria-label={tr("Submission limit")} placeholder={tr("Unlimited")} disabled={draft.studentOptions.examMode} value={draft.studentOptions.examMode ? 1 : draft.studentOptions.maxSubmissions ?? ""} onChange={event => update("studentOptions", { ...draft.studentOptions, maxSubmissions: event.target.value ? Number(event.target.value) : null })} />
            </div>
            <div className="teacher-option-row">
              <span><b><TranslatedText>{tr("Exam mode")}</TranslatedText></b><small><TranslatedText>{tr("Keep students in this activity. A second focus, navigation or external paste violation automatically submits all work.")}</TranslatedText></small></span>
              <button type="button" role="switch" aria-label={tr("Exam mode")} aria-checked={Boolean(draft.studentOptions.examMode)} className={`teacher-toggle${draft.studentOptions.examMode ? " is-on" : ""}`} onClick={() => update("studentOptions", { ...draft.studentOptions, examMode: !draft.studentOptions.examMode })}><span /></button>
            </div>
          </div>

          <div className="teacher-builder-problems" id={contest ? "contest-problems" : "assignment-problems"}>
            <TeacherSectionTitle title={tr("Problems & points")} />
            {problemsError && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(problemsError)}</TranslatedText></p>}
            <div className="teacher-table-scroll">
              <table className="teacher-table teacher-problem-points-table">
                <thead>
                  <tr>
                    <th><TranslatedText>{tr("Order / problem")}</TranslatedText></th>
                    <th><TranslatedText>{tr("Difficulty")}</TranslatedText></th>
                    <th><TranslatedText>{tr("Points / order")}</TranslatedText></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.problems.map((item, index) => {
                    const problem = allProblems.find((row) => row.id === item.id);
                    if (!problem) return null;
                    return (
                      <tr key={item.id}>
                        <td data-label={tr("Order / problem")}>
                          <div className="builder-problem-cell">
                            <span className="teacher-problem-order">{String(index + 1).padStart(2, "0")}</span>
                            <div className="builder-problem-details">
                              <span className="builder-problem-title">{problem.title}</span>
                              <div className="teacher-problem-workspace-parts" role="group" aria-label={tr("Workspace sections for {value0}", { value0: problem.title })}>
                                {WORKSPACE_PARTS.map((part) => {
                                  const selected = item.workspaceParts || [];
                                  return <label key={part} className={"teacher-problem-workspace-part" + (selected.includes(part) ? " is-selected" : "")} title={tr(WORKSPACE_PART_LABELS[part])}>
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(part)}
                                      onChange={(event) => update("problems", draft.problems.map((row) => row.id === item.id
                                        ? { ...row, workspaceParts: WORKSPACE_PARTS.filter((value) => value === part ? event.target.checked : selected.includes(value)) }
                                        : row))}
                                    />
                                    <span><TranslatedText>{tr(WORKSPACE_PART_LABELS[part])}</TranslatedText></span>
                                  </label>;
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label={tr("Difficulty")}><TranslatedText>{tr(problem.difficulty)}</TranslatedText></td>
                        <td data-label={tr("Points / order")} className="builder-points-actions"><input type="number" min="1" aria-label={tr("Points for {value0}", { value0: problem.title })} value={item.points} onChange={event => update("problems", draft.problems.map(row => row.id === item.id ? { ...row, points: Number(event.target.value) } : row))} /><button type="button" aria-label={tr("Move {value0} up", { value0: problem.title })} disabled={index === 0} onClick={() => { const next = [...draft.problems]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update("problems", next); }}>↑</button><button type="button" aria-label={tr("Move {value0} down", { value0: problem.title })} disabled={index === draft.problems.length - 1} onClick={() => { const next = [...draft.problems]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; update("problems", next); }}>↓</button><button type="button" aria-label={tr("Remove {value0}", { value0: problem.title })} onClick={() => update("problems", draft.problems.filter(row => row.id !== item.id))}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="button teacher-small-button"
              type="button"
              disabled={problemsLoading || !!problemsError}
              onClick={() => setAddProblemOpen(true)}
            >
              <TranslatedText>{problemsLoading ? tr("Loading library…") : tr("Add from library")}</TranslatedText>
            </button>
          </div>

        </section>

      </div>
      {previewOpen && <aside
        className={`teacher-student-preview-panel${contest ? " teacher-contest-preview-panel" : " teacher-assignment-preview-panel"}${previewClosing ? " is-closing" : ""}`}
        aria-label={tr("Student preview")}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget || event.animationName !== "teacher-preview-panel-out") return;
          setPreviewOpen(false);
          setPreviewClosing(false);
        }}
      >
        <button
          className="teacher-student-preview-resize"
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={getMaxPreviewWidth()}
          aria-valuenow={previewWidth}
          aria-label={tr("Resize preview panel")}
          title={tr("Resize preview panel")}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const bounds = contestSplitLayoutRef.current?.getBoundingClientRect();
            if (bounds) resizePreviewTo(bounds.right - event.clientX);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            resizePreviewTo(previewWidth + (event.key === "ArrowLeft" ? 24 : -24));
          }}
          onDoubleClick={() => resizePreviewTo(420)}
        ><span aria-hidden="true" /></button>
        <header className="teacher-student-preview-heading">
          <h2><TranslatedText>{tr("Student preview")}</TranslatedText></h2>
          <button type="button" className="icon-button" aria-label={tr("Close preview")} title={tr("Close preview")} onClick={closeContestPreview}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="teacher-student-preview">
          <div className={`teacher-student-preview-scroll${contest ? " teacher-contest-preview-scroll" : ""}`}>
            <ActivityPreview draft={draft} contest={contest} classes={availableClasses} problems={allProblems} />
          </div>
        </div>
      </aside>}
      </div>

      {addProblemOpen && (
        <Dialog title={tr("Add problem")} onClose={() => setAddProblemOpen(false)}>
          <div className="teacher-add-problem-list">
            {availableProblems.length ? availableProblems.map((problem) => (
              <div key={problem.id}>
                <span>
                  <b>{problem.number} · {problem.title}</b>
                  <small><TranslatedText>{tr(problem.difficulty)}</TranslatedText> · {problem.topics}</small>
                </span>
                <button className="button" type="button" onClick={() => addProblem(problem.id)}>
                  <TranslatedText>{tr("Add")}</TranslatedText>
                </button>
              </div>
            )) : <p className="tiny muted"><TranslatedText>{tr("All available problems are already included.")}</TranslatedText></p>}
          </div>
        </Dialog>
      )}
      {expandedTextField && <Dialog
        title={tr(expandedTextField === "description" ? "DESCRIPTION" : "INSTRUCTIONS")}
        className="teacher-long-text-dialog"
        onClose={() => setExpandedTextField(null)}
      >
        <div className="teacher-long-text-dialog-body teacher-builder-long-text-dialog-body">
          <strong className="teacher-long-text-toolbar-title"><TranslatedText>{tr(expandedTextField === "description" ? "DESCRIPTION" : "INSTRUCTIONS")}</TranslatedText></strong>
          <div className="teacher-builder-long-text-expanded">
            <ProblemRichTextEditor
              value={draft[expandedTextField]}
              label={tr(expandedTextField === "description" ? "DESCRIPTION" : "INSTRUCTIONS")}
              onChange={(value) => update(expandedTextField, value)}
              onOpenExpanded={() => undefined}
            />
          </div>
          <div className="teacher-dialog-actions">
            <button className="button primary teacher-long-text-done" type="button" onClick={() => setExpandedTextField(null)}><TranslatedText>{tr("Done")}</TranslatedText></button>
          </div>
        </div>
      </Dialog>}
      {pendingNavigation && <Dialog title={tr("Unsaved changes")} onClose={() => setPendingNavigation(null)}>
        <div className="teacher-preview-dialog">
          <p><TranslatedText>{tr("You have unsaved changes. Would you like to save before leaving?")}</TranslatedText></p>
          {!saveBusy && saveState && saveState !== "Unsaved changes" && saveState !== "All changes saved" && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(saveState)}</TranslatedText></p>}
          <div className="teacher-dialog-actions">
            <button className="button" type="button" disabled={saveBusy} onClick={() => setPendingNavigation(null)}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
            <button className="button primary" type="button" disabled={saveBusy || !draft.title.trim()} onClick={() => void saveToServer(false, pendingNavigation)}><TranslatedText>{tr("Save and exit")}</TranslatedText></button>
            <button className="button teacher-danger-button" type="button" disabled={saveBusy} onClick={() => { const destination = pendingNavigation; setPendingNavigation(null); navigate(destination); }}><TranslatedText>{tr("Leave without saving")}</TranslatedText></button>
          </div>
        </div>
      </Dialog>}
      {contest && cropSource && <ContestBannerCrop sourceUrl={cropSource} initialCrop={cropInitial} onClose={closeCrop} onApply={applyBanner} />}
    </section>
  );
}
