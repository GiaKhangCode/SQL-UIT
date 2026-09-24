import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  teacherClasses,
  teacherClassProgress,
  teacherRoster,
  type TeacherClass,
} from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro } from "./TeacherPageParts";

export function ClassesGroupsPage() {
  const [classes, setClasses] = useState(teacherClasses);
  const [term, setTerm] = useState("All terms");
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [classDetailsOpen, setClassDetailsOpen] = useState(false);
  const [dialog, setDialog] = useState<"members" | null>(null);
  const [members, setMembers] = useState(teacherRoster);
  const [newMember, setNewMember] = useState("");
  const [saved, setSaved] = useState(false);
  const [emptyStateNotice, setEmptyStateNotice] = useState("");

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
    const name = newMember.trim();
    if (name) {
      setMembers((current) => [...current, { name, role: "Member" }]);
      setNewMember("");
      setSaved(false);
    }
  }

  function createFirstClass() {
    const firstClass: TeacherClass = {
      id: "IS207.R14",
      course: "IS207 · New class",
      term: "Semester 2, 2026",
      students: 0,
      mode: "Individual",
      status: "Active",
      groups: [],
    };
    setClasses([firstClass]);
    setSelectedClassId(firstClass.id);
  }

  return (
    <section className="teacher-page teacher-classes-page">
      <TeacherPageIntro
        title="Classes & groups"
        context={`${term} · ${visibleClasses.length} ${visibleClasses.length === 1 ? "class" : "classes"}`}
      >
        {classes.length ? <button className="button primary" type="button" disabled={!selectedClass} onClick={() => setDialog("members")}>Manage members</button> : <button className="button primary" type="button" onClick={createFirstClass}>New class</button>}
      </TeacherPageIntro>
      <div className="teacher-divider" />

      {classes.length === 0 ? <div className="teacher-empty-state">
        <div><h2>No classes yet</h2><p>Create a class to invite students and organize groups.</p><div className="teacher-empty-actions"><button className="button primary" type="button" onClick={createFirstClass}>New class</button><button className="button" type="button" onClick={() => setEmptyStateNotice("Class list import is ready for the demo.")}>Import class list</button></div>{emptyStateNotice && <p className="teacher-form-message" role="status">{emptyStateNotice}</p>}</div>
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
              {members.map((member) => (
                <div key={member.name}>
                  <span>{member.name}<small>{member.role}</small></span>
                  <button
                    className="teacher-remove-row"
                    type="button"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => {
                      setMembers((current) => current.filter((item) => item.name !== member.name));
                      setSaved(false);
                    }}
                  >×</button>
                </div>
              ))}
            </div>
            <div className="teacher-add-member-form">
              <label className="teacher-field">
                <span>ADD A STUDENT</span>
                <input value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="Student name" />
              </label>
              <button className="button" type="button" onClick={addMember}>Add</button>
            </div>
            {saved && <p className="teacher-form-message" role="status">Changes saved for this demo session.</p>}
            <button className="button primary" type="button" onClick={() => setSaved(true)}>Save members</button>
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
    </section>
  );
}
