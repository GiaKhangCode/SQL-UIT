import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, ErrorState, Loading } from "../../components/ui";
import {
  type TeacherClass,
  type TeacherClassMember,
} from "../../data/teacherTypes";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";
import { academicTerms } from "../../utils/academicTerms";

export function ClassesGroupsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
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
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [classActivities, setClassActivities] = useState<any[]>([]);
  const [detailMembers, setDetailMembers] = useState<TeacherClassMember[]>([]);
  const [detailError, setDetailError] = useState("");
  
  const [newClassForm, setNewClassForm] = useState({
    id: "",
    course: "",
    term: "",
    mode: "Individual",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    teacherService.getClasses().then(setClasses).catch((error) => setClassesError(error instanceof Error ? error.message : "Could not load classes.")).finally(() => setClassesLoading(false));
  }, []);

  useEffect(() => {
    if (dialog === "members" && selectedClassId) {
      setDialogError("");
      teacherService.getClassMembers(selectedClassId).then(data => {
        setMembers(data);
        setDraftMembers(data);
      }).catch((error) => setDialogError(error instanceof Error ? error.message : "Could not load class members."));
      teacherService.getAllStudents().then(setAvailableStudents).catch((error) => setDialogError(error instanceof Error ? error.message : "Could not load students."));
    }
  }, [dialog, selectedClassId]);

  useEffect(() => {
    if (!classDetailsOpen || !selectedClassId) return;
    setDetailError("");
    Promise.all([teacherService.getAssignments(), teacherService.getClassMembers(selectedClassId)])
      .then(([activities, classMembers]) => {
        setClassActivities(activities.filter((item: any) => item.classIds?.includes(selectedClassId)));
        setDetailMembers(classMembers);
      })
      .catch(() => setDetailError("Could not load class activity or members."));
  }, [classDetailsOpen, selectedClassId]);

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
  const assignments = classActivities.filter(item => !item.isContest);
  const filteredStudents = useMemo(() => detailMembers.filter((student) =>
    `${student.name} ${student.id}`.toLowerCase().includes(studentSearch.toLowerCase()),
  ), [detailMembers, studentSearch]);

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
    if (!selectedClassId || dialogBusy) return;
    setDialogBusy(true);
    setDialogError("");
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
      setClasses((current) => current.map((item) => item.id === selectedClassId ? { ...item, students: draftMembers.length } : item));
      setSaved(true);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Could not save members.");
    } finally {
      setDialogBusy(false);
    }
  }

  async function createClassSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassForm.id || !newClassForm.course || !newClassForm.term) return;
    if (newClassForm.endDate < newClassForm.startDate) { setDialogError("End date must be after the start date."); return; }
    
    setDialogBusy(true);
    setDialogError("");
    teacherService.createClass(newClassForm).then((created) => {
      setClasses((curr) => [...curr, created]);
      setSelectedClassId(created.id);
      setDialog(null);
      setNewClassForm({ id: "", course: "", term: "", mode: "Individual", startDate: "", endDate: "" });
    }).catch((error) => setDialogError(error instanceof Error ? error.message : "Could not create class.")).finally(() => setDialogBusy(false));
  }

  function openCreateClass() {
    setDialogError("");
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
        context={classesError ? "Classes unavailable" : `${term} · ${visibleClasses.length} ${visibleClasses.length === 1 ? "class" : "classes"}`}
      >
        <button className="button primary" type="button" disabled={classesLoading || !!classesError} onClick={openCreateClass}>New class</button>
        {classes.length > 0 && (
          <button className="button" type="button" disabled={!selectedClass} onClick={() => setDialog("members")}>
            Manage members
          </button>
        )}
      </TeacherPageIntro>
      <div className="teacher-divider" />

      {classesLoading ? <Loading label="Loading classes…" /> : classesError ? <ErrorState title="Could not load classes" message={classesError} onRetry={() => window.location.reload()} /> : classes.length === 0 ? <div className="teacher-empty-state">
        <div><h2>No classes yet</h2><p>Create a class to invite students and organize groups.</p><div className="teacher-empty-actions"><button className="button primary" type="button" onClick={openCreateClass}>New class</button></div></div>
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
        <span>{term === "All terms" ? "Across all teaching terms" : term} · {totalVisibleStudents} student{totalVisibleStudents === 1 ? "" : "s"}</span>
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
                    <td data-label="Status" className={classInfo.status === "Active" ? "teacher-state-success" : "muted"}>{classInfo.status}</td>
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
            <p className="teacher-class-detail-meta">{selectedClass.mode}</p>

            <div className="teacher-class-metrics teacher-class-summary-metrics">
              <div><span>STUDENTS</span><strong>{selectedClass.students}</strong></div>
              <div><span>TERM</span><strong>{selectedClass.term}</strong></div>
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
            <p className="tiny muted">{selectedClass.id} · {selectedClass.students} enrolled student{selectedClass.students === 1 ? "" : "s"}</p>
            <div className="teacher-member-list">
              {draftMembers.map((member) => (
                <div key={member.id}>
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
              {dialogError && <p className="teacher-state-failed" role="alert">{dialogError}</p>}
              <button className="button primary" type="button" disabled={dialogBusy} onClick={saveMembers}>{dialogBusy ? "Saving…" : "Save members"}</button>
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
              <div><span>CONTESTS</span><strong>{classActivities.filter(item => item.isContest).length}</strong></div>
            </div>
            {detailError && <p role="alert" className="teacher-state-failed">{detailError}</p>}

            <section className="teacher-class-detail-section">
              <div className="teacher-class-section-heading">
                <h3>Class assignments</h3>
                <Link to="/teacher/assignments">View all</Link>
              </div>
              {assignments.length ? assignments.map((assignment) => {
                return <article className="teacher-class-assignment" key={assignment.id}>
                  <div className="teacher-class-assignment-topline">
                    <div>
                      <strong>{assignment.title}</strong>
                      <small>Due {assignment.due || "—"} · {assignment.status}</small>
                    </div>
                    <b>{assignment.submitted}</b>
                  </div>
                </article>;
              }) : <p className="muted">No assignment progress is available for this class yet.</p>}
            </section>

            <section className="teacher-class-detail-section">
              <div className="teacher-class-section-heading">
                <h3>Class members</h3>
                <span>{detailMembers.length} enrolled</span>
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
                    <div className="teacher-class-student-stat"><small>{student.role}</small></div>
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
                {academicTerms().map(t => (
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
            
            {dialogError && <p className="teacher-state-failed" role="alert">{dialogError}</p>}
            <button className="button primary" disabled={dialogBusy} style={{ marginTop: "1rem" }} type="submit">{dialogBusy ? "Creating…" : "Create class"}</button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
