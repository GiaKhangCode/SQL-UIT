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
const dateParts = (value?: string) => {
  if (!value) return "—";
  const parsed = parseServerDateTime(value);
  return Number.isFinite(parsed.getTime()) ? {
    date: parsed.toLocaleDateString("en-US"),
    time: parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  } : "—";
};
const date = (value?: string) => {
  const parts = dateParts(value);
  return typeof parts === "string" ? parts : `${parts.date} · ${parts.time}`;
};
const tableDateTime = (value?: string) => {
  const parts = dateParts(value);
  return typeof parts === "string" ? parts : <span className="teacher-contest-datetime"><span>{parts.date}</span><small>{parts.time}</small></span>;
};
const duration = (start?: string, end?: string) => {
  if (!start || !end) return "—";
  const minutes = Math.round((parseServerDateTime(end).getTime() - parseServerDateTime(start).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : "—";
};

export function ContestsListPage() {
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
    <h1 className="sr-only">Contests</h1>
    <div className="teacher-list-filters teacher-activity-filters teacher-contest-filters">
      <TeacherField label="SEARCH"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search contests, audience, or summary…" /></TeacherField>
      <div className="teacher-contest-options">
        <TeacherField label="STATUS"><select value={status} onChange={event => setStatus(event.target.value)}><option>All statuses</option><option>Live</option><option>Upcoming</option><option>Closed</option><option>Draft</option></select></TeacherField>
        <Link className="button primary teacher-contest-new" to="/teacher/contests/new">New contest</Link>
      </div>
    </div>
    {loading ? <Loading label="Loading contests…" /> : error ? <ErrorState title="Could not load contests" message={error} onRetry={() => window.location.reload()} /> : !contests.length ? <Empty title="No contests yet">Create a timed contest for selected classes or all students.</Empty> : <div className="teacher-list-detail-layout">
        <div className="teacher-list-detail-main"><div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap"><table className="teacher-table teacher-contest-list-table sticky-list-table"><thead><tr><th>CONTEST</th><th>AUDIENCE</th><th>STARTS</th><th>ENDS</th><th>DURATION</th><th>STATUS</th></tr></thead><tbody>
          {pageContests.map(item => <tr key={item.id} className={selected?.id === item.id ? "is-selected" : ""}>
            <td data-label="CONTEST"><button type="button" className="teacher-selectable-row-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></td>
            <td data-label="AUDIENCE">{item.classes}</td>
            <td data-label="STARTS">{tableDateTime(item.opens)}</td>
            <td data-label="ENDS">{tableDateTime(item.closes)}</td>
            <td data-label="DURATION">{duration(item.opens, item.closes)}</td><td data-label="STATUS"><Status value={contestStatus(item.status)} /></td>
          </tr>)}
          {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}>No contests match these filters.</td></tr>}
        </tbody></table></div>
          <div className="teacher-list-footer teacher-library-pagination">
            <span>Showing {filtered.length ? firstIndex + 1 : 0}–{firstIndex + pageContests.length} of {filtered.length} contests</span>
            <nav aria-label="Contests pagination">
              <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedId(""); }}>← Previous</button>
              <span>Page {currentPage} of {pageCount}</span>
              <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedId(""); }}>Next →</button>
            </nav>
          </div>
        </div>
        <aside className="teacher-list-detail-panel">{selected ? <><span className="teacher-detail-eyebrow">CONTEST DETAILS</span><h2>{selected.title}</h2><p className="muted">{selected.shortDescription}</p><p className="muted">{selected.classes}</p>
          <dl className="teacher-list-detail-facts"><div><dt>Starts</dt><dd>{date(selected.opens)}</dd></div><div><dt>Ends</dt><dd>{date(selected.closes)}</dd></div><div><dt>Duration</dt><dd>{duration(selected.opens, selected.closes)}</dd></div><div><dt>Problems</dt><dd>{selected.problems}</dd></div><div><dt>Eligible students</dt><dd>{selected.eligibleStudents}</dd></div><div><dt>Problem submitters / eligible</dt><dd>{selected.submitted}</dd></div></dl>
          <div className="teacher-list-detail-actions"><Link className="button primary" to={`/teacher/contests/${selected.id}/edit`}>Edit</Link><Link className="button" to={`/teacher/results?search=${encodeURIComponent(selected.title)}`}>Results</Link></div>
        </> : <p className="muted">Select a contest to view details.</p>}</aside>
      </div>}
  </section>;
}
