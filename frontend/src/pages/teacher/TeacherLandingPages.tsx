import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { LanguageText } from "../../components/LanguageSwitch";
import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Database } from "lucide-react";
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
  database: string;
};

export function ProblemLibraryPage() {
  const { t: tr } = useLanguage("teacher");
  const { t } = useLanguage();
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
          database: p.databaseType || "SQL Server",
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
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => problems.filter((problem) =>
    `${problem.title} ${problem.topics}`.toLowerCase().includes(search.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (topic === "All topics" || problem.topics.toLowerCase().includes(topic.toLowerCase())) &&
    (visibility === "All" || problem.visibility === visibility),
  ), [problems, search, difficulty, topic, visibility]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * 15;
  const pageProblems = filtered.slice(firstIndex, firstIndex + 15);
  const selectedProblem = pageProblems.find((problem) => problem.id === selectedProblemId) || pageProblems[0] || null;

  useEffect(() => {
    setPage(1);
    setSelectedProblemId("");
  }, [search, difficulty, topic, visibility]);
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [currentPage, search, difficulty, topic, visibility]);
  const topicOptions = [...new Set(problems.flatMap((problem) => problem.topics.split(" · ").map((topic) => topic.trim()).filter(Boolean)))].sort();

  return (
    <section className="teacher-page teacher-library-page compact-teacher-library">
      <h1 className="sr-only"><TranslatedText>{t("Problem library")}</TranslatedText></h1>
      {loading ? (
        <Loading label={t("Loading problems…")} />
      ) : loadError ? <ErrorState title={t("Could not load problems")} message={t(loadError)} onRetry={() => window.location.reload()} /> : problems.length === 0 ? (
        <TeacherEmptyState
          title={t("No problems yet")}
          description={t("Create your first SQL problem with a schema, seed data and a reference solution. You can reuse it in any assignment or contest.")}
          primaryLabel={t("New problem")}
          primaryTo="/teacher/problems/new"
          secondaryLabel={t("Browse public problems")}
          secondaryTo="/teacher/problems?visibility=Public"
        />
      ) : <>
        <div className="teacher-list-filters teacher-problem-filters">
          <TeacherField label={t("Search")}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search title or topic…")} /></TeacherField>
          <TeacherField label={t("Difficulty")}><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="All levels">{t("All levels")}</option><option value="Easy">{t("Easy")}</option><option value="Medium">{t("Medium")}</option><option value="Hard">{t("Hard")}</option></select></TeacherField>
          <TeacherField label={t("Topic")}><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="All topics">{t("All topics")}</option>{topicOptions.map((item) => <option key={item} value={item}>{tr(item)}</option>)}</select></TeacherField>
          <TeacherField label={t("Visibility")}><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="All">{t("All")}</option><option value="Public">{t("Public")}</option><option value="Private">{t("Private")}</option></select></TeacherField>
          <Link className="button teacher-database-library-trigger" to="/teacher/database-library"><Database size={15} aria-hidden="true" /><LanguageText text="Database library" order={2} /></Link>
          <button className="button primary teacher-problem-new" type="button" onClick={() => navigate("/teacher/problems/new")}><LanguageText text="New problem" order={2} /></button>
        </div>
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap">
              <table className="teacher-table teacher-library-table sticky-list-table">
                <thead><tr><th>ID</th><th><TranslatedText>{t("Problem")}</TranslatedText></th><th><TranslatedText>{t("Difficulty")}</TranslatedText></th><th><TranslatedText>{t("Topics")}</TranslatedText></th><th><TranslatedText>{t("Visibility")}</TranslatedText></th></tr></thead>
                <tbody>{pageProblems.map((problem) => <tr
                  className={`teacher-selectable-list-row${selectedProblem?.id === problem.id ? " is-selected" : ""}`}
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                >
                  <td data-label="ID">{problem.number}</td>
                  <td data-label={t("Problem")}><button className="teacher-selectable-row-title teacher-library-title" type="button" aria-label={t("Show details for {title}", { title: problem.title })} onClick={(event) => { event.stopPropagation(); setSelectedProblemId(problem.id); }}>{problem.title}</button></td>
                  <td data-label={t("Difficulty")}><TranslatedText>{t(problem.difficulty)}</TranslatedText></td>
                  <td data-label={t("Topics")}>{problem.topics}</td>
                  <td data-label={t("Visibility")}><TranslatedText>{t(problem.visibility)}</TranslatedText></td>
                </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={5}><TranslatedText>{t("No problems match these filters.")}</TranslatedText></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="teacher-list-footer teacher-library-pagination">
              <span><TranslatedText>{t("Showing {start}–{end} of {total} problems", { start: filtered.length ? firstIndex + 1 : 0, end: firstIndex + pageProblems.length, total: filtered.length })}</TranslatedText></span>
              <nav aria-label={t("Problem library pagination")}>
                <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedProblemId(""); }}><TranslatedText>{t("← Previous")}</TranslatedText></button>
                <span><TranslatedText>{t("Page {page} of {total}", { page: currentPage, total: pageCount })}</TranslatedText></span>
                <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedProblemId(""); }}><TranslatedText>{t("Next →")}</TranslatedText></button>
              </nav>
            </div>
          </div>
          <aside className="teacher-list-detail-panel teacher-problem-details-panel">
            {selectedProblem ? <>
              <div className="teacher-problem-detail-body">
              <span className="teacher-detail-eyebrow"><TranslatedText>{t("PROBLEM DETAILS")}</TranslatedText></span>
              <h2>{selectedProblem.number} · {selectedProblem.title}</h2>
              <p className="muted">{selectedProblem.topics}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt><TranslatedText>{t("Difficulty")}</TranslatedText></dt><dd><TranslatedText>{t(selectedProblem.difficulty)}</TranslatedText></dd></div>
                <div><dt><TranslatedText>{t("Visibility")}</TranslatedText></dt><dd><TranslatedText>{t(selectedProblem.visibility)}</TranslatedText></dd></div>
                <div><dt><TranslatedText>{t("Database")}</TranslatedText></dt><dd>{selectedProblem.database}</dd></div>
              </dl>
              </div>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to={selectedProblem.id === "new" ? "/teacher/problems/new" : `/teacher/problems/${selectedProblem.id}/edit`}><LanguageText text="Edit" order={2} /></Link>
              </div>
            </> : <p className="muted"><TranslatedText>{t("Select a problem to view its details.")}</TranslatedText></p>}
          </aside>
        </div>
      </>}

    </section>
  );
}

function TeacherEmptyState({ title, description, primaryLabel, primaryTo, secondaryLabel, secondaryTo }: { title: string; description: string; primaryLabel: string; primaryTo: string; secondaryLabel: string; secondaryTo: string }) {
  const { t: tr } = useLanguage("teacher");
  return <div className="empty-state"><h2><TranslatedText>{title}</TranslatedText></h2><p><TranslatedText>{description}</TranslatedText></p><div className="teacher-empty-actions"><Link className="button primary" to={primaryTo}><TranslatedText>{tr(primaryLabel)}</TranslatedText></Link><Link className="button" to={secondaryTo}><TranslatedText>{tr(secondaryLabel)}</TranslatedText></Link></div></div>;
}

type AssignmentRow = { id: string; title: string; classes: string; problems: number; due: string; submitted: string; eligibleStudents: number; status: "Open" | "Scheduled" | "Closed" | "Draft" };
export function AssignmentsListPage() {
  const { t: tr } = useLanguage("teacher");
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
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [confirmAssignment, setConfirmAssignment] = useState<AssignmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => assignments.filter((item) =>
    `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
    (classFilter === "All classes" || item.classes.includes(classFilter)) &&
    (statusFilter === "All statuses" || item.status === statusFilter),
  ), [assignments, search, classFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * 15;
  const pageAssignments = filtered.slice(firstIndex, firstIndex + 15);
  const selectedAssignment = pageAssignments.find((item) => item.id === selectedAssignmentId) || pageAssignments[0] || null;
  useEffect(() => {
    setPage(1);
    setSelectedAssignmentId("");
  }, [search, classFilter, statusFilter]);
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [currentPage, search, classFilter, statusFilter]);

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
    <section className="teacher-page teacher-list-page teacher-assignment-page compact-teacher-assignments">
      <h1 className="sr-only"><TranslatedText>{tr("Assignments")}</TranslatedText></h1>
      {notice && <p className="teacher-form-message" role="status"><TranslatedText>{tr(notice)}</TranslatedText></p>}
      {loading ? <Loading label={tr("Loading assignments…")} /> : loadError ? <div className="empty-state" role="alert"><TranslatedText>{tr(loadError)}</TranslatedText></div> : assignments.length === 0 ? <TeacherEmptyState title={tr("No assignments yet")} description={tr("Group problems from your library into an assignment, choose the classes, and set a due date.")} primaryLabel={tr("New assignment")} primaryTo="/teacher/assignments/new" secondaryLabel={tr("Open problem library")} secondaryTo="/teacher/problems" /> : <>
        <div className="teacher-list-filters teacher-activity-filters teacher-assignment-filters">
          <TeacherField label={tr("SEARCH")}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Search assignments…")} /></TeacherField>
          <TeacherField label={tr("CLASS")}><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="All classes">{tr("All classes")}</option>{Array.from(new Set(assignments.flatMap(item => item.classes.split(", ")))).filter(name => name && name !== "No classes").map(name => <option key={name} value={name}>{name}</option>)}</select></TeacherField>
          <TeacherField label={tr("STATUS")}><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All statuses">{tr("All statuses")}</option><option value="Open">{tr("Open")}</option><option value="Scheduled">{tr("Scheduled")}</option><option value="Closed">{tr("Closed")}</option><option value="Draft">{tr("Draft")}</option></select></TeacherField>
          <button className="button primary teacher-assignment-new" type="button" onClick={() => navigate("/teacher/assignments/new")}><TranslatedText>{tr("New assignment")}</TranslatedText></button>
        </div>
        <div className="teacher-list-detail-layout">
          <div className="teacher-list-detail-main">
            <div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap">
              <table className="teacher-table teacher-assignment-list-table sticky-list-table">
                <thead><tr><th><TranslatedText>{tr("ASSIGNMENT")}</TranslatedText></th><th><TranslatedText>{tr("CLASSES")}</TranslatedText></th><th><TranslatedText>{tr("PROBLEMS")}</TranslatedText></th><th><TranslatedText>{tr("DUE DATE")}</TranslatedText></th><th><TranslatedText>{tr("SUBMITTED")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead>
                <tbody>{pageAssignments.map((item) => <tr
                  className={`teacher-selectable-list-row${selectedAssignment?.id === item.id ? " is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedAssignmentId(item.id)}
                >
                  <td data-label={tr("ASSIGNMENT")}><button className="teacher-selectable-row-title teacher-list-row-title" type="button" aria-label={tr("Show details for {value0}", { value0: item.title })} onClick={(event) => { event.stopPropagation(); setSelectedAssignmentId(item.id); }}>{item.title}</button></td><td data-label={tr("CLASSES")}>{item.classes}</td><td data-label={tr("PROBLEMS")}>{item.problems}</td><td data-label={tr("DUE")}>{item.due}</td><td data-label={tr("SUBMITTED")}>{item.submitted}</td>
                  <td data-label={tr("STATUS")} className={item.status === "Open" ? "teacher-state-success" : item.status === "Scheduled" ? "teacher-state-warning" : ""}><TranslatedText>{tr(item.status)}</TranslatedText></td>
                </tr>)}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={6}><TranslatedText>{tr("No assignments match these filters.")}</TranslatedText></td></tr>}</tbody>
              </table>
            </div>
            <div className="teacher-list-footer teacher-library-pagination">
              <span><TranslatedText>{tr("Showing")}</TranslatedText> {filtered.length ? firstIndex + 1 : 0}–{firstIndex + pageAssignments.length} <TranslatedText>{tr("of")}</TranslatedText> {filtered.length} <TranslatedText>{tr("assignments")}</TranslatedText></span>
              <nav aria-label={tr("Assignments pagination")}>
                <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedAssignmentId(""); }}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
                <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
                <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedAssignmentId(""); }}><TranslatedText>{tr("Next →")}</TranslatedText></button>
              </nav>
            </div>
          </div>
          <aside className="teacher-list-detail-panel">
            {selectedAssignment ? <>
              <span className="teacher-detail-eyebrow"><TranslatedText>{tr("ASSIGNMENT DETAILS")}</TranslatedText></span>
              <h2>{selectedAssignment.title}</h2>
              <p className="muted">{selectedAssignment.classes}</p>
              <dl className="teacher-list-detail-facts">
                <div><dt><TranslatedText>{tr("Assigned students")}</TranslatedText></dt><dd>{selectedAssignment.eligibleStudents}</dd></div>
                <div><dt><TranslatedText>{tr("Problems")}</TranslatedText></dt><dd>{selectedAssignment.problems}</dd></div>
                <div><dt><TranslatedText>{tr("Due date")}</TranslatedText></dt><dd>{selectedAssignment.due}</dd></div>
                <div><dt><TranslatedText>{tr("Submitted")}</TranslatedText></dt><dd>{selectedAssignment.submitted}</dd></div>
                <div><dt><TranslatedText>{tr("Status")}</TranslatedText></dt><dd><TranslatedText>{tr(selectedAssignment.status)}</TranslatedText></dd></div>
              </dl>
              <div className="teacher-list-detail-actions">
                <Link className="button primary" to={`/teacher/assignments/${selectedAssignment.id}/edit`}><TranslatedText>{tr("Edit")}</TranslatedText></Link>
                <Link className="button" to={`/teacher/results?search=${encodeURIComponent(selectedAssignment.title)}`}><TranslatedText>{tr("Results")}</TranslatedText></Link>
                <button className="button teacher-danger-button" onClick={() => { setDeleteError(""); setConfirmAssignment(selectedAssignment); }}><TranslatedText>{tr("Delete")}</TranslatedText></button>
              </div>
            </> : <p className="muted"><TranslatedText>{tr("Select an assignment to view its details.")}</TranslatedText></p>}
          </aside>
        </div>
      </>}
      {confirmAssignment && <Dialog title={tr("Delete assignment")} onClose={() => setConfirmAssignment(null)}>
        <div className="teacher-preview-dialog">
          <p><TranslatedText>{tr("Delete")}</TranslatedText> <strong>{confirmAssignment.title}</strong> <TranslatedText>{tr("from its assigned classes?")}</TranslatedText></p>
          <p className="muted"><TranslatedText>{tr("Students will no longer see this assignment. Existing problem submissions remain in their history.")}</TranslatedText></p>
          {deleteError && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(deleteError)}</TranslatedText></p>}
          <div className="teacher-dialog-actions"><button className="button" type="button" onClick={() => setConfirmAssignment(null)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button className="button teacher-danger-button" type="button" disabled={deleteBusy} onClick={() => void removeAssignment()}><TranslatedText>{deleteBusy ? tr("Deleting…") : tr("Delete assignment")}</TranslatedText></button></div>
        </div>
      </Dialog>}
    </section>
  );
}
