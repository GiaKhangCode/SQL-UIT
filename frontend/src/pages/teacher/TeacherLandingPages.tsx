import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Dialog, ErrorState, Loading } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";

type ProblemRow = {
  id: string;
  number: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  topics: string;
  visibility: "Public" | "Private" | string;
};

export function ProblemLibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [problems, setProblemState] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await teacherService.getAllProblems();
        const mapped = data.map((p: any) => ({
          id: p.id,
          number: p.number,
          title: p.title,
          difficulty: p.difficulty,
          topics: (p.topics && p.topics.length > 0) ? p.topics.join(" · ") : (p.topic || ""),
          visibility: p.practiceListed ? "Public" : "Private",
        }));
        setProblemState(mapped);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load problems.");
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
  const [confirmDelete, setConfirmDelete] = useState<ProblemRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => problems.filter((problem) =>
    `${problem.title} ${problem.topics}`.toLowerCase().includes(search.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (topic === "All topics" || problem.topics.toLowerCase().includes(topic.toLowerCase())) &&
    (visibility === "All" || problem.visibility === visibility),
  ), [problems, search, difficulty, topic, visibility]);
  const selectedProblem = filtered.find((problem) => problem.id === selectedProblemId) || filtered[0] || null;
  const topicOptions = [...new Set(problems.flatMap((problem) => problem.topics.split(" · ").map((topic) => topic.trim()).filter(Boolean)))].sort();

  function removeProblem(problem: ProblemRow) {
    setDeleteError("");
    setConfirmDelete(problem);
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const problem = confirmDelete;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await teacherService.deleteProblem(problem.id);
      setProblemState(problems.filter((item) => item.id !== problem.id));
      setNotice(`${problem.title} was removed from the library.`);
      if (selectedProblemId === problem.id) {
        setSelectedProblemId("");
      }
      setConfirmDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : `Could not delete ${problem.title}.`);
    } finally {
      setDeleteBusy(false);
    }
  }

  const publicCount = problems.filter(p => p.visibility === "Public").length;
  const privateCount = problems.length - publicCount;

  return (
    <section className="teacher-page teacher-library-page">
      <TeacherPageIntro title="Problem library" context={problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"} · ${publicCount} public in Practice · ${privateCount} private` : "0 problems"}>
        <button className="button primary" type="button" onClick={() => navigate("/teacher/problems/new")}>New problem</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      {loading ? (
        <Loading label="Loading problems…" />
      ) : loadError ? <ErrorState title="Could not load problems" message={loadError} onRetry={() => window.location.reload()} /> : problems.length === 0 ? (
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
          <TeacherField label="TOPIC"><select value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{topicOptions.map((item) => <option key={item}>{item}</option>)}</select></TeacherField>
          <TeacherField label="VISIBILITY"><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>All</option><option>Public</option><option>Private</option></select></TeacherField>
        </div>
        <div className="teacher-list-summary">
          <div><strong>{problems.length}</strong><small>Problems in library</small></div>
          <div><strong>{publicCount}</strong><small>Public in Practice</small></div>
          <div><strong>{privateCount}</strong><small>Private problems</small></div>
        </div>
        <div className="teacher-divider teacher-list-divider" />
        {notice && <p className="teacher-form-message" role="status">{notice}</p>}
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div className="teacher-table-scroll teacher-list-table-scroll">
              <table className="teacher-table teacher-library-table">
                <thead><tr><th>PROBLEM</th><th>DIFFICULTY</th><th>TOPICS</th><th>VISIBILITY</th></tr></thead>
                <tbody>{filtered.map((problem) => <tr
                  className={`teacher-selectable-list-row${selectedProblem?.id === problem.id ? " is-selected" : ""}`}
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                >
                  <td data-label="PROBLEM"><button className="teacher-selectable-row-title teacher-library-title" type="button" aria-label={`Show details for ${problem.title}`} onClick={(event) => { event.stopPropagation(); setSelectedProblemId(problem.id); }}><span>{problem.number}</span><span>{problem.title}</span></button></td>
                  <td data-label="DIFFICULTY">{problem.difficulty}</td>
                  <td data-label="TOPICS">{problem.topics}</td>
                  <td data-label="VISIBILITY">{problem.visibility}</td>
                </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={4}>No problems match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="teacher-list-footer">Showing {filtered.length} of {problems.length} problem{problems.length === 1 ? "" : "s"}</p>
          </div>
          <aside className="teacher-list-detail-panel">
            {selectedProblem ? <>
              <span className="teacher-detail-eyebrow">PROBLEM DETAILS</span>
              <h2>{selectedProblem.number} · {selectedProblem.title}</h2>
              <p className="muted">{selectedProblem.topics}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt>Difficulty</dt><dd>{selectedProblem.difficulty}</dd></div>
                <div><dt>Visibility</dt><dd>{selectedProblem.visibility}</dd></div>
              </dl>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to={selectedProblem.id === "new" ? "/teacher/problems/new" : `/teacher/problems/${selectedProblem.id}/edit`}>Edit</Link>
                <button className="button teacher-danger-button" type="button" onClick={() => removeProblem(selectedProblem)}>Delete</button>
              </div>
            </> : <p className="muted">Select a problem to view its details.</p>}
          </aside>
        </div>
      </>}

      {confirmDelete && <Dialog title="Confirm Deletion" onClose={() => setConfirmDelete(null)}>
        <div className="teacher-preview-dialog">
          <p>Are you sure you want to delete <strong>{confirmDelete.number} · {confirmDelete.title}</strong>?</p>
          <p className="muted">This action cannot be undone. The server also removes submissions and saved drafts for this problem.</p>
          {deleteError && <p className="teacher-state-failed" role="alert">{deleteError}</p>}
          <div className="teacher-dialog-actions">
            <button className="button" type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="button teacher-danger-button" type="button" disabled={deleteBusy} onClick={executeDelete}>{deleteBusy ? "Deleting…" : "Delete"}</button>
          </div>
        </div>
      </Dialog>}
    </section>
  );
}

function TeacherEmptyState({ title, description, primaryLabel, primaryTo, secondaryLabel, secondaryTo }: { title: string; description: string; primaryLabel: string; primaryTo: string; secondaryLabel: string; secondaryTo: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{description}</p><div className="teacher-empty-actions"><Link className="button primary" to={primaryTo}>{primaryLabel}</Link><Link className="button" to={secondaryTo}>{secondaryLabel}</Link></div></div>;
}

type AssignmentRow = { id: string; title: string; classes: string; problems: number; due: string; submitted: string; status: "Open" | "Scheduled" | "Closed" | "Draft" };
export function AssignmentsListPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  
  useEffect(() => {
    async function loadAssignments() {
      try {
        const data = await teacherService.getAssignments();
        setAssignments(data.filter((item: any) => !item.isContest));
      } catch(e) {
        setLoadError(e instanceof Error ? e.message : "Could not load assignments.");
      } finally {
        setLoading(false);
      }
    }
    loadAssignments();
  }, []);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [confirmAssignment, setConfirmAssignment] = useState<AssignmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => assignments.filter((item) =>
    `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
    (classFilter === "All classes" || item.classes.includes(classFilter)) &&
    (statusFilter === "All statuses" || item.status === statusFilter),
  ), [assignments, search, classFilter, statusFilter]);
  const selectedAssignment = filtered.find((item) => item.id === selectedAssignmentId) || filtered[0] || null;

  async function removeAssignment() {
    if (!confirmAssignment || deleteBusy) return;
    const assignment = confirmAssignment;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await teacherService.deleteAssignment(assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      if (selectedAssignmentId === assignment.id) setSelectedAssignmentId("");
      setNotice(`${assignment.title} was deleted.`);
      setConfirmAssignment(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete assignment.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className="teacher-page teacher-list-page">
      <TeacherPageIntro title="Assignments" context={`${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`}>
        <button className="button primary" type="button" onClick={() => navigate("/teacher/assignments/new")}>New assignment</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />
      {notice && <p className="teacher-form-message" role="status">{notice}</p>}
      {loading ? <Loading label="Loading assignments…" /> : loadError ? <div className="empty-state" role="alert">{loadError}</div> : assignments.length === 0 ? <TeacherEmptyState title="No assignments yet" description="Group problems from your library into an assignment, choose the classes, and set a due date." primaryLabel="New assignment" primaryTo="/teacher/assignments/new" secondaryLabel="Open problem library" secondaryTo="/teacher/problems" /> : <>
        <div className="teacher-list-filters teacher-activity-filters">
          <TeacherField label="SEARCH"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assignments…" /></TeacherField>
          <TeacherField label="CLASS"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option>{Array.from(new Set(assignments.flatMap(item => item.classes.split(", ")))).filter(name => name && name !== "No classes").map(name => <option key={name}>{name}</option>)}</select></TeacherField>
          <TeacherField label="STATUS"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Open</option><option>Scheduled</option><option>Closed</option><option>Draft</option></select></TeacherField>
        </div>
        <div className="teacher-list-summary">
          <div><strong>{assignments.filter(a => a.status === 'Open').length}</strong><small>Open now</small></div>
          <div><strong>{assignments.filter(a => a.status === 'Scheduled').length}</strong><small>Scheduled</small></div>
          <div><strong>{assignments.filter(a => a.status === 'Draft').length}</strong><small>Drafts</small></div>
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
            <p className="teacher-list-footer">Showing {filtered.length} of {assignments.length} assignments</p>
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
                <Link className="button primary" to={`/teacher/assignments/${selectedAssignment.id}/edit`}>Edit</Link>
                <Link className="button" to={`/teacher/results?search=${encodeURIComponent(selectedAssignment.title)}`}>Results</Link>
                <button className="button teacher-danger-button" onClick={() => { setDeleteError(""); setConfirmAssignment(selectedAssignment); }}>Delete</button>
              </div>
            </> : <p className="muted">Select an assignment to view its details.</p>}
          </aside>
        </div>
      </>}
      {confirmAssignment && <Dialog title="Delete assignment" onClose={() => setConfirmAssignment(null)}>
        <div className="teacher-preview-dialog">
          <p>Delete <strong>{confirmAssignment.title}</strong> from its assigned classes?</p>
          <p className="muted">Students will no longer see this assignment. Existing problem submissions remain in their history.</p>
          {deleteError && <p className="teacher-state-failed" role="alert">{deleteError}</p>}
          <div className="teacher-dialog-actions"><button className="button" type="button" onClick={() => setConfirmAssignment(null)}>Cancel</button><button className="button teacher-danger-button" type="button" disabled={deleteBusy} onClick={() => void removeAssignment()}>{deleteBusy ? "Deleting…" : "Delete assignment"}</button></div>
        </div>
      </Dialog>}
    </section>
  );
}
