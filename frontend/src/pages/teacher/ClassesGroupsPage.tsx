import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  teacherClassProgress,
  type TeacherClass,
  type TeacherClassMember,
} from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";

export function ClassesGroupsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [term, setTerm] = useState("All terms");
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [classDetailsOpen, setClassDetailsOpen] = useState(false);
  const [dialog, setDialog] = useState<"members" | "create_class" | null>(null);
  const [members, setMembers] = useState<TeacherClassMember[]>([]);
  const [draftMembers, setDraftMembers] = useState<TeacherClassMember[]>([]);
  const [availableStudents, setAvailableStudents] = useState<TeacherClassMember[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [saved, setSaved] = useState(false);
  const [emptyStateNotice, setEmptyStateNotice] = useState("");
  
  const [newClassForm, setNewClassForm] = useState({
    id: "",
    course: "",
    term: "",
    mode: "Individual",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    teacherService.getClasses().then(setClasses).catch(console.error);
  }, []);

  useEffect(() => {
    if (dialog === "members" && selectedClassId) {
      teacherService.getClassMembers(selectedClassId).then(data => {
        setMembers(data);
        setDraftMembers(data);
      }).catch(console.error);
      teacherService.getAllStudents().then(setAvailableStudents).catch(console.error);
    }
  }, [dialog, selectedClassId]);

  const termOptions = useMemo(
    () => Array.from(new Set(classes.map((classInfo) => classInfo.term))).sort((a, b) => {
      const termA = /Semester ([12]), (\d{4})/.exec(a);
      const termB = /Semester ([12]), (\d{4})/.exec(b);
      if (!termA || !termB) return a.localeCompare(b);
      return Number(termB[2]) - Number(termA[2]) || Number(termB[1]) - Number(termA[1]);
    }),
    [classes],
  );
  const visibleClasses = useMemo(() => classes.filter((classInfo) => {
    const matchesTerm = term === "All terms" || classInfo.term === term;
    const matchesSearch = `${classInfo.id} ${classInfo.course} ${classInfo.term}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesTerm && matchesSearch;
  }), [classes, search, term]);
  const selectedClass = visibleClasses.find((classInfo) => classInfo.id === selectedClassId) || null;
  const totalVisibleStudents = visibleClasses.reduce((total, classInfo) => total + classInfo.students, 0);
  const selectedProgress = selectedClass ? teacherClassProgress[selectedClass.id] : undefined;
  const assignments = selectedProgress?.assignments || [];
  const students = selectedProgress?.students || [];
  const filteredStudents = useMemo(() => students.filter((student) =>
    `${student.name} ${student.id}`.toLowerCase().includes(studentSearch.toLowerCase()),
  ), [students, studentSearch]);
  const totalSubmissions = assignments.reduce((total, assignment) => total + assignment.submitted, 0);
  const expectedSubmissions = assignments.reduce((total, assignment) => total + assignment.expected, 0);
  const submissionRate = expectedSubmissions ? Math.round((totalSubmissions / expectedSubmissions) * 100) : 0;

  function selectClass(classInfo: TeacherClass) {
    setSelectedClassId(classInfo.id);
    setStudentSearch("");
  }

  function addMember() {
    if (newMemberId) {
      const student = availableStudents.find(s => s.id === newMemberId);
      if (student) {
        setDraftMembers((current) => [...current, { ...student, role: "Member" }]);
        setNewMemberId("");
        setSaved(false);
      }
    }
  }

  async function saveMembers() {
    if (!selectedClassId) return;
    try {
      const originalIds = new Set(members.map(m => m.id));
      const draftIds = new Set(draftMembers.map(m => m.id));

      const toAdd = draftMembers.filter(m => !originalIds.has(m.id));
      const toRemove = members.filter(m => !draftIds.has(m.id));

      await Promise.all([
        ...toAdd.map(m => teacherService.addClassMember(selectedClassId, { student_id: m.id! })),
        ...toRemove.map(m => teacherService.removeClassMember(selectedClassId, m.id!))
      ]);
      
      setMembers(draftMembers);
      setSaved(true);
    } catch (err) {
      console.error("Failed to save members", err);
    }
  }

  async function createClassSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassForm.id || !newClassForm.course || !newClassForm.term) return;
    
    teacherService.createClass(newClassForm).then((created) => {
      setClasses((curr) => [...curr, created]);
      setSelectedClassId(created.id);
      setDialog(null);
      setNewClassForm({ id: "", course: "", term: "", mode: "Individual", startDate: "", endDate: "" });
    }).catch(console.error);
  }

  function openCreateClass() {
    setNewClassForm({
      id: "",
      course: "",
      term: "",
      mode: "Individual",
      startDate: "",
      endDate: ""
    });
    setDialog("create_class");
  }

  return (
    <section className="teacher-page teacher-classes-page">
      <TeacherPageIntro
        title="Classes & groups"
        context={`${term} · ${visibleClasses.length} ${visibleClasses.length === 1 ? "class" : "classes"}`}
      >
        <button className="button primary" type="button" onClick={openCreateClass}>New class</button>
        {classes.length > 0 && (
          <button className="button" type="button" disabled={!selectedClass} onClick={() => setDialog("members")}>
            Manage members
          </button>
        )}
      </TeacherPageIntro>
      <div className="teacher-divider" />

      {classes.length === 0 ? <div className="teacher-empty-state">
        <div><h2>No classes yet</h2><p>Create a class to invite students and organize groups.</p><div className="teacher-empty-actions"><button className="button primary" type="button" onClick={openCreateClass}>New class</button><button className="button" type="button" onClick={() => setEmptyStateNotice("Class list import is ready for the demo.")}>Import class list</button></div>{emptyStateNotice && <p className="teacher-form-message" role="status">{emptyStateNotice}</p>}</div>
      </div> : <>
      <div className="teacher-class-filters">
        <TeacherField label="ACADEMIC TERM">
          <select value={term} onChange={(event) => setTerm(event.target.value)}>
            <option>All terms</option>
            {termOptions.map((termOption) => <option key={termOption}>{termOption}</option>)}
          </select>
        </TeacherField>
        <TeacherField label="SEARCH">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes..."
          />
        </TeacherField>
      </div>

      <div className="teacher-class-list-summary" aria-live="polite">
        <strong>{visibleClasses.length} {visibleClasses.length === 1 ? "class" : "classes"}</strong>
        <span>{term === "All terms" ? "Across all teaching terms" : term} · {totalVisibleStudents} students</span>
      </div>

      <div className="teacher-classes-layout">
        <div className="teacher-classes-main">
          <div className="teacher-table-scroll">
            <table className="teacher-table teacher-classes-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Members</th>
                  <th>Work mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleClasses.map((classInfo) => (
                  <tr
                    className={`teacher-class-row${selectedClass?.id === classInfo.id ? " is-selected" : ""}`}
                    key={classInfo.id}
                    onClick={() => selectClass(classInfo)}
                  >
                    <td data-label="Class">
                      <button
                        className="teacher-table-link teacher-class-identity"
                        type="button"
                        aria-label={`Show summary for ${classInfo.id}`}
                        aria-current={selectedClass?.id === classInfo.id ? "true" : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectClass(classInfo);
                        }}
                      >
                        <span>{classInfo.id}</span>
                        <small>{classInfo.course}</small>
                      </button>
                    </td>
                    <td data-label="Term">{classInfo.term}</td>
                    <td data-label="Members">{classInfo.students}</td>
                    <td data-label="Work mode">{classInfo.mode}</td>
                    <td data-label="Status" className="teacher-state-success">{classInfo.status}</td>
                  </tr>
                ))}
                {!visibleClasses.length && (
                  <tr><td colSpan={5} className="muted">No classes match this term and search.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        <aside className="teacher-class-details">
          {selectedClass ? <>
            <div className="teacher-class-detail-heading">
              <div>
                <span className="teacher-detail-eyebrow">CLASS SUMMARY</span>
                <h2>{selectedClass.id}</h2>
                <p className="muted">{selectedClass.course} · {selectedClass.term}</p>
              </div>
              <span className={selectedClass.status === "Active" ? "teacher-state-success" : "muted"}>{selectedClass.status}</span>
            </div>
            <p className="teacher-class-detail-meta">{selectedClass.mode} · Teacher Huy Lai</p>

            <div className="teacher-class-metrics teacher-class-summary-metrics">
              <div><span>STUDENTS</span><strong>{selectedClass.students}</strong></div>
              <div><span>ASSIGNMENTS</span><strong>{assignments.length}</strong></div>
              <div><span>SUBMISSIONS</span><strong>{totalSubmissions}</strong></div>
            </div>
            <button className="button primary teacher-class-detail-button" type="button" onClick={() => setClassDetailsOpen(true)}>
              View class details
            </button>
          </> : <p className="muted">Select a class to view its assignments and student progress.</p>}
        </aside>
      </div>
      </>}

      {dialog === "members" && selectedClass && (
        <Dialog title="Manage members" onClose={() => setDialog(null)}>
          <div className="teacher-manage-dialog">
            <p className="tiny muted">{selectedClass.id} · {selectedClass.students} enrolled students</p>
            <div className="teacher-member-list">
              {draftMembers.map((member) => (
                <div key={member.name}>
                  <span>{member.name}<small>{member.role}</small></span>
                  <button
                    className="teacher-remove-row"
                    type="button"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => {
                      setDraftMembers((current) => current.filter((item) => item.id !== member.id));
                      setSaved(false);
                    }}
                  >×</button>
                </div>
              ))}
            </div>
            <div className="teacher-add-member-form">
              <label className="teacher-field" style={{ width: "100%" }}>
                <span>SEARCH & ADD STUDENT</span>
                <input 
                  value={newMemberId} 
                  onChange={(event) => setNewMemberId(event.target.value)} 
                  placeholder="Type name or email to search..."
                />
              </label>
            </div>
            {newMemberId.trim().length > 0 && (
              <div className="teacher-member-search-results" style={{ marginTop: "0.5rem", border: "1px solid var(--border)", borderRadius: "6px", maxHeight: "150px", overflowY: "auto" }}>
                {availableStudents
                  .filter(s => 
                    s.name.toLowerCase().includes(newMemberId.toLowerCase()) || 
                    s.email?.toLowerCase().includes(newMemberId.toLowerCase())
                  )
                  .map(student => {
                    const isAdded = draftMembers.some(m => m.id === student.id);
                    return (
                      <div key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.875rem" }}>{student.name} <span className="muted">({student.email})</span></span>
                        <button 
                          className="button" 
                          type="button"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          disabled={isAdded}
                          onClick={() => {
                            setDraftMembers((current) => [...current, { ...student, role: "Member" }]);
                            setNewMemberId("");
                            setSaved(false);
                          }}
                        >
                          {isAdded ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                {availableStudents.filter(s => 
                    s.name.toLowerCase().includes(newMemberId.toLowerCase()) || 
                    s.email?.toLowerCase().includes(newMemberId.toLowerCase())
                ).length === 0 && (
                  <div style={{ padding: "0.5rem", fontSize: "0.875rem", color: "var(--muted)" }}>No students found.</div>
                )}
              </div>
            )}
            <div style={{ marginTop: "1rem" }}>
              {saved && <p className="teacher-form-message" role="status">Changes saved.</p>}
              <button className="button primary" type="button" onClick={saveMembers}>Save members</button>
            </div>
          </div>
        </Dialog>
      )}
      {classDetailsOpen && selectedClass && (
        <Dialog
          className="teacher-class-detail-dialog-modal"
          title={`${selectedClass.id} · Class details`}
          onClose={() => setClassDetailsOpen(false)}
        >
          <div className="teacher-class-detail-dialog-content">
            <p className="muted">{selectedClass.course} · {selectedClass.term} · {selectedClass.mode}</p>
            {(selectedClass.startDate && selectedClass.endDate) && (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.5rem" }}>
                {selectedClass.startDate} to {selectedClass.endDate}
              </p>
            )}
            <div className="teacher-class-metrics">
              <div><span>STUDENTS</span><strong>{selectedClass.students}</strong></div>
              <div><span>ASSIGNMENTS</span><strong>{assignments.length}</strong></div>
              <div><span>SUBMISSIONS</span><strong>{totalSubmissions}</strong></div>
              <div><span>SUBMITTED</span><strong>{submissionRate}%</strong></div>
            </div>

            <section className="teacher-class-detail-section">
              <div className="teacher-class-section-heading">
                <h3>Class assignments</h3>
                <Link to="/teacher/assignments">View all</Link>
              </div>
              {assignments.length ? assignments.map((assignment) => {
                const progress = assignment.expected
                  ? Math.round((assignment.submitted / assignment.expected) * 100)
                  : 0;
                return <article className="teacher-class-assignment" key={assignment.id}>
                  <div className="teacher-class-assignment-topline">
                    <div>
                      <strong>{assignment.title}</strong>
                      <small>Due {assignment.dueDate} · {assignment.status}</small>
                    </div>
                    <b>{assignment.submitted}/{assignment.expected}</b>
                  </div>
                  <div className="teacher-class-progress-track" aria-label={`${progress}% submitted`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </article>;
              }) : <p className="muted">No assignment progress is available for this class yet.</p>}
            </section>

            <section className="teacher-class-detail-section">
              <div className="teacher-class-section-heading">
                <h3>Student progress</h3>
                <span>{students.length} sample records</span>
              </div>
              <label className="teacher-student-search">
                <span className="sr-only">Search students</span>
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search students..."
                />
              </label>
              <div className="teacher-class-student-list">
                {filteredStudents.map((student) => (
                  <div className="teacher-class-student-row" key={student.id}>
                    <div className="teacher-class-student-name">
                      <strong>{student.name}</strong>
                      <small>{student.id}</small>
                    </div>
                    <div className="teacher-class-student-stat">
                      <strong>{student.submissions}</strong>
                      <small>submissions</small>
                    </div>
                    <div className="teacher-class-student-stat">
                      <strong>{student.completedAssignments}/{assignments.length}</strong>
                      <small>assignments</small>
                    </div>
                  </div>
                ))}
                {!filteredStudents.length && <p className="muted">No students match this search.</p>}
              </div>
            </section>
          </div>
        </Dialog>
      )}

      {dialog === "create_class" && (
        <Dialog title="Create a new class" onClose={() => setDialog(null)}>
          <form className="teacher-manage-dialog" onSubmit={createClassSubmit}>
            <p className="tiny muted">Set up a new class or section</p>
            
            <label className="teacher-field" style={{ marginTop: "1rem" }}>
              <span>CLASS ID</span>
              <input required value={newClassForm.id} onChange={e => setNewClassForm({...newClassForm, id: e.target.value})} placeholder="E.g. IS207.R14" />
            </label>

            <label className="teacher-field">
              <span>COURSE NAME</span>
              <input required value={newClassForm.course} onChange={e => setNewClassForm({...newClassForm, course: e.target.value})} placeholder="E.g. Web Development" />
            </label>

            <label className="teacher-field">
              <span>TERM</span>
              <select required value={newClassForm.term} onChange={e => setNewClassForm({...newClassForm, term: e.target.value})}>
                <option value="" disabled>Select a term...</option>
                {Array.from({ length: 11 }, (_, i) => 2025 + i).flatMap(year => [1, 2, 3].map(sem => `Semester ${sem}, ${year}`)).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: "1rem" }}>
              <label className="teacher-field" style={{ flex: 1 }}>
                <span>START DATE</span>
                <input required type="date" value={newClassForm.startDate} onChange={e => setNewClassForm({...newClassForm, startDate: e.target.value})} />
              </label>
              <label className="teacher-field" style={{ flex: 1 }}>
                <span>END DATE</span>
                <input required type="date" value={newClassForm.endDate} onChange={e => setNewClassForm({...newClassForm, endDate: e.target.value})} />
              </label>
            </div>
            
            <button className="button primary" style={{ marginTop: "1rem" }} type="submit">Create class</button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
