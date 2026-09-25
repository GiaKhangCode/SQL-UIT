import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Dialog } from "../../components/ui";
import { readTeacherDraft, saveTeacherDraft } from "../../data/teacherDemoData";
import { teacherService } from "../../services/teacherService";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";

type ProblemRow = {
  id: string;
  number: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  topics: string;
  visibility: "Public" | "Private" | string;
  usedIn: number;
  updated: string;
};

export const teacherProblemLibraryKey = "querylab:teacher:problem-library:v1";
export const teacherProblemLibrarySeed: ProblemRow[] = [
  { id: "p1", number: "014", title: "Customers without orders", difficulty: "Medium", topics: "JOIN · NULL", visibility: "Private", usedIn: 2, updated: "Sep 22" },
  { id: "p11", number: "015", title: "Revenue by category", difficulty: "Medium", topics: "GROUP BY · JOIN", visibility: "Public", usedIn: 3, updated: "Sep 20" },
  { id: "p12", number: "016", title: "Top customers", difficulty: "Hard", topics: "Subquery · CTE", visibility: "Private", usedIn: 1, updated: "Sep 18" },
  { id: "p9", number: "009", title: "Employees by department", difficulty: "Easy", topics: "SELECT · WHERE", visibility: "Public", usedIn: 5, updated: "Sep 10" },
  { id: "p21", number: "021", title: "Duplicate emails", difficulty: "Easy", topics: "GROUP BY · HAVING", visibility: "Private", usedIn: 0, updated: "Sep 08" },
  { id: "p22", number: "022", title: "Running total", difficulty: "Hard", topics: "Window functions", visibility: "Private", usedIn: 0, updated: "Sep 05" },
];

export function ProblemLibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [problems, setProblemState] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await teacherService.getAllProblems();
        const mapped = data.map((p: any) => ({
          id: p.id,
          number: p.number || "000",
          title: p.title,
          difficulty: p.difficulty || "Easy",
          topics: (p.topics && p.topics.length > 0) ? p.topics.join(" · ") : (p.topic || ""),
          visibility: p.practiceListed ? "Public" : "Private",
          usedIn: 0,
          updated: "Just now"
        }));
        setProblemState(mapped);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All levels");
  const [topic, setTopic] = useState("All topics");
  const [visibility, setVisibility] = useState(() => searchParams.get("visibility") || "All");
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [blockedDelete, setBlockedDelete] = useState<ProblemRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProblemRow | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => problems.filter((problem) =>
    `${problem.title} ${problem.topics}`.toLowerCase().includes(search.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (topic === "All topics" || problem.topics.toLowerCase().includes(topic.toLowerCase())) &&
    (visibility === "All" || problem.visibility === visibility),
  ), [problems, search, difficulty, topic, visibility]);
  const selectedProblem = filtered.find((problem) => problem.id === selectedProblemId) || filtered[0] || null;

  function removeProblem(problem: ProblemRow) {
    if (problem.usedIn > 0) {
      setBlockedDelete(problem);
      return;
    }
    setConfirmDelete(problem);
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const problem = confirmDelete;
    try {
      await teacherService.deleteProblem(problem.id);
      setProblemState(problems.filter((item) => item.id !== problem.id));
      setNotice(`${problem.title} was removed from the library.`);
      if (selectedProblemId === problem.id) {
        setSelectedProblemId("");
      }
    } catch (e) {
      setNotice(`Failed to delete ${problem.title}.`);
    } finally {
      setConfirmDelete(null);
    }
  }

  const publicCount = problems.filter(p => p.visibility === "Public").length;
  const privateCount = problems.length - publicCount;
  const notUsedCount = problems.filter(p => p.usedIn === 0).length;

  return (
    <section className="teacher-page teacher-library-page">
      <TeacherPageIntro title="Problem library" context={problems.length ? `${problems.length} problems · ${publicCount} public in Practice · ${privateCount} private` : "0 problems"}>
        <button className="button primary" type="button" onClick={() => navigate("/teacher/problems/new")}>New problem</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      {loading ? (
        <div style={{ padding: '24px' }}>Loading problems...</div>
      ) : problems.length === 0 ? (
        <TeacherEmptyState
          title="No problems yet"
          description="Create your first SQL problem with a schema, seed data and a reference solution. You can reuse it in any assignment or contest."
          primaryLabel="New problem"
          primaryTo="/teacher/problems/new"
          secondaryLabel="Browse public problems"
          secondaryTo="/teacher/problems?visibility=Public"
        />
      ) : <>
        <div className="teacher-list-filters teacher-problem-filters">
          <TeacherField label="SEARCH"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or topic…" /></TeacherField>
          <TeacherField label="DIFFICULTY"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All levels</option><option>Easy</option><option>Medium</option><option>Hard</option></select></TeacherField>
          <TeacherField label="TOPIC"><select value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{["JOIN", "NULL", "GROUP BY", "SELECT", "WHERE", "Subquery", "CTE", "HAVING", "Window functions"].map((item) => <option key={item}>{item}</option>)}</select></TeacherField>
          <TeacherField label="VISIBILITY"><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>All</option><option>Public</option><option>Private</option></select></TeacherField>
        </div>
        <div className="teacher-list-summary">
          <div><strong>{problems.length}</strong><small>Problems in library</small></div>
          <div><strong>{publicCount}</strong><small>Public in Practice</small></div>
          <div><strong>{notUsedCount}</strong><small>Not used in any assignment</small></div>
        </div>
        <div className="teacher-divider teacher-list-divider" />
        {notice && <p className="teacher-form-message" role="status">{notice}</p>}
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div className="teacher-table-scroll teacher-list-table-scroll">
              <table className="teacher-table teacher-library-table">
                <thead><tr><th>PROBLEM</th><th>DIFFICULTY</th><th>TOPICS</th><th>VISIBILITY</th><th>USED IN</th><th>UPDATED</th></tr></thead>
                <tbody>{filtered.map((problem) => <tr
                  className={`teacher-selectable-list-row${selectedProblem?.id === problem.id ? " is-selected" : ""}`}
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                >
                  <td data-label="PROBLEM"><button className="teacher-selectable-row-title teacher-library-title" type="button" aria-label={`Show details for ${problem.title}`} onClick={(event) => { event.stopPropagation(); setSelectedProblemId(problem.id); }}><span>{problem.number}</span><span>{problem.title}</span></button></td>
                  <td data-label="DIFFICULTY">{problem.difficulty}</td>
                  <td data-label="TOPICS">{problem.topics}</td>
                  <td data-label="VISIBILITY">{problem.visibility}</td>
                  <td data-label="USED IN">{problem.usedIn ? `${problem.usedIn} in use` : "Not used"}</td>
                  <td data-label="UPDATED">{problem.updated}</td>
                </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}>No problems match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="teacher-list-footer">Showing {filtered.length} of {problems.length} problems</p>
          </div>
          <aside className="teacher-list-detail-panel">
            {selectedProblem ? <>
              <span className="teacher-detail-eyebrow">PROBLEM DETAILS</span>
              <h2>{selectedProblem.number} · {selectedProblem.title}</h2>
              <p className="muted">{selectedProblem.topics}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt>Difficulty</dt><dd>{selectedProblem.difficulty}</dd></div>
                <div><dt>Visibility</dt><dd>{selectedProblem.visibility}</dd></div>
                <div><dt>Used in</dt><dd>{selectedProblem.usedIn ? `${selectedProblem.usedIn} activities` : "No activities"}</dd></div>
                <div><dt>Last updated</dt><dd>{selectedProblem.updated}</dd></div>
              </dl>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to={selectedProblem.id === "new" ? "/teacher/problems/new" : `/teacher/problems/${selectedProblem.id}/edit`}>Edit</Link>
                <button className="button teacher-danger-button" type="button" onClick={() => removeProblem(selectedProblem)}>Delete</button>
              </div>
            </> : <p className="muted">Select a problem to view its details.</p>}
          </aside>
        </div>
      </>}

      {blockedDelete && <Dialog title="Problem is in use" onClose={() => setBlockedDelete(null)}>
        <div className="teacher-preview-dialog">
          <p><strong>{blockedDelete.number} · {blockedDelete.title}</strong></p>
          <p>This problem is used in {blockedDelete.usedIn} assignment{blockedDelete.usedIn === 1 ? "" : "s"} or contest{blockedDelete.usedIn === 1 ? "" : "s"}. Remove it from those activities before deleting it.</p>
          <div className="teacher-dialog-actions"><button className="button" type="button" onClick={() => setBlockedDelete(null)}>Close</button></div>
        </div>
      </Dialog>}

      {confirmDelete && <Dialog title="Confirm Deletion" onClose={() => setConfirmDelete(null)}>
        <div className="teacher-preview-dialog">
          <p>Are you sure you want to delete <strong>{confirmDelete.number} · {confirmDelete.title}</strong>?</p>
          <p className="muted">This action cannot be undone.</p>
          <div className="teacher-dialog-actions">
            <button className="button" type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="button teacher-danger-button" type="button" onClick={executeDelete}>Delete</button>
          </div>
        </div>
      </Dialog>}
    </section>
  );
}

type AssignmentRow = { id: string; title: string; classes: string; problems: number; due: string; submitted: string; status: "Open" | "Scheduled" | "Closed" | "Draft" };
const assignmentSeed: AssignmentRow[] = [
  { id: "a3", title: "Week 3 — JOIN practice", classes: "R11 · R12", problems: 3, due: "Sep 30 · 23:59", submitted: "38 / 42", status: "Open" },
  { id: "a4", title: "Week 4 — Aggregation", classes: "R11 · R13", problems: 5, due: "Oct 07 · 23:59", submitted: "—", status: "Scheduled" },
  { id: "a2", title: "Week 2 — SELECT basics", classes: "R11", problems: 4, due: "Sep 23 · 23:59", submitted: "42 / 42", status: "Closed" },
  { id: "a1", title: "Week 1 — Warm-up", classes: "R12", problems: 3, due: "Sep 16 · 23:59", submitted: "39 / 39", status: "Closed" },
  { id: "a5", title: "Week 5 — Subqueries", classes: "R13", problems: 4, due: "Oct 14 · 23:59", submitted: "—", status: "Draft" },
  { id: "am", title: "Midterm review", classes: "R11", problems: 6, due: "Oct 20 · 23:59", submitted: "—", status: "Draft" },
];

export function AssignmentsListPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState(assignmentSeed);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [semester, setSemester] = useState("Semester 2, 2026");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const filtered = useMemo(() => assignments.filter((item) =>
    semester === "Semester 2, 2026" &&
    `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
    (classFilter === "All classes" || item.classes.includes(classFilter)) &&
    (statusFilter === "All statuses" || item.status === statusFilter),
  ), [assignments, search, classFilter, statusFilter, semester]);
  const selectedAssignment = filtered.find((item) => item.id === selectedAssignmentId) || filtered[0] || null;

  return (
    <section className="teacher-page teacher-list-page">
      <TeacherPageIntro title="Assignments" context={assignments.length ? `${semester} · 9 assignments · 2 open` : `${semester} · 0 assignments`}>
        <button className="button primary" type="button" onClick={() => navigate("/teacher/assignments/new")}>New assignment</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />
      {assignments.length === 0 ? <TeacherEmptyState title="No assignments yet" description="Group problems from your library into an assignment, choose the classes, and set a due date." primaryLabel="New assignment" primaryTo="/teacher/assignments/new" secondaryLabel="Open problem library" secondaryTo="/teacher/problems" /> : <>
        <div className="teacher-list-filters teacher-activity-filters">
          <TeacherField label="SEARCH"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assignments…" /></TeacherField>
          <TeacherField label="CLASS"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option><option>R11</option><option>R12</option><option>R13</option></select></TeacherField>
          <TeacherField label="STATUS"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Open</option><option>Scheduled</option><option>Closed</option><option>Draft</option></select></TeacherField>
          <TeacherField label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}><option>Semester 1, 2025</option><option>Semester 2, 2026</option></select></TeacherField>
        </div>
        <div className="teacher-list-summary">
          <div><strong>2</strong><small>Open now</small></div>
          <div><strong>3</strong><small>Due this week</small></div>
          <div><strong>6</strong><small>Awaiting review</small></div>
        </div>
        <div className="teacher-divider teacher-list-divider" />
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div className="teacher-table-scroll teacher-list-table-scroll">
              <table className="teacher-table teacher-assignment-list-table">
                <thead><tr><th>ASSIGNMENT</th><th>CLASSES</th><th>PROBLEMS</th><th>DUE DATE</th><th>SUBMITTED</th><th>STATUS</th></tr></thead>
                <tbody>{filtered.map((item) => <tr
                  className={`teacher-selectable-list-row${selectedAssignment?.id === item.id ? " is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedAssignmentId(item.id)}
                >
                  <td data-label="ASSIGNMENT"><button className="teacher-selectable-row-title teacher-list-row-title" type="button" aria-label={`Show details for ${item.title}`} onClick={(event) => { event.stopPropagation(); setSelectedAssignmentId(item.id); }}>{item.title}</button></td><td data-label="CLASSES">{item.classes}</td><td data-label="PROBLEMS">{item.problems}</td><td data-label="DUE">{item.due}</td><td data-label="SUBMITTED">{item.submitted}</td>
                  <td data-label="STATUS" className={item.status === "Open" ? "teacher-state-success" : item.status === "Scheduled" ? "teacher-state-warning" : ""}>{item.status}</td>
                </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}>No assignments match these filters.</td></tr>}</tbody>
              </table>
            </div>
            <p className="teacher-list-footer">Showing {filtered.length} of 9 assignments</p>
          </div>
          <aside className="teacher-list-detail-panel">
            {selectedAssignment ? <>
              <span className="teacher-detail-eyebrow">ASSIGNMENT DETAILS</span>
              <h2>{selectedAssignment.title}</h2>
              <p className="muted">{selectedAssignment.classes}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt>Problems</dt><dd>{selectedAssignment.problems}</dd></div>
                <div><dt>Due date</dt><dd>{selectedAssignment.due}</dd></div>
                <div><dt>Submitted</dt><dd>{selectedAssignment.submitted}</dd></div>
                <div><dt>Status</dt><dd>{selectedAssignment.status}</dd></div>
              </dl>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to="/teacher/assignments/new">Edit</Link>
                <Link className="button" to={`/teacher/results?search=${encodeURIComponent(selectedAssignment.title)}`}>Results</Link>
              </div>
            </> : <p className="muted">Select an assignment to view its details.</p>}
          </aside>
        </div>
      </>}
    </section>
  );
}

type ContestRow = { id: string; title: string; classes: string; starts: string; duration: string; participants: string; status: "Live" | "Upcoming" | "Draft" | "Ended" };
const contestSeed: ContestRow[] = [
  { id: "c5", title: "SQL Sprint #05", classes: "R11 · R12", starts: "Sep 24 · 14:00", duration: "180 min", participants: "57 / 84", status: "Live" },
  { id: "c6", title: "SQL Sprint #06", classes: "R11 · R12", starts: "Sep 26 · 19:00", duration: "90 min", participants: "—", status: "Upcoming" },
  { id: "cm", title: "Midterm warm-up", classes: "R13", starts: "Oct 03 · 09:00", duration: "60 min", participants: "—", status: "Draft" },
  { id: "c4", title: "SQL Sprint #04", classes: "R11 · R12", starts: "Sep 12 · 19:00", duration: "90 min", participants: "79 / 84", status: "Ended" },
  { id: "c3", title: "SQL Sprint #03", classes: "R11", starts: "Sep 05 · 19:00", duration: "90 min", participants: "40 / 42", status: "Ended" },
  { id: "ci", title: "Intro challenge", classes: "R12", starts: "Aug 29 · 19:00", duration: "60 min", participants: "37 / 39", status: "Ended" },
];

export function ContestsListPage() {
  const navigate = useNavigate();
  const contests = contestSeed;
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [semester, setSemester] = useState("Semester 2, 2026");
  const [selectedContestId, setSelectedContestId] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => contests.filter((item) =>
    semester === "Semester 2, 2026" &&
    `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
    (classFilter === "All classes" || item.classes.includes(classFilter)) &&
    (statusFilter === "All statuses" || item.status === statusFilter),
  ), [contests, search, classFilter, statusFilter, semester]);
  const selectedContest = filtered.find((item) => item.id === selectedContestId) || filtered[0] || null;

  return (
    <section className="teacher-page teacher-list-page">
      <TeacherPageIntro title="Contests" context={contests.length ? `${semester} · 8 contests · 1 live` : `${semester} · 0 contests`}>
        <button className="button primary" type="button" onClick={() => navigate("/teacher/contests/new")}>New contest</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />
      {contests.length === 0 ? <TeacherEmptyState title="No contests yet" description="Run a timed contest with a live leaderboard for one or more classes." primaryLabel="New contest" primaryTo="/teacher/contests/new" secondaryLabel="Open problem library" secondaryTo="/teacher/problems" /> : <>
        <div className="teacher-list-filters teacher-activity-filters">
          <TeacherField label="SEARCH"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contests…" /></TeacherField>
          <TeacherField label="CLASS"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option><option>R11</option><option>R12</option><option>R13</option></select></TeacherField>
          <TeacherField label="STATUS"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Live</option><option>Upcoming</option><option>Draft</option><option>Ended</option></select></TeacherField>
          <TeacherField label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}><option>Semester 1, 2025</option><option>Semester 2, 2026</option></select></TeacherField>
        </div>
        <div className="teacher-list-summary">
          <div><strong>1</strong><small>Live now</small></div>
          <div><strong>2</strong><small>Upcoming</small></div>
          <div><strong>5</strong><small>Ended</small></div>
        </div>
        <div className="teacher-divider teacher-list-divider" />
        {notice && <p className="teacher-form-message" role="status">{notice}</p>}
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div className="teacher-table-scroll teacher-list-table-scroll">
              <table className="teacher-table teacher-contest-list-table">
                <thead><tr><th>CONTEST</th><th>CLASSES</th><th>STARTS</th><th>DURATION</th><th>PARTICIPANTS</th><th>STATUS</th></tr></thead>
                <tbody>{filtered.map((item) => <tr
                    className={`teacher-selectable-list-row${selectedContest?.id === item.id ? " is-selected" : ""}`}
                    key={item.id}
                    onClick={() => setSelectedContestId(item.id)}
                  >
                    <td data-label="CONTEST"><button className="teacher-selectable-row-title teacher-list-row-title" type="button" aria-label={`Show details for ${item.title}`} onClick={(event) => { event.stopPropagation(); setSelectedContestId(item.id); }}>{item.title}</button></td><td data-label="CLASSES">{item.classes}</td><td data-label="STARTS">{item.starts}</td><td data-label="DURATION">{item.duration}</td><td data-label="PARTICIPANTS">{item.participants}</td>
                    <td data-label="STATUS" className={item.status === "Live" ? "teacher-state-success" : item.status === "Upcoming" ? "teacher-state-warning" : ""}>{item.status}</td>
                  </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}>No contests match these filters.</td></tr>}</tbody>
              </table>
            </div>
            <p className="teacher-list-footer">Showing {filtered.length} of 8 contests</p>
          </div>
          <aside className="teacher-list-detail-panel">
            {selectedContest ? <>
              <span className="teacher-detail-eyebrow">CONTEST DETAILS</span>
              <h2>{selectedContest.title}</h2>
              <p className="muted">{selectedContest.classes}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt>Starts</dt><dd>{selectedContest.starts}</dd></div>
                <div><dt>Duration</dt><dd>{selectedContest.duration}</dd></div>
                <div><dt>Participants</dt><dd>{selectedContest.participants}</dd></div>
                <div><dt>Status</dt><dd>{selectedContest.status}</dd></div>
              </dl>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to={`/teacher/results?search=${encodeURIComponent(selectedContest.title)}`}>Results</Link>
                <button className="button" type="button" onClick={() => setNotice(`Leaderboard for ${selectedContest.title} opened in this demo.`)}>Leaderboard</button>
              </div>
            </> : <p className="muted">Select a contest to view its details.</p>}
          </aside>
        </div>
      </>}
    </section>
  );
}

export function TeacherEmptyState({
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: {
  title: string;
  description: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel: string;
  secondaryTo: string;
}) {
  return <div className="teacher-empty-state">
    <div><h2>{title}</h2><p>{description}</p><div className="teacher-empty-actions"><Link className="button primary" to={primaryTo}>{primaryLabel}</Link><Link className="button" to={secondaryTo}>{secondaryLabel}</Link></div></div>
  </div>;
}
