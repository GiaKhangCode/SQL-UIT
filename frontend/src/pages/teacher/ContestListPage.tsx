import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";
import { parseServerDateTime } from "../../utils/serverDateTime";

type Contest = {
  id: string; title: string; classes: string; problems: number; opens?: string;
  closes?: string; submitted: string; status: string; isContest: boolean;
};
const date = (value?: string) => {
  if (!value) return "—";
  const parsed = parseServerDateTime(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "—";
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
  const contests = useMemo(() => ((data || []) as Contest[]).filter(item => item.isContest), [data]);
  const filtered = contests.filter(item => `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) && (status === "All statuses" || item.status === status));
  const selected = filtered.find(item => item.id === selectedId) || filtered[0];
  return <section className="teacher-page teacher-list-page">
    <TeacherPageIntro title="Contests" context={error ? "Contests unavailable" : `${contests.length} contest${contests.length === 1 ? "" : "s"} · ${contests.filter(item => item.status === "Open").length} live`}>
      <Link className="button primary" to="/teacher/contests/new">New contest</Link>
    </TeacherPageIntro>
    {loading ? <Loading label="Loading contests…" /> : error ? <ErrorState title="Could not load contests" message={error} onRetry={() => window.location.reload()} /> : <>
      <div className="teacher-list-filters teacher-activity-filters">
        <TeacherField label="SEARCH"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search contests or classes…" /></TeacherField>
        <TeacherField label="STATUS"><select value={status} onChange={event => setStatus(event.target.value)}><option>All statuses</option><option>Open</option><option>Scheduled</option><option>Closed</option><option>Draft</option></select></TeacherField>
      </div>
      {!contests.length ? <Empty title="No contests yet">Create a timed contest for your classes.</Empty> : <div className="teacher-list-detail-layout">
        <div className="teacher-list-detail-main"><div className="teacher-table-scroll"><table className="teacher-table"><thead><tr><th>CONTEST</th><th>CLASS</th><th>STARTS</th><th>ENDS</th><th>DURATION</th><th>STATUS</th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.id} className={selected?.id === item.id ? "is-selected" : ""}>
            <td data-label="CONTEST"><button type="button" className="teacher-selectable-row-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></td>
            <td data-label="CLASS">{item.classes}</td><td data-label="STARTS">{date(item.opens)}</td><td data-label="ENDS">{date(item.closes)}</td><td data-label="DURATION">{duration(item.opens, item.closes)}</td><td data-label="STATUS"><Status value={item.status} /></td>
          </tr>)}
        </tbody></table></div><p className="teacher-list-footer">Showing {filtered.length} of {contests.length} contests</p></div>
        <aside className="teacher-list-detail-panel">{selected ? <><span className="teacher-detail-eyebrow">CONTEST DETAILS</span><h2>{selected.title}</h2><p className="muted">{selected.classes}</p>
          <dl className="teacher-list-detail-facts"><div><dt>Starts</dt><dd>{date(selected.opens)}</dd></div><div><dt>Ends</dt><dd>{date(selected.closes)}</dd></div><div><dt>Duration</dt><dd>{duration(selected.opens, selected.closes)}</dd></div><div><dt>Problems</dt><dd>{selected.problems}</dd></div><div><dt>Problem submitters / enrolled</dt><dd>{selected.submitted}</dd></div></dl>
          <div className="teacher-list-detail-actions"><Link className="button primary" to={`/teacher/contests/${selected.id}/edit`}>Edit</Link><Link className="button" to={`/teacher/results?search=${encodeURIComponent(selected.title)}`}>Results</Link></div>
        </> : <p className="muted">Select a contest to view details.</p>}</aside>
      </div>}
    </>}
  </section>;
}
