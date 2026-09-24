import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/ui";
import { adminActivity, adminClasses, adminProblems, adminUsers, type AdminUser } from "../../data/adminDemoData";

function PageIntro({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <div className="admin-page-intro"><div><h1>{title}</h1><p>{sub}</p></div>{children && <div className="admin-page-actions">{children}</div>}</div>;
}

function Split({ main, side }: { main: ReactNode; side: ReactNode }) {
  return <div className="admin-split"><section className="admin-primary">{main}</section><aside className="admin-side">{side}</aside></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="admin-notice" role="status">{children}</p>;
}

function AddUserDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (user: AdminUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("Student");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onAdd({ name: name.trim(), email: email.trim(), role, status: "Active", lastActive: "Never", joined: "Sep 23, 2026", detail: "New demo account" });
  }
  return <Dialog title="Add user" onClose={onClose} className="admin-dialog"><form onSubmit={submit} className="admin-dialog-form">
    <Field label="NAME"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
    <Field label="EMAIL"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.edu" /></Field>
    <Field label="ROLE"><select value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
    <div className="admin-dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary">Add user</button></div>
  </form></Dialog>;
}

export function AdminUsersPage() {
  const [users, setUsers] = useState(adminUsers);
  const [selectedEmail, setSelectedEmail] = useState(adminUsers[0].email);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = users.find((user) => user.email === selectedEmail) || users[0];
  const filtered = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "All roles" || user.role === roleFilter) && (statusFilter === "All statuses" || user.status === statusFilter);
  }), [users, query, roleFilter, statusFilter]);
  function exportCsv() {
    const csv = ["Name,Email,Role,Status", ...users.map((u) => [u.name, u.email, u.role, u.status].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "querylab-users.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="admin-page">
    <PageIntro title="Users" sub={`People & access / ${users.length === 5 ? "1,248" : (1243 + users.length).toLocaleString()} accounts`}>
      <button className="button admin-button" onClick={exportCsv}>Export CSV</button><button className="button primary admin-button" onClick={() => setDialog(true)}>Add user</button>
    </PageIntro>
    <div className="admin-pending-banner"><span>2 lecturer registrations are awaiting approval. Lecturer access stays locked until approved.</span><button className="text-button" onClick={() => { setRoleFilter("Lecturer"); setStatusFilter("All statuses"); setNotice("Showing lecturer accounts and registration requests."); }}>Review requests →</button></div>
    <div className="admin-user-filters">
      <Field label="SEARCH"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email..." /></Field>
      <Field label="ROLE"><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option>All roles</option><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
      <Field label="STATUS"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Active</option><option>All statuses</option><option>Inactive</option><option>Pending</option></select></Field>
    </div>
    {notice && <Notice>{notice}</Notice>}
    <Split main={<>
      <div className="admin-table-wrap"><table className="admin-table admin-users-table"><thead><tr><th>NAME / EMAIL</th><th>ROLE</th><th>STATUS</th><th>LAST ACTIVE</th></tr></thead><tbody>
        {filtered.map((user) => <tr key={user.email} className={selectedEmail === user.email ? "is-selected" : ""} onClick={() => setSelectedEmail(user.email)}>
          <td data-label="NAME / EMAIL"><button className="admin-row-link" onClick={() => setSelectedEmail(user.email)}>{user.name}</button><small>{user.email}</small></td><td data-label="ROLE">{user.role}</td><td data-label="STATUS" className={user.status === "Active" ? "admin-success" : ""}>{user.status}</td><td data-label="LAST ACTIVE">{user.lastActive}</td>
        </tr>)}
      </tbody></table></div>
      <p className="admin-table-footer">Showing {filtered.length} of {users.length === 5 ? "1,248" : (1243 + users.length).toLocaleString()} accounts</p>
    </>} side={selected ? <>
      <h2>Account details</h2><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label="ROLE"><select value={selected.role} onChange={(e) => setUsers((all) => all.map((u) => u.email === selected.email ? { ...u, role: e.target.value as AdminUser["role"] } : u))}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
      <p className={selected.status === "Active" ? "admin-success admin-detail-status" : "admin-warning admin-detail-status"}>{selected.status} · Joined {selected.joined}</p><p className="admin-muted">{selected.detail}</p>
      <div className="admin-button-stack"><button className="button admin-button" onClick={() => setNotice(`Edit account is ready for ${selected.name}.`)}>Edit account</button><button className="button admin-button" onClick={() => setNotice(`A demo access reset was prepared for ${selected.email}.`)}>Reset access</button></div>
      <div className="admin-detail-divider" /><button className="admin-danger-link" onClick={() => setUsers((all) => all.map((u) => u.email === selected.email ? { ...u, status: u.status === "Inactive" ? "Active" : "Inactive" } : u))}>{selected.status === "Inactive" ? "Reactivate account" : "Deactivate account"}</button><p className="admin-muted">Blocks future sign-in. Existing classes and submissions are retained.</p>
    </> : <><h2>Account details</h2><p className="admin-muted">Select an account to review its access.</p></>} />
    {dialog && <AddUserDialog onClose={() => setDialog(false)} onAdd={(user) => { setUsers((all) => [...all, user]); setSelectedEmail(user.email); setDialog(false); setNotice(`${user.name} was added to the demo account list.`); }} />}
  </div>;
}

const capabilities = [
  ["Run & submit assigned SQL", "Allowed", "Allowed", "—"],
  ["Create and publish problems", "—", "Own problems", "Moderate"],
  ["Assign work & manage groups", "—", "Own classes", "All classes"],
  ["Review and adjust grades", "—", "Own classes", "—"],
  ["Manage accounts & roles", "—", "—", "Allowed"],
  ["Configure courses & terms", "—", "—", "Allowed"],
];
export function AdminRolesPage() {
  const [selectedRole, setSelectedRole] = useState("Lecturer");
  const [notice, setNotice] = useState("");
  const roleInfo = selectedRole === "Student"
    ? { title: "Learning access", description: "Run and submit SQL for assigned work, and practice from the shared problem library.", classAccess: "Assigned classes only", problemAccess: "Published problems only" }
    : selectedRole === "Admin"
      ? { title: "System access", description: "Manage accounts, courses, classes, moderation, and platform activity.", classAccess: "All classes", problemAccess: "All problems" }
      : { title: "Teaching access", description: "Create problems, assign work and review results in assigned classes.", classAccess: "Assigned classes only", problemAccess: "Own problems + shared library" };
  return <div className="admin-page">
    <PageIntro title="Roles & permissions" sub="Access policy / Three clear roles"><button className="button primary admin-button" onClick={() => setNotice("Role permissions saved in this demo session.")}>Save changes</button></PageIntro>
    {notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-permissions-table"><thead><tr><th>CAPABILITY</th><th>STUDENT</th><th>LECTURER</th><th>ADMIN</th></tr></thead><tbody>{capabilities.map((row) => <tr key={row[0]}><td data-label="CAPABILITY">{row[0]}</td>{row.slice(1).map((value, index) => { const role = ["Student", "Lecturer", "Admin"][index]; return <td data-label={role.toUpperCase()} key={index}><button className={selectedRole === role ? "admin-cell-selected" : "admin-cell-button"} onClick={() => setSelectedRole(role)}>{value}</button></td>; })}</tr>)}</tbody></table></div>} side={<>
      <div className="admin-role-tabs">{["Student", "Lecturer", "Admin"].map((role) => <button key={role} className={selectedRole === role ? "active" : ""} onClick={() => setSelectedRole(role)}>{role}</button>)}</div>
      <h3 className="admin-detail-title">{roleInfo.title}</h3><p className="admin-muted">{roleInfo.description}</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Scope</h3>
      <Field label="CLASS ACCESS"><select defaultValue={roleInfo.classAccess}><option>Assigned classes only</option><option>All classes</option><option>No class access</option></select></Field>
      <Field label="PROBLEM ACCESS"><select defaultValue={roleInfo.problemAccess}><option>Own problems + shared library</option><option>Published problems only</option><option>All problems</option></select></Field>
      <p className="admin-muted">Student submissions remain linked to their original author.</p>
    </>} />
  </div>;
}

function CourseDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string, course: string) => void }) {
  const [course, setCourse] = useState("IS207 · Web Development");
  const [id, setId] = useState("");
  return <Dialog title="Create class" onClose={onClose} className="admin-dialog"><form className="admin-dialog-form" onSubmit={(e) => { e.preventDefault(); if (id.trim()) onCreate(id.trim(), course); }}>
    <Field label="COURSE"><select value={course} onChange={(e) => setCourse(e.target.value)}><option>IS207 · Web Development</option><option>IS336 · ERP Planning</option><option>New course</option></select></Field>
    <Field label="CLASS ID"><input autoFocus value={id} onChange={(e) => setId(e.target.value)} placeholder="IS207.R14" /></Field>
    <div className="admin-dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary">Create class</button></div>
  </form></Dialog>;
}

export function AdminCoursesPage() {
  const [classes, setClasses] = useState(adminClasses);
  const [selectedId, setSelectedId] = useState("IS207.R12");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = classes.find((item) => item.id === selectedId) || classes[0];
  const visible = classes.filter((item) => `${item.course} ${item.id} ${item.lecturer}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="admin-page">
    <PageIntro title="Courses & classes" sub="Academic structure / Fall 2026"><button className="button admin-button" onClick={() => setDialog(true)}>Add class</button><button className="button primary admin-button" onClick={() => setNotice("Course creation is available in the demo setup.")}>Create course</button></PageIntro>
    <div className="admin-course-filters"><Field label="SEMESTER"><select defaultValue="Fall 2026"><option>Fall 2026</option><option>Spring 2027</option></select></Field><Field label="SEARCH"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course or class..." /></Field></div>{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-course-table"><thead><tr><th>COURSE / CLASS</th><th>LECTURER</th><th>STUDENTS</th><th>STATUS</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><td data-label="COURSE / CLASS"><button className="admin-row-link" onClick={() => setSelectedId(item.id)}>{item.course}</button><small>{item.id}</small></td><td data-label="LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STUDENTS">{item.students}</td><td data-label="STATUS" className={item.status === "Active" ? "admin-success" : "admin-warning"}>{item.status}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>{selected.id}</h2><h3 className="admin-detail-title">{selected.course.split(" · ")[1]}</h3><p className={selected.status === "Active" ? "admin-success" : "admin-warning"}>{selected.status}{selected.lecturer === "Unassigned" ? " · Lecturer needed" : ""}</p><div className="admin-detail-divider" />
      <Field label="SEMESTER"><select defaultValue="Fall 2026"><option>Fall 2026</option><option>Spring 2027</option></select></Field><Field label="CLASS DATES"><input defaultValue={selected.dates} /></Field><p className="admin-muted">{selected.students} enrolled students</p>
      <div className="admin-button-stack"><Link className="button primary admin-button" to="/admin/lecturers">Assign lecturer</Link><button className="button admin-button" onClick={() => setNotice(`Editing ${selected.id} is ready for this demo.`)}>Edit class</button></div><div className="admin-detail-divider" /><button className="admin-danger-link" onClick={() => { setClasses((all) => all.map((item) => item.id === selected.id ? { ...item, status: item.status === "Archived" ? "Active" : "Archived" } : item)); setNotice(`${selected.id} archive status updated.`); }}>{selected.status === "Archived" ? "Restore class" : "Archive class"}</button>
    </> : <h2>Class details</h2>} />
    {dialog && <CourseDialog onClose={() => setDialog(false)} onCreate={(id, course) => { const item = { id, course, lecturer: "Unassigned", students: 0, status: "Draft", dates: "Sep 07 – Nov 28, 2026" }; setClasses((all) => [...all, item]); setSelectedId(id); setDialog(false); setNotice(`${id} was added as a draft class.`); }} />}
  </div>;
}

export function AdminLecturersPage() {
  const [assignments, setAssignments] = useState(adminClasses);
  const [selectedId, setSelectedId] = useState("IS207.R12");
  const [lecturer, setLecturer] = useState("Huy Lai");
  const [notice, setNotice] = useState("");
  const selected = assignments.find((item) => item.id === selectedId) || assignments[0];
  return <div className="admin-page">
    <PageIntro title="Lecturer assignment" sub="Class ownership / Fall 2026"><button className="button primary admin-button" onClick={() => { setAssignments((all) => all.map((item) => item.id === selectedId ? { ...item, lecturer } : item)); setNotice(`${lecturer} assigned to ${selectedId}.`); }}>Save assignment</button></PageIntro>{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-lecturer-table"><thead><tr><th>CLASS</th><th>CURRENT LECTURER</th><th>EFFECTIVE</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setLecturer(item.lecturer === "Unassigned" ? "Huy Lai" : item.lecturer); }}><td data-label="CLASS"><b>{item.id}</b></td><td data-label="CURRENT LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="EFFECTIVE">{item.lecturer === "Unassigned" ? "Not set" : "Sep 07, 2026"}</td></tr>)}</tbody></table></div>} side={<>
      <h2>Assign {selected.id}</h2><p className="admin-muted">{selected.course.split(" · ")[1]} · {selected.students} students</p><Field label="LECTURER"><select value={lecturer} onChange={(e) => setLecturer(e.target.value)}><option>Huy Lai</option><option>Minh Nguyen</option><option>Unassigned</option></select></Field><Field label="EFFECTIVE DATE"><input type="text" defaultValue="Sep 21, 2026" /></Field><Field label="NOTE"><textarea defaultValue="Primary lecturer for Fall 2026" /></Field><div className="admin-detail-divider" /><h3 className="admin-subheading">Access preview</h3><p className="admin-muted">{lecturer} can manage assignments, view class results and review student submissions from the effective date.</p>
    </>} />
  </div>;
}

export function AdminModerationPage() {
  const [problems, setProblems] = useState(adminProblems);
  const [selectedTitle, setSelectedTitle] = useState(adminProblems[0].title);
  const [note, setNote] = useState("Clear statement and valid test cases.");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = problems.find((problem) => problem.title === selectedTitle) || problems[0];
  const list = problems.filter((problem) => !publishedOnly || problem.status === "Published");
  function review(status: string) {
    setProblems((all) => all.map((problem) => problem.title === selected.title ? { ...problem, status } : problem));
    setNotice(`${selected.title}: ${status.toLowerCase()}.`);
  }
  return <div className="admin-page">
    <PageIntro title="Problem moderation" sub="Public library / Review queue"><button className="button primary admin-button" onClick={() => setPublishedOnly((value) => !value)}>{publishedOnly ? "View review queue" : "View published"}</button></PageIntro>{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-moderation-table"><thead><tr><th>PROBLEM</th><th>AUTHOR</th><th>STATUS</th></tr></thead><tbody>{list.map((problem) => <tr key={problem.title} className={problem.title === selectedTitle ? "is-selected" : ""} onClick={() => setSelectedTitle(problem.title)}><td data-label="PROBLEM"><button className="admin-row-link" onClick={() => setSelectedTitle(problem.title)}>{problem.title}</button></td><td data-label="AUTHOR">{problem.author}</td><td data-label="STATUS" className={problem.status === "Published" ? "admin-success" : "admin-warning"}>{problem.status}</td></tr>)}</tbody></table></div>} side={<>
      <p className="admin-overline">Review problem</p><h2 className="admin-detail-title admin-problem-title">{selected.title}</h2><p className="admin-muted">{selected.author} · Submitted {selected.submitted}</p><p className="admin-accent">{selected.difficulty} · {selected.topics}</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Validation</h3><ul className="admin-validation-list"><li>{selected.schema}</li><li>{selected.reference}</li><li>{selected.expected}</li></ul><Field label="REVIEW NOTE"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field><div className="admin-button-stack"><button className="button admin-button" onClick={() => setNotice(`Preview opened for ${selected.title}.`)}>Preview problem</button><button className="button primary admin-button" onClick={() => review("Published")}>Approve publication</button><button className="admin-warning-link" onClick={() => review("Changes requested")}>Request changes</button></div>
    </>} />
  </div>;
}

export function AdminOverviewPage() {
  const [notice, setNotice] = useState("");
  return <div className="admin-page">
    <PageIntro title="System overview" sub="Sep 18, 2026 / Activity & service health"><button className="button primary admin-button" onClick={() => setNotice("Recent activity view is current through 14:42 today.")}>View activity</button></PageIntro>{notice && <Notice>{notice}</Notice>}
    <div className="admin-metrics"><div><strong>1,248</strong><small>Total users</small></div><div><strong>36</strong><small>Active classes</small></div><div><strong>421</strong><small>Submissions today</small></div><div><strong className="admin-warning">2</strong><small>Grading errors</small></div></div>
    <Split main={<><h2 className="admin-section-heading">Recent activity</h2><table className="admin-table admin-activity-table"><thead><tr><th>ACTION</th><th>BY</th><th>TIME</th></tr></thead><tbody>{adminActivity.map((item) => <tr key={item.action}><td>{item.action}</td><td>{item.by}</td><td>{item.time}</td></tr>)}</tbody></table></>} side={<>
      <h2>Grading health</h2><p className="admin-health">Operational</p><p className="admin-muted">419 graded / 2 need attention</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Recent errors</h3><p className="admin-warning admin-error">#104 · Execution timeout<br />Revenue by category</p><p className="admin-warning admin-error">#1051 · Database unavailable<br />Top customers</p><Link className="button admin-button" to="/admin/moderation">Review errors</Link>
    </>} />
  </div>;
}
