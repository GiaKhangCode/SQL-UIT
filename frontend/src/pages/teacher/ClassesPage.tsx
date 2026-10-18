import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useMemo, useState, useRef } from "react";
import { Dialog, ErrorState, Loading } from "../../components/ui";
import {
  type TeacherClass,
  type TeacherClassMember,
} from "../../data/teacherTypes";
import { TeacherField } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";

export function ClassesPage() {
  const { t: tr } = useLanguage("teacher");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [term, setTerm] = useState("All terms");
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
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
  const pageCount = Math.max(1, Math.ceil(visibleClasses.length / 15));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * 15;
  const pageClasses = visibleClasses.slice(firstIndex, firstIndex + 15);
  const selectedClass = pageClasses.find((classInfo) => classInfo.id === selectedClassId) || pageClasses[0] || null;
  useEffect(() => { setPage(1); setSelectedClassId(""); }, [search, term]);
  useEffect(() => { tableScrollRef.current?.scrollTo({ top: 0 }); }, [currentPage, search, term]);
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
    <section className="teacher-page teacher-classes-page compact-teacher-classes">
      <h1 className="sr-only"><TranslatedText>{tr("Classes")}</TranslatedText></h1>

      {classesLoading ? <Loading label={tr("Loading classes…")} /> : classesError ? <ErrorState title={tr("Could not load classes")} message={tr(classesError)} onRetry={() => window.location.reload()} /> : classes.length === 0 ? <div className="teacher-empty-state">
        <div><h2><TranslatedText>{tr("No classes yet")}</TranslatedText></h2><p><TranslatedText>{tr("No classes have been assigned to you yet.")}</TranslatedText></p></div>
      </div> : <>
      <div className="teacher-class-filters">
        <TeacherField label={tr("SEARCH")}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tr("Search classes...")}
          />
        </TeacherField>
        <TeacherField label={tr("ACADEMIC TERM")}>
          <select value={term} onChange={(event) => setTerm(event.target.value)}>
            <option value="All terms">{tr("All terms")}</option>
            {termOptions.map((termOption) => <option key={termOption} value={termOption}>{tr(termOption)}</option>)}
          </select>
        </TeacherField>
      </div>

      <div className="teacher-classes-layout teacher-list-detail-layout">
        <div className="teacher-classes-main teacher-list-detail-main">
          <div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap">
            <table className="teacher-table teacher-classes-table sticky-list-table">
              <thead>
                <tr>
                  <th><TranslatedText>{tr("Class")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Term")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Members")}</TranslatedText></th>
                  <th><TranslatedText>{tr("Status")}</TranslatedText></th>
                </tr>
              </thead>
              <tbody>
                {pageClasses.map((classInfo) => (
                  <tr
                    className={`teacher-class-row${selectedClass?.id === classInfo.id ? " is-selected" : ""}`}
                    key={classInfo.id}
                    onClick={() => selectClass(classInfo)}
                  >
                    <td data-label={tr("Class")}>
                      <button
                        className="teacher-table-link teacher-class-identity"
                        type="button"
                        aria-label={tr("Show summary for {value0}", { value0: classInfo.id })}
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
                    <td data-label={tr("Term")}>{classInfo.term}</td>
                    <td data-label={tr("Members")}>{classInfo.students}</td>
                    <td data-label={tr("Status")} className={classInfo.status === "Active" ? "teacher-state-success" : "muted"}><TranslatedText>{tr(classInfo.status)}</TranslatedText></td>
                  </tr>
                ))}
                {!visibleClasses.length && (
                  <tr><td colSpan={4} className="muted"><TranslatedText>{tr("No classes match this term and search.")}</TranslatedText></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="teacher-list-footer teacher-library-pagination">
            <span><TranslatedText>{tr("Showing")}</TranslatedText> {visibleClasses.length ? firstIndex + 1 : 0}–{firstIndex + pageClasses.length} <TranslatedText>{tr("of")}</TranslatedText> {visibleClasses.length} <TranslatedText>{tr("classes")}</TranslatedText></span>
            <nav aria-label={tr("Classes pagination")}>
              <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedClassId(""); }}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
              <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
              <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedClassId(""); }}><TranslatedText>{tr("Next →")}</TranslatedText></button>
            </nav>
          </div>
        </div>

        <aside className="teacher-class-details teacher-list-detail-panel">
          {selectedClass ? <>
            <div className="teacher-class-detail-heading">
              <div>
                <span className="teacher-detail-eyebrow"><TranslatedText>{tr("CLASS SUMMARY")}</TranslatedText></span>
                <h2>{selectedClass.id}</h2>
                <p className="muted">{selectedClass.course} · {selectedClass.term}</p>
              </div>
              <span className={selectedClass.status === "Active" ? "teacher-state-success" : "muted"}><TranslatedText>{tr(selectedClass.status)}</TranslatedText></span>
            </div>

            <p className="teacher-class-summary-students">{selectedClass.students} <TranslatedText>{tr("students")}</TranslatedText></p>
            <button className="button primary teacher-class-detail-button" type="button" onClick={openClassDetails}>
              <TranslatedText>{tr("View class details")}</TranslatedText>
            </button>
          </> : <p className="muted"><TranslatedText>{tr("Select a class to view its assignments and student progress.")}</TranslatedText></p>}
        </aside>
      </div>
      </>}

      {classDetailsOpen && selectedClass && (
        <Dialog
          className="teacher-class-detail-dialog-modal"
          title={tr("{value0} · Class details", { value0: selectedClass.id })}
          onClose={() => setClassDetailsOpen(false)}
        >
          <div className="teacher-class-detail-dialog-content">
            <p className="muted">{selectedClass.course} · {selectedClass.term}</p>
            {(selectedClass.startDate && selectedClass.endDate) && (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.5rem" }}>
                {selectedClass.startDate} <TranslatedText>{tr("to")}</TranslatedText> {selectedClass.endDate}
              </p>
            )}
            <p className="teacher-class-detail-counts">{selectedClass.students} <TranslatedText>{tr("students ·")}</TranslatedText> {assignments.length} <TranslatedText>{tr("assignments ·")}</TranslatedText> {contests.length} <TranslatedText>{tr("contests")}</TranslatedText></p>
            {detailError && <p role="alert" className="teacher-state-failed"><TranslatedText>{tr(detailError)}</TranslatedText></p>}

            <div className="teacher-class-detail-tabs" role="tablist" aria-label={tr("Class details")}>
              <button id="class-assignments-tab" type="button" role="tab" aria-selected={detailTab === "assignments"} aria-controls="class-assignments-panel" className={detailTab === "assignments" ? "is-active" : ""} onClick={() => setDetailTab("assignments")}>
                <TranslatedText>{tr("Class assignments")}</TranslatedText> <span>{assignments.length}</span>
              </button>
              <button id="class-members-tab" type="button" role="tab" aria-selected={detailTab === "members"} aria-controls="class-members-panel" className={detailTab === "members" ? "is-active" : ""} onClick={() => setDetailTab("members")}>
                <TranslatedText>{tr("Class members")}</TranslatedText> <span>{detailMembers.length}</span>
              </button>
            </div>

            <section id="class-assignments-panel" className="teacher-class-detail-section" role="tabpanel" aria-labelledby="class-assignments-tab" hidden={detailTab !== "assignments"}>
              {assignments.length ? assignments.map((assignment) => (
                <article className="teacher-class-assignment" key={assignment.id}>
                  <div className="teacher-class-assignment-topline">
                    <div>
                      <strong>{assignment.title}</strong>
                      <small><TranslatedText>{tr("Due")}</TranslatedText> {assignment.due || "—"} · <TranslatedText>{tr(assignment.status)}</TranslatedText></small>
                    </div>
                    <b>{assignment.submitted}</b>
                  </div>
                </article>
              )) : <p className="muted"><TranslatedText>{tr("No assignment progress is available for this class yet.")}</TranslatedText></p>}
            </section>

            <section id="class-members-panel" className="teacher-class-detail-section" role="tabpanel" aria-labelledby="class-members-tab" hidden={detailTab !== "members"}>
              <label className="teacher-student-search">
                <span className="sr-only"><TranslatedText>{tr("Search students")}</TranslatedText></span>
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder={tr("Search students...")}
                />
              </label>
              <div className="teacher-class-student-list">
                {filteredStudents.map((student) => (
                  <div className="teacher-class-student-row" key={student.id}>
                    <div className="teacher-class-student-name">
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                    </div>
                    <div className="teacher-class-student-stat"><small><TranslatedText>{tr(student.role)}</TranslatedText></small></div>
                  </div>
                ))}
                {!filteredStudents.length && <p className="muted"><TranslatedText>{tr("No students match this search.")}</TranslatedText></p>}
              </div>
            </section>
          </div>
        </Dialog>
      )}

    </section>
  );
}
