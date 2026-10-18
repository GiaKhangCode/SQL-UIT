import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { TeacherField } from "./TeacherPageParts";
import { parseServerDateTime } from "../../utils/serverDateTime";

type Contest = {
  id: string; title: string; classes: string; problems: number; opens?: string;
  closes?: string; submitted: string; status: string; isContest: boolean;
  shortDescription: string; eligibleStudents: number;
};
const contestStatus = (status: string) => status === "Scheduled" ? "Upcoming" : status === "Open" ? "Live" : status;
const dateParts = (value?: string, locale = "en-US") => {
  if (!value) return "—";
  const parsed = parseServerDateTime(value);
  return Number.isFinite(parsed.getTime()) ? {
    date: parsed.toLocaleDateString(locale),
    time: parsed.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
  } : "—";
};
const date = (value?: string, locale = "en-US") => {
  const parts = dateParts(value, locale);
  return typeof parts === "string" ? parts : `${parts.date} · ${parts.time}`;
};
const tableDateTime = (value?: string, locale = "en-US") => {
  const parts = dateParts(value, locale);
  return typeof parts === "string" ? parts : <span className="teacher-contest-datetime"><span>{parts.date}</span><small>{parts.time}</small></span>;
};
const duration = (start?: string, end?: string) => {
  if (!start || !end) return "—";
  const minutes = Math.round((parseServerDateTime(end).getTime() - parseServerDateTime(start).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : "—";
};

export function ContestsListPage() {
  const { t: tr, locale: uiLocale } = useLanguage("teacher");
  const { data, loading, error } = useLoad(teacherService.getAssignments);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const contests = useMemo(() => ((data || []) as Contest[]).filter(item => item.isContest), [data]);
  const filtered = contests.filter(item => `${item.title} ${item.classes} ${item.shortDescription || ""}`.toLowerCase().includes(search.toLowerCase()) && (status === "All statuses" || contestStatus(item.status) === status));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * 15;
  const pageContests = filtered.slice(firstIndex, firstIndex + 15);
  const selected = pageContests.find(item => item.id === selectedId) || pageContests[0];
  useEffect(() => {
    setPage(1);
    setSelectedId("");
  }, [search, status]);
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [currentPage, search, status]);
  return <section className="teacher-page teacher-list-page teacher-contest-page compact-teacher-contests">
    <h1 className="sr-only"><TranslatedText>{tr("Contests")}</TranslatedText></h1>
    <div className="teacher-list-filters teacher-activity-filters teacher-contest-filters">
      <TeacherField label={tr("SEARCH")}><input value={search} onChange={event => setSearch(event.target.value)} placeholder={tr("Search contests, audience, or summary…")} /></TeacherField>
      <div className="teacher-contest-options">
        <TeacherField label={tr("STATUS")}><select value={status} onChange={event => setStatus(event.target.value)}><option value="All statuses">{tr("All statuses")}</option><option value="Live">{tr("Live")}</option><option value="Upcoming">{tr("Upcoming")}</option><option value="Closed">{tr("Closed")}</option><option value="Draft">{tr("Draft")}</option></select></TeacherField>
        <Link className="button primary teacher-contest-new" to="/teacher/contests/new"><TranslatedText>{tr("New contest")}</TranslatedText></Link>
      </div>
    </div>
    {loading ? <Loading label={tr("Loading contests…")} /> : error ? <ErrorState title={tr("Could not load contests")} message={tr(error)} onRetry={() => window.location.reload()} /> : !contests.length ? <Empty title={tr("No contests yet")}><TranslatedText>{tr("Create a timed contest for selected classes or all students.")}</TranslatedText></Empty> : <div className="teacher-list-detail-layout">
        <div className="teacher-list-detail-main"><div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap"><table className="teacher-table teacher-contest-list-table sticky-list-table"><thead><tr><th><TranslatedText>{tr("CONTEST")}</TranslatedText></th><th><TranslatedText>{tr("AUDIENCE")}</TranslatedText></th><th><TranslatedText>{tr("STARTS")}</TranslatedText></th><th><TranslatedText>{tr("ENDS")}</TranslatedText></th><th><TranslatedText>{tr("DURATION")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead><tbody>
          {pageContests.map(item => <tr key={item.id} className={selected?.id === item.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}>
            <td data-label={tr("CONTEST")}><button type="button" className="teacher-selectable-row-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></td>
            <td data-label={tr("AUDIENCE")}>{item.classes}</td>
            <td data-label={tr("STARTS")}>{tableDateTime(item.opens, uiLocale)}</td>
            <td data-label={tr("ENDS")}>{tableDateTime(item.closes, uiLocale)}</td>
            <td data-label={tr("DURATION")}><TranslatedText>{tr(duration(item.opens, item.closes))}</TranslatedText></td><td data-label={tr("STATUS")}><Status value={contestStatus(item.status)} /></td>
          </tr>)}
          {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}><TranslatedText>{tr("No contests match these filters.")}</TranslatedText></td></tr>}
        </tbody></table></div>
          <div className="teacher-list-footer teacher-library-pagination">
            <span><TranslatedText>{tr("Showing")}</TranslatedText> {filtered.length ? firstIndex + 1 : 0}–{firstIndex + pageContests.length} <TranslatedText>{tr("of")}</TranslatedText> {filtered.length} <TranslatedText>{tr("contests")}</TranslatedText></span>
            <nav aria-label={tr("Contests pagination")}>
              <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedId(""); }}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
              <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
              <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedId(""); }}><TranslatedText>{tr("Next →")}</TranslatedText></button>
            </nav>
          </div>
        </div>
        <aside className="teacher-list-detail-panel">{selected ? <><span className="teacher-detail-eyebrow"><TranslatedText>{tr("CONTEST DETAILS")}</TranslatedText></span><h2>{selected.title}</h2><p className="muted">{selected.shortDescription}</p><p className="muted">{selected.classes}</p>
          <dl className="teacher-list-detail-facts"><div><dt><TranslatedText>{tr("Starts")}</TranslatedText></dt><dd>{date(selected.opens, uiLocale)}</dd></div><div><dt><TranslatedText>{tr("Ends")}</TranslatedText></dt><dd>{date(selected.closes, uiLocale)}</dd></div><div><dt><TranslatedText>{tr("Duration")}</TranslatedText></dt><dd><TranslatedText>{tr(duration(selected.opens, selected.closes))}</TranslatedText></dd></div><div><dt><TranslatedText>{tr("Problems")}</TranslatedText></dt><dd>{selected.problems}</dd></div><div><dt><TranslatedText>{tr("Eligible students")}</TranslatedText></dt><dd>{selected.eligibleStudents}</dd></div><div><dt><TranslatedText>{tr("Problem submitters / eligible")}</TranslatedText></dt><dd>{selected.submitted}</dd></div></dl>
          <div className="teacher-list-detail-actions"><Link className="button primary" to={`/teacher/contests/${selected.id}/edit`}><TranslatedText>{tr("Edit")}</TranslatedText></Link><Link className="button" to={`/teacher/results?search=${encodeURIComponent(selected.title)}`}><TranslatedText>{tr("Results")}</TranslatedText></Link></div>
        </> : <p className="muted"><TranslatedText>{tr("Select a contest to view details.")}</TranslatedText></p>}</aside>
      </div>}
  </section>;
}
