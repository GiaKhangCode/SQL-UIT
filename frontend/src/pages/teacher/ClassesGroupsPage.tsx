import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  teacherClasses,
  teacherRoster,
  type TeacherClass,
} from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";

export function ClassesGroupsPage() {
  const [classes, setClasses] = useState(teacherClasses);
  const [semester, setSemester] = useState("Fall 2026");
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(teacherClasses[0].id);
  const [selectedGroupId, setSelectedGroupId] = useState("Group 03");
  const [dialog, setDialog] = useState<"members" | "edit-group" | null>(null);
  const [members, setMembers] = useState(teacherRoster);
  const [newMember, setNewMember] = useState("");
  const [groupName, setGroupName] = useState("Group 03");
  const [saved, setSaved] = useState(false);
  const [joinRequests, setJoinRequests] = useState<Record<string, { name: string; studentId: string; requested: string }[]>>({
    "IS207.R11": [
      { name: "Khoa Tran", studentId: "22521234", requested: "Sep 23 · 09:14" },
      { name: "Lan Pham", studentId: "22520987", requested: "Sep 23 · 10:42" },
      { name: "Hung Vo", studentId: "22521456", requested: "Sep 24 · 08:05" },
    ],
    "IS207.R13": [
      { name: "Mai Do", studentId: "22521001", requested: "Sep 24 · 08:31" },
    ],
  });
  const [requestNotice, setRequestNotice] = useState("");

  const visibleClasses = useMemo(
    () =>
      classes.filter((classInfo) =>
        `${classInfo.id} ${classInfo.course}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [classes, search],
  );
  const selectedClass =
    classes.find((classInfo) => classInfo.id === selectedClassId) ||
    classes[0];
  const selectedGroup =
    selectedClass.groups.find((group) => group.id === selectedGroupId) ||
    selectedClass.groups[0];

  function selectClass(classInfo: TeacherClass) {
    setSelectedClassId(classInfo.id);
    setSelectedGroupId(classInfo.groups[0]?.id || "Group 01");
    setGroupName(classInfo.groups[0]?.id || "Group 01");
  }

  function addMember() {
    const name = newMember.trim();
    if (name) {
      setMembers((current) => [...current, { name, role: "Member" }]);
      setNewMember("");
      setSaved(false);
    }
  }

  function resolveRequest(studentId: string, approve: boolean) {
    setJoinRequests((current) => ({
      ...current,
      [selectedClass.id]: (current[selectedClass.id] || []).filter((request) => request.studentId !== studentId),
    }));
    setClasses((current) => current.map((classInfo) => classInfo.id === selectedClass.id
      ? {
          ...classInfo,
          pendingJoinRequests: Math.max(0, classInfo.pendingJoinRequests - 1),
          students: classInfo.students + (approve ? 1 : 0),
        }
      : classInfo));
    setRequestNotice(`${approve ? "Approved" : "Rejected"} the student request for ${selectedClass.id}.`);
  }

  const currentRequests = joinRequests[selectedClass.id] || [];

  return (
    <section className="teacher-page teacher-classes-page">
      <TeacherPageIntro
        title="Classes & groups"
        context={`${semester} / Your teaching space`}
      >
        <button className="button primary" type="button" onClick={() => setDialog("members")}>
          Manage members
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-class-filters">
        <TeacherField label="SEMESTER">
          <select value={semester} onChange={(event) => setSemester(event.target.value)}>
            <option>Fall 2026</option>
            <option>Spring 2026</option>
            <option>Fall 2025</option>
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

      <div className="teacher-classes-layout">
        <div className="teacher-classes-main">
          <div className="teacher-table-scroll">
            <table className="teacher-table teacher-classes-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Members</th>
                  <th>Work mode</th>
                  <th>Status</th>
                  <th>Join requests</th>
                </tr>
              </thead>
              <tbody>
                {visibleClasses.map((classInfo) => (
                  <tr
                    className={selectedClassId === classInfo.id ? "is-selected" : ""}
                    key={classInfo.id}
                  >
                    <td data-label="Class">
                      <button
                        className="teacher-table-link"
                        type="button"
                        onClick={() => selectClass(classInfo)}
                      >
                        {classInfo.id}
                      </button>
                    </td>
                    <td data-label="Members">{classInfo.students}</td>
                    <td data-label="Work mode">{classInfo.mode}</td>
                    <td data-label="Status" className="teacher-state-success">{classInfo.status}</td>
                    <td data-label="Join requests" className={classInfo.pendingJoinRequests ? "teacher-state-warning" : ""}>
                      {classInfo.pendingJoinRequests} pending
                    </td>
                  </tr>
                ))}
                {!visibleClasses.length && (
                  <tr><td colSpan={5} className="muted">No matching classes.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="teacher-join-requests">
            <TeacherSectionTitle title={`Join requests / ${selectedClass.id} · ${currentRequests.length} pending`} />
            {requestNotice && <p className="teacher-form-message" role="status">{requestNotice}</p>}
            <div className="teacher-table-scroll">
              <table className="teacher-table teacher-join-requests-table">
                <thead><tr><th>Student</th><th>Student ID</th><th>Requested</th><th>Actions</th></tr></thead>
                <tbody>
                  {currentRequests.map((request) => (
                    <tr key={request.studentId}>
                      <td data-label="Student">{request.name}</td>
                      <td data-label="Student ID">{request.studentId}</td>
                      <td data-label="Requested">{request.requested}</td>
                      <td data-label="Actions"><button className="teacher-join-action" type="button" onClick={() => resolveRequest(request.studentId, true)}>Approve</button><span className="teacher-action-separator">·</span><button className="teacher-join-action" type="button" onClick={() => resolveRequest(request.studentId, false)}>Reject</button></td>
                    </tr>
                  ))}
                  {!currentRequests.length && <tr><td colSpan={4} className="muted">No pending join requests.</td></tr>}
                </tbody>
              </table>
            </div>
            {!!currentRequests.length && <button className="button teacher-small-button" type="button" onClick={() => currentRequests.slice().forEach((request) => resolveRequest(request.studentId, true))}>Approve all {currentRequests.length}</button>}
          </div>

          <div className="teacher-groups-table-wrap">
            <TeacherSectionTitle title={`Groups / ${selectedClass.id}`} />
            <div className="teacher-table-scroll">
              <table className="teacher-table teacher-groups-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Members</th>
                    <th>Last submission</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClass.groups.slice(0, 3).map((group) => (
                    <tr
                      className={selectedGroupId === group.id ? "is-selected" : ""}
                      key={group.id}
                    >
                      <td data-label="Group">
                        <button
                          className="teacher-table-link"
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(group.id);
                            setGroupName(group.id);
                          }}
                        >
                          {group.id}
                        </button>
                      </td>
                      <td data-label="Members">{group.members} students</td>
                      <td
                        data-label="Last submission"
                        className={group.lastSubmission === "Pending" ? "teacher-state-warning" : ""}
                      >
                        {group.lastSubmission}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="teacher-class-details">
          <h2>{selectedClass.id}</h2>
          <p className="muted">{selectedClass.course}</p>
          <p className="muted">{semester} · Huy Lai</p>
          <div className="teacher-detail-divider" />
          <h2 className="teacher-student-group-count">
            {selectedClass.students} students / {selectedClass.id === "IS207.R11" ? 9 : selectedClass.groups.length + 5} groups
          </h2>
          <h3>{groupName} · Members</h3>
          <div className="teacher-roster-list">
            {members.slice(0, selectedGroup?.members || 4).map((member) => (
              <div key={member.name}>
                <span>{member.name}</span>
                {member.role === "Group leader" && <small>{member.role}</small>}
              </div>
            ))}
          </div>
          <div className="teacher-class-detail-actions">
            <button className="button" type="button" onClick={() => setDialog("edit-group")}>
              Edit group
            </button>
            <Link className="button" to="/teacher/assignments">
              View assignments
            </Link>
          </div>
        </aside>
      </div>

      {dialog === "members" && (
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
      {dialog === "edit-group" && (
        <Dialog title="Edit group" onClose={() => setDialog(null)}>
          <div className="teacher-manage-dialog">
            <p className="tiny muted">{selectedClass.id} · {selectedGroup?.members || 4} students</p>
            <label className="teacher-field">
              <span>GROUP NAME</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            </label>
            <button className="button primary" type="button" onClick={() => setDialog(null)}>Save group</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
