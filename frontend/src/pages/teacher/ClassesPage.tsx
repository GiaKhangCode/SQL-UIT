import { useEffect, useMemo, useState } from "react";
import { Dialog, ErrorState, Loading } from "../../components/ui";
import {
  type TeacherClass,
  type TeacherClassMember,
} from "../../data/teacherTypes";
import { TeacherField } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";

export function ClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [term, setTerm] = useState("All terms");
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [classDetailsOpen, setClassDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"assignments" | "members">("assignments");
  const [classActivities, setClassActivities] = useState<any[]>([]);
  const [detailMembers, setDetailMembers] = useState<TeacherClassMember[]>([]);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    teacherService.getClasses().then((data) => {
      setClasses(data);
      setSelectedClassId(data[0]?.id || "");
    }).catch((error) => setClassesError(error instanceof Error ? error.message : "Could not load classes.")).finally(() => setClassesLoading(false));
  }, []);

  useEffect(() => {
    if (!classDetailsOpen || !selectedClassId) return;
    let active = true;
    setDetailError("");
    setClassActivities([]);
    setDetailMembers([]);
    Promise.all([teacherService.getAssignments(), teacherService.getClassMembers(selectedClassId)])
      .then(([activities, classMembers]) => {
        if (!active) return;
        setClassActivities(activities.filter((item: any) => item.classIds?.includes(selectedClassId)));
        setDetailMembers(classMembers);
      })
      .catch(() => { if (active) setDetailError("Could not load class activity or members."); });
    return () => { active = false; };
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
  const selectedClass = visibleClasses.find((classInfo) => classInfo.id === selectedClassId) || visibleClasses[0] || null;
  const assignments = classActivities.filter(item => !item.isContest);
  const contests = classActivities.filter(item => item.isContest);
  const filteredStudents = useMemo(() => detailMembers.filter((student) =>
    `${student.name} ${student.id}`.toLowerCase().includes(studentSearch.toLowerCase()),
  ), [detailMembers, studentSearch]);

  useEffect(() => {
    if (selectedClass && selectedClassId !== selectedClass.id) setSelectedClassId(selectedClass.id);
  }, [selectedClass, selectedClassId]);

  function selectClass(classInfo: TeacherClass) {
    setSelectedClassId(classInfo.id);
    setStudentSearch("");
  }

  function openClassDetails() {
    setDetailTab("assignments");
    setClassDetailsOpen(true);
  }

  return (
    <section className="teacher-page teacher-classes-page">
      <h1 className="sr-only">Classes</h1>

      {classesLoading ? <Loading label="Loading classes…" /> : classesError ? <ErrorState title="Could not load classes" message={classesError} onRetry={() => window.location.reload()} /> : classes.length === 0 ? <div className="teacher-empty-state">
        <div><h2>No classes yet</h2><p>No classes have been assigned to you yet.</p></div>
      </div> : <>
      <div className="teacher-class-filters">
        <TeacherField label="SEARCH">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes..."
          />
        </TeacherField>
        <TeacherField label="ACADEMIC TERM">
          <select value={term} onChange={(event) => setTerm(event.target.value)}>
            <option>All terms</option>
            {termOptions.map((termOption) => <option key={termOption}>{termOption}</option>)}
          </select>
        </TeacherField>
      </div>

      <div className="teacher-classes-layout">
        <div className="teacher-classes-main teacher-list-detail-main">
          <div className="teacher-table-scroll sticky-list-table-wrap">
            <table className="teacher-table teacher-classes-table sticky-list-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Members</th>
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
                    <td data-label="Status" className={classInfo.status === "Active" ? "teacher-state-success" : "muted"}>{classInfo.status}</td>
                  </tr>
                ))}
                {!visibleClasses.length && (
                  <tr><td colSpan={4} className="muted">No classes match this term and search.</td></tr>
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

            <p className="teacher-class-summary-students">{selectedClass.students} students</p>
            <button className="button primary teacher-class-detail-button" type="button" onClick={openClassDetails}>
              View class details
            </button>
          </> : <p className="muted">Select a class to view its assignments and student progress.</p>}
        </aside>
      </div>
      </>}

      {classDetailsOpen && selectedClass && (
        <Dialog
          className="teacher-class-detail-dialog-modal"
          title={`${selectedClass.id} · Class details`}
          onClose={() => setClassDetailsOpen(false)}
        >
          <div className="teacher-class-detail-dialog-content">
            <p className="muted">{selectedClass.course} · {selectedClass.term}</p>
            {(selectedClass.startDate && selectedClass.endDate) && (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.5rem" }}>
                {selectedClass.startDate} to {selectedClass.endDate}
              </p>
            )}
            <p className="teacher-class-detail-counts">{selectedClass.students} students · {assignments.length} assignments · {contests.length} contests</p>
            {detailError && <p role="alert" className="teacher-state-failed">{detailError}</p>}

            <div className="teacher-class-detail-tabs" role="tablist" aria-label="Class details">
              <button id="class-assignments-tab" type="button" role="tab" aria-selected={detailTab === "assignments"} aria-controls="class-assignments-panel" className={detailTab === "assignments" ? "is-active" : ""} onClick={() => setDetailTab("assignments")}>
                Class assignments <span>{assignments.length}</span>
              </button>
              <button id="class-members-tab" type="button" role="tab" aria-selected={detailTab === "members"} aria-controls="class-members-panel" className={detailTab === "members" ? "is-active" : ""} onClick={() => setDetailTab("members")}>
                Class members <span>{detailMembers.length}</span>
              </button>
            </div>

            <section id="class-assignments-panel" className="teacher-class-detail-section" role="tabpanel" aria-labelledby="class-assignments-tab" hidden={detailTab !== "assignments"}>
              {assignments.length ? assignments.map((assignment) => (
                <article className="teacher-class-assignment" key={assignment.id}>
                  <div className="teacher-class-assignment-topline">
                    <div>
                      <strong>{assignment.title}</strong>
                      <small>Due {assignment.due || "—"} · {assignment.status}</small>
                    </div>
                    <b>{assignment.submitted}</b>
                  </div>
                </article>
              )) : <p className="muted">No assignment progress is available for this class yet.</p>}
            </section>

            <section id="class-members-panel" className="teacher-class-detail-section" role="tabpanel" aria-labelledby="class-members-tab" hidden={detailTab !== "members"}>
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

    </section>
  );
}
