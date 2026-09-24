import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  adminActivity,
  adminPracticeTopics,
  readAdminLecturerRequests,
  readAdminClasses,
  readAdminPracticeProblems,
  readAdminRolePolicy,
  readAdminUsers,
  saveAdminClasses,
  saveAdminLecturerRequests,
  saveAdminPracticeProblems,
  saveAdminRolePolicy,
  saveAdminUsers,
  adminCapabilities,
  defaultAdminRolePolicy,
  type AdminClass,
  type AdminLecturerRequest,
  type AdminPracticeProblem,
  type AdminRoleName,
  type AdminRolePolicy,
  type AdminUser,
} from "../../data/adminDemoData";

function PageIntro({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <div className="admin-page-intro"><div><h1>{title}</h1><p>{sub}</p></div>{children && <div className="admin-page-actions">{children}</div>}</div>;
}

function Split({ main, side, className = "" }: { main: ReactNode; side: ReactNode; className?: string }) {
  return <div className={`admin-split ${className}`}><section className="admin-primary">{main}</section><aside className="admin-side">{side}</aside></div>;
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
  const location = useLocation();
  const [users, setUsers] = useState(readAdminUsers);
  const [selectedEmail, setSelectedEmail] = useState(() => readAdminUsers()[0]?.email || "");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const pendingRequestCount = readAdminLecturerRequests().length;
  const selected = users.find((user) => user.email === selectedEmail) || users[0];
  useEffect(() => saveAdminUsers(users), [users]);
  useEffect(() => {
    const state = location.state as { selectedEmail?: string; notice?: string } | null;
    if (state?.selectedEmail) setSelectedEmail(state.selectedEmail);
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state]);
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
    {pendingRequestCount > 0 && <div className="admin-pending-banner"><span>{pendingRequestCount} lecturer registrations are awaiting approval. Lecturer access stays locked until approved.</span><Link className="text-button" to="/admin/users/approvals">Review requests →</Link></div>}
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
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/users/${encodeURIComponent(selected.email)}/edit`}>Edit account</Link></div>
      <div className="admin-detail-divider" /><button className="admin-danger-link" onClick={() => setUsers((all) => all.map((u) => u.email === selected.email ? { ...u, status: u.status === "Inactive" ? "Active" : "Inactive" } : u))}>{selected.status === "Inactive" ? "Reactivate account" : "Deactivate account"}</button><p className="admin-muted">Blocks future sign-in. Existing classes and submissions are retained.</p>
    </> : <><h2>Account details</h2><p className="admin-muted">Select an account to review its access.</p></>} />
    {dialog && <AddUserDialog onClose={() => setDialog(false)} onAdd={(user) => { setUsers((all) => [...all, user]); setSelectedEmail(user.email); setDialog(false); setNotice(`${user.name} was added to the demo account list.`); }} />}
  </div>;
}

export function AdminEditAccountPage() {
  const { email: encodedEmail = "" } = useParams();
  const email = decodeURIComponent(encodedEmail);
  const navigate = useNavigate();
  const user = readAdminUsers().find((account) => account.email === email);
  const [name, setName] = useState(user?.name ?? "");
  const [accountEmail, setAccountEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<AdminUser["role"]>(user?.role ?? "Student");
  const [status, setStatus] = useState<AdminUser["status"]>(user?.status ?? "Active");
  const [notice, setNotice] = useState("");

  if (!user) return <div className="admin-page"><PageIntro title="Account not found" sub="People & access" /><p className="admin-muted">This account may have been removed or its email has changed.</p><Link className="button admin-button" to="/admin/users">Back to users</Link></div>;
  const currentUser = user;

  function save(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    const nextEmail = accountEmail.trim().toLowerCase();
    if (!nextName || !nextEmail) { setNotice("Name and email are required."); return; }
    const users = readAdminUsers();
    if (nextEmail !== currentUser.email && users.some((account) => account.email.toLowerCase() === nextEmail)) { setNotice("An account with this email already exists."); return; }
    saveAdminUsers(users.map((account) => account.email === currentUser.email ? { ...account, name: nextName, email: nextEmail, role, status } : account));
    navigate("/admin/users", { state: { selectedEmail: nextEmail, notice: `Account updated for ${nextName}.` } });
  }

  function resetAccess() {
    setNotice(`A demo access reset was prepared for ${currentUser.email}. No email was sent.`);
  }

  return <div className="admin-page">
    <PageIntro title="Edit account" sub={`People & access / ${currentUser.name}`}><Link className="button admin-button" to="/admin/users">Back to users</Link></PageIntro>
    <div className="admin-edit-layout">
      <form className="admin-edit-form" onSubmit={save}>
        <h2>Account information</h2>
        <p className="admin-muted">Update this user’s profile, role, and sign-in status.</p>
        <Field label="FULL NAME"><input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="EMAIL ADDRESS"><input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} required /></Field>
        <Field label="ROLE"><select value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
        <Field label="ACCOUNT STATUS"><select value={status} onChange={(event) => setStatus(event.target.value as AdminUser["status"])}><option>Active</option><option>Inactive</option><option>Pending</option></select></Field>
        {notice && <Notice>{notice}</Notice>}
        <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/users">Cancel</Link><button className="button primary admin-button">Save changes</button></div>
      </form>
      <aside className="admin-edit-access"><h2>Access management</h2><p className="admin-muted">Prepare an access reset for this account. In this demo, no email is sent.</p><p><strong>{currentUser.email}</strong></p><button type="button" className="button admin-button" onClick={resetAccess}>Reset access</button></aside>
    </div>
  </div>;
}

function RejectLecturerDialog({
  request,
  onClose,
  onReject,
}: {
  request: AdminLecturerRequest;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return <Dialog title="Reject lecturer request" onClose={onClose} className="admin-reject-dialog">
    <form className="admin-dialog-form" onSubmit={(event) => { event.preventDefault(); onReject(reason.trim()); }}>
      <p className="admin-muted">{request.name} · {request.email}</p>
      <Field label="REASON (OPTIONAL, SENT TO APPLICANT)">
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this request was declined…" />
      </Field>
      <div className="admin-dialog-actions">
        <button type="button" className="button admin-button" onClick={onClose}>Cancel</button>
        <button className="button admin-button admin-reject-button">Reject request</button>
      </div>
    </form>
  </Dialog>;
}

export function AdminLecturerApprovalsPage() {
  const [requests, setRequests] = useState(readAdminLecturerRequests);
  const [selectedEmail, setSelectedEmail] = useState(() => readAdminLecturerRequests()[0]?.email || "");
  const [rejecting, setRejecting] = useState<AdminLecturerRequest | null>(null);
  const [notice, setNotice] = useState("");
  const selected = requests.find((request) => request.email === selectedEmail) || requests[0];

  function resolveRequest(request: AdminLecturerRequest, approved: boolean, reason = "") {
    const next = requests.filter((item) => item.email !== request.email);
    setRequests(next);
    setSelectedEmail(next[0]?.email || "");
    saveAdminLecturerRequests(next);
    if (approved && !readAdminUsers().some((user) => user.email === request.email)) {
      saveAdminUsers([...readAdminUsers(), {
        name: request.name,
        email: request.email,
        role: "Lecturer",
        status: "Active",
        lastActive: "Never",
        joined: request.submitted,
        detail: `Teaching access approved for ${request.department}`,
      }]);
    }
    setRejecting(null);
    setNotice(approved
      ? `${request.name} was approved as a lecturer in this demo.`
      : `${request.name}'s request was rejected in this demo.${reason ? ` Reason sent: ${reason}` : ""}`);
  }

  return <div className="admin-page">
    <PageIntro title="Users" sub={`People & access / ${requests.length} pending lecturer requests`} />
    <div className="admin-section-tabs">
      <Link to="/admin/users">All users</Link>
      <Link className="active" to="/admin/users/approvals">Lecturer approvals ({requests.length})</Link>
    </div>
    {notice && <Notice>{notice}</Notice>}
    <Split main={<>
      <div className="admin-table-wrap"><table className="admin-table admin-approval-table"><thead><tr><th>NAME / EMAIL</th><th>DEPARTMENT</th><th>SUBMITTED</th><th>STATUS</th></tr></thead><tbody>
        {requests.map((request) => <tr key={request.email} className={request.email === selected?.email ? "is-selected" : ""} onClick={() => setSelectedEmail(request.email)}>
          <td data-label="NAME / EMAIL"><button className="admin-row-link" type="button" onClick={() => setSelectedEmail(request.email)}>{request.name}</button><small>{request.email}</small></td>
          <td data-label="DEPARTMENT">{request.department}</td><td data-label="SUBMITTED">{request.submitted}</td><td data-label="STATUS" className="admin-warning">Pending</td>
        </tr>)}
        {!requests.length && <tr><td colSpan={4} className="admin-muted">No lecturer registrations are waiting for approval.</td></tr>}
      </tbody></table></div>
      <p className="admin-table-footer">Showing {requests.length} pending requests</p>
    </>} side={selected ? <>
      <h2>Request details</h2><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label="DEPARTMENT"><input value={selected.department} readOnly /></Field>
      <p className="admin-warning admin-detail-status">Pending · Submitted {selected.submitted}</p>
      <p className="admin-muted">Registered as Lecturer<br />Lecturer access stays locked until approved.</p>
      <button className="button primary admin-button" type="button" onClick={() => resolveRequest(selected, true)}>Approve lecturer</button>
      <div className="admin-detail-divider" />
      <button className="admin-danger-link" type="button" onClick={() => setRejecting(selected)}>Reject request</button>
      <p className="admin-muted">Opens a reason form. The applicant is notified and lecturer access stays locked.</p>
    </> : <><h2>Request details</h2><p className="admin-muted">There are no pending lecturer requests.</p></>} />
    {rejecting && <RejectLecturerDialog request={rejecting} onClose={() => setRejecting(null)} onReject={(reason) => resolveRequest(rejecting, false, reason)} />}
  </div>;
}

export function AdminRolesPage() {
  const [selectedRole, setSelectedRole] = useState<AdminRoleName>("Lecturer");
  const [policy, setPolicy] = useState(readAdminRolePolicy);
  const [notice, setNotice] = useState("");
  const roleInfo: Record<AdminRoleName, { title: string; description: string }> = {
    Student: { title: "Learning access", description: "Run and submit SQL for assigned work, and practice from the shared problem library." },
    Lecturer: { title: "Teaching access", description: "Create problems, assign work and review results in assigned classes." },
    Admin: { title: "System access", description: "Manage accounts, courses, classes, the Practice catalog, and platform activity." },
  };
  const enabledCount = adminCapabilities.filter(({ key }) => policy.permissions[key]?.[selectedRole]).length;
  function togglePermission(role: AdminRoleName, key: string) {
    if (role === "Admin" && key === "manageAccounts") return;
    setPolicy((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: { ...current.permissions[key], [role]: !current.permissions[key][role] },
      },
    }));
  }
  function updateScope<K extends keyof AdminRolePolicy["scopes"][AdminRoleName]>(field: K, value: AdminRolePolicy["scopes"][AdminRoleName][K]) {
    setPolicy((current) => ({
      ...current,
      scopes: { ...current.scopes, [selectedRole]: { ...current.scopes[selectedRole], [field]: value } },
    }));
  }
  function resetRole() {
    setPolicy((current) => ({
      permissions: Object.fromEntries(adminCapabilities.map(({ key }) => [key, {
        ...current.permissions[key], [selectedRole]: defaultAdminRolePolicy.permissions[key][selectedRole],
      }])) as AdminRolePolicy["permissions"],
      scopes: { ...current.scopes, [selectedRole]: { ...defaultAdminRolePolicy.scopes[selectedRole] } },
    }));
    setNotice(`${selectedRole} defaults restored. Save changes to apply them.`);
  }
  return <div className="admin-page">
    <PageIntro title="Roles & permissions" sub="Access policy / Three clear roles"><button type="button" className="button admin-button" onClick={resetRole}>Restore defaults</button><button className="button primary admin-button" onClick={() => { saveAdminRolePolicy(policy); setNotice("Role permissions saved."); }}>Save changes</button></PageIntro>
    {notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-permissions-table"><thead><tr><th>CAPABILITY</th><th>STUDENT</th><th>LECTURER</th><th>ADMIN</th></tr></thead><tbody>{adminCapabilities.map(({ key, label }) => <tr key={key}><td data-label="CAPABILITY">{label}</td>{(["Student", "Lecturer", "Admin"] as const).map((role) => {
      const enabled = policy.permissions[key]?.[role] ?? false;
      const required = role === "Admin" && key === "manageAccounts";
      return <td data-label={role.toUpperCase()} key={role}><button type="button" aria-pressed={enabled} aria-label={`${role}: ${label} ${enabled ? "enabled" : "disabled"}`} disabled={required} className={`${selectedRole === role ? "admin-cell-selected" : "admin-cell-button"}${enabled ? " is-enabled" : ""}`} onClick={() => { setSelectedRole(role); togglePermission(role, key); }}>{required ? "Required" : enabled ? "Allowed" : "—"}</button></td>;
    })}</tr>)}</tbody></table></div>} side={<>
      <div className="admin-role-tabs">{(["Student", "Lecturer", "Admin"] as const).map((role) => <button type="button" key={role} className={selectedRole === role ? "active" : ""} onClick={() => setSelectedRole(role)}>{role}</button>)}</div>
      <h3 className="admin-detail-title">{roleInfo[selectedRole].title}</h3><p className="admin-muted">{roleInfo[selectedRole].description}</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Effective access</h3>
      <p className="admin-role-summary">{enabledCount} of {adminCapabilities.length} capabilities enabled</p>
      <Field label="CLASS ACCESS"><select value={policy.scopes[selectedRole].classAccess} onChange={(event) => updateScope("classAccess", event.target.value as AdminRolePolicy["scopes"][AdminRoleName]["classAccess"])}><option>Assigned classes only</option><option>All classes</option><option>No class access</option></select></Field>
      <Field label="PROBLEM ACCESS"><select value={policy.scopes[selectedRole].problemAccess} onChange={(event) => updateScope("problemAccess", event.target.value as AdminRolePolicy["scopes"][AdminRoleName]["problemAccess"])}><option>Own problems + shared library</option><option>Published problems only</option><option>All problems</option></select></Field>
      <p className="admin-muted">Policy changes apply to every account with this role. Existing submissions remain linked to their original author.</p>
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
  const location = useLocation();
  const [classes, setClasses] = useState(readAdminClasses);
  const [selectedId, setSelectedId] = useState("IS207.R12");
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState("All semesters");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = classes.find((item) => item.id === selectedId) || classes[0];
  useEffect(() => saveAdminClasses(classes), [classes]);
  useEffect(() => {
    const state = location.state as { selectedId?: string; notice?: string } | null;
    if (state?.selectedId) setSelectedId(state.selectedId);
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state]);
  const visible = classes.filter((item) =>
    `${item.course} ${item.id} ${item.lecturer}`.toLowerCase().includes(query.toLowerCase()) &&
    (semester === "All semesters" || item.semester === semester));
  return <div className="admin-page">
    <PageIntro title="Courses & classes" sub="Academic structure / Manage class rosters and access"><button className="button primary admin-button" onClick={() => setDialog(true)}>Add class</button></PageIntro>
    <div className="admin-course-filters"><Field label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}><option>All semesters</option><option>Semester 1, 2025</option><option>Semester 2, 2026</option></select></Field><Field label="SEARCH"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course or class..." /></Field></div>{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-course-table"><thead><tr><th>COURSE / CLASS</th><th>LECTURER</th><th>STUDENTS</th><th>STATUS</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><td data-label="COURSE / CLASS"><button className="admin-row-link" onClick={() => setSelectedId(item.id)}>{item.course}</button><small>{item.id}</small></td><td data-label="LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STUDENTS">{item.students}</td><td data-label="STATUS" className={item.status === "Active" ? "admin-success" : "admin-warning"}>{item.status}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>{selected.id}</h2><h3 className="admin-detail-title">{selected.course.split(" · ")[1]}</h3><p className={selected.status === "Active" ? "admin-success" : "admin-warning"}>{selected.status}{selected.lecturer === "Unassigned" ? " · Lecturer needed" : ""}</p><div className="admin-detail-divider" />
      <Field label="SEMESTER"><select value={selected.semester} onChange={(event) => setClasses((all) => all.map((item) => item.id === selected.id ? { ...item, semester: event.target.value } : item))}><option>Semester 1, 2025</option><option>Semester 2, 2026</option></select></Field><Field label="CLASS DATES"><input value={selected.dates} onChange={(event) => setClasses((all) => all.map((item) => item.id === selected.id ? { ...item, dates: event.target.value } : item))} /></Field><p className="admin-muted">{selected.students} enrolled students</p>
      <div className="admin-button-stack"><Link className="button primary admin-button" to="/admin/courses/lecturers">Assign lecturer</Link><Link className="button admin-button" to={`/admin/courses/classes/${encodeURIComponent(selected.id)}/edit`}>Edit class</Link></div><div className="admin-detail-divider" /><button className="admin-danger-link" onClick={() => { const status: AdminClass["status"] = selected.status === "Archived" ? "Active" : "Archived"; setClasses((all) => all.map((item) => item.id === selected.id ? { ...item, status } : item)); setNotice(`${selected.id} ${status === "Archived" ? "archived" : "restored"}.`); }}>{selected.status === "Archived" ? "Restore class" : "Archive class"}</button>
    </> : <h2>Class details</h2>} />
    {dialog && <CourseDialog onClose={() => setDialog(false)} onCreate={(id, course) => {
      if (classes.some((item) => item.id.toLowerCase() === id.toLowerCase())) { setDialog(false); setNotice(`A class with ID ${id} already exists.`); return; }
      const item: AdminClass = { id, course, lecturer: "Unassigned", students: 0, status: "Draft", semester: "Semester 2, 2026", dates: "Sep 07 – Nov 28, 2026" };
      setClasses((all) => [...all, item]); setSelectedId(id); setDialog(false); setNotice(`${id} was added as a draft class.`);
    }} />}
  </div>;
}

export function AdminEditClassPage() {
  const { classId: routeId = "" } = useParams();
  const classId = decodeURIComponent(routeId);
  const navigate = useNavigate();
  const record = readAdminClasses().find((item) => item.id === classId);
  const [course, setCourse] = useState(record?.course ?? "IS207 · Web Development");
  const [semester, setSemester] = useState(record?.semester ?? "Semester 2, 2026");
  const [dates, setDates] = useState(record?.dates ?? "");
  const [lecturer, setLecturer] = useState(record?.lecturer ?? "Unassigned");
  const [status, setStatus] = useState<AdminClass["status"]>(record?.status ?? "Draft");
  const [notice, setNotice] = useState("");
  const lecturers = readAdminUsers().filter((user) => user.role === "Lecturer").map((user) => user.name);

  if (!record) return <div className="admin-page"><PageIntro title="Class not found" sub="Courses & classes" /><p className="admin-muted">This class may have been removed.</p><Link className="button admin-button" to="/admin/courses">Back to courses</Link></div>;
  const currentRecord = record;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!dates.trim()) { setNotice("Class dates are required."); return; }
    const next = readAdminClasses().map((item) => item.id === currentRecord.id
      ? { ...item, course, semester, dates: dates.trim(), lecturer, status }
      : item);
    saveAdminClasses(next);
    navigate("/admin/courses", { state: { selectedId: currentRecord.id, notice: `${currentRecord.id} class details saved.` } });
  }

  return <div className="admin-page">
    <PageIntro title="Edit class" sub={`Courses & classes / ${currentRecord.id}`}><Link className="button admin-button" to="/admin/courses">Back to courses</Link></PageIntro>
    <form className="admin-edit-form admin-class-form" onSubmit={save}>
      <h2>Class details</h2><p className="admin-muted">Update the course, term, instructor, and enrollment status for this class.</p>
      <Field label="CLASS ID"><input value={currentRecord.id} readOnly /><small className="admin-muted">Class IDs stay fixed so existing student work keeps its link.</small></Field>
      <Field label="COURSE"><select value={course} onChange={(event) => setCourse(event.target.value)}><option>IS207 · Web Development</option><option>IS336 · ERP Planning</option></select></Field>
      <Field label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}><option>Semester 1, 2025</option><option>Semester 2, 2026</option></select></Field>
      <Field label="LECTURER"><select value={lecturer} onChange={(event) => setLecturer(event.target.value)}><option>Unassigned</option>{Array.from(new Set([...lecturers, record.lecturer].filter((name) => name !== "Unassigned"))).map((name) => <option key={name}>{name}</option>)}</select></Field>
      <Field label="CLASS STATUS"><select value={status} onChange={(event) => setStatus(event.target.value as AdminClass["status"])}><option>Draft</option><option>Active</option><option>Archived</option></select></Field>
      <Field label="CLASS DATES"><input value={dates} onChange={(event) => setDates(event.target.value)} placeholder="Sep 07 – Nov 28, 2026" required /></Field>
      <p className="admin-muted">{currentRecord.students} enrolled students. Archiving keeps rosters and submissions available to admins.</p>
      {notice && <Notice>{notice}</Notice>}
      <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/courses">Cancel</Link><button className="button primary admin-button">Save class</button></div>
    </form>
  </div>;
}

export function AdminLecturersPage() {
  const [assignments, setAssignments] = useState(() => [...readAdminClasses()].sort((a, b) => Number(b.lecturer === "Unassigned") - Number(a.lecturer === "Unassigned")));
  const [selectedId, setSelectedId] = useState("IS207.R12");
  const [lecturer, setLecturer] = useState("Huy Lai");
  const [notice, setNotice] = useState("");
  const selected = assignments.find((item) => item.id === selectedId) || assignments[0];
  const lecturers = readAdminUsers().filter((user) => user.role === "Lecturer").map((user) => user.name);
  useEffect(() => saveAdminClasses(assignments), [assignments]);
  return <div className="admin-page">
    <PageIntro title="Lecturer assignment" sub={`Class ownership / ${selected.semester}`}><button className="button primary admin-button" onClick={() => { setAssignments((all) => all.map((item) => item.id === selectedId ? { ...item, lecturer } : item)); setNotice(`${lecturer} assigned to ${selectedId}.`); }}>Save assignment</button></PageIntro>{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-lecturer-table"><thead><tr><th>CLASS</th><th>CURRENT LECTURER</th><th>EFFECTIVE</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setLecturer(item.lecturer === "Unassigned" ? "Huy Lai" : item.lecturer); }}><td data-label="CLASS"><b>{item.id}</b></td><td data-label="CURRENT LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="EFFECTIVE">{item.lecturer === "Unassigned" ? "Not set" : "Sep 07, 2026"}</td></tr>)}</tbody></table></div>} side={<>
      <h2>Assign {selected.id}</h2><p className="admin-muted">{selected.course.split(" · ")[1]} · {selected.semester} · {selected.students} students</p><Field label="LECTURER"><select value={lecturer} onChange={(e) => setLecturer(e.target.value)}>{Array.from(new Set([...lecturers, "Unassigned"])).map((name) => <option key={name}>{name}</option>)}</select></Field><Field label="EFFECTIVE DATE"><input type="text" defaultValue="Sep 21, 2026" /></Field><Field label="NOTE"><textarea defaultValue={`Primary lecturer for ${selected.semester}`} /></Field><div className="admin-detail-divider" /><h3 className="admin-subheading">Access preview</h3><p className="admin-muted">{lecturer} can manage assignments, view class results and review student submissions from the effective date.</p>
    </>} />
  </div>;
}

function PracticePreviewDialog({ problem, onClose }: { problem: AdminPracticeProblem; onClose: () => void }) {
  const reviewSignal = problem.acceptance < 45
    ? "Low solve rate · consider adding a hint"
    : problem.acceptance > 80
      ? "High solve rate · suitable for an introductory set"
      : "Balanced solve rate";
  return <Dialog title="Student practice preview" onClose={onClose} className="admin-practice-preview">
    <div className="admin-preview-heading"><h3>{problem.title}</h3><p>{problem.difficulty} · {problem.topics} · {problem.database}</p></div>
    <section className="admin-preview-section"><h4>Problem</h4><p>{problem.description}</p><p className="admin-muted">Return columns: <code>{problem.expectedColumns}</code></p></section>
    <section className="admin-preview-section"><h4>Available tables</h4><pre>{problem.schemaPreview}</pre></section>
    <section className="admin-preview-insight"><b>Practice signal</b><span>{reviewSignal}</span><small>{problem.attempted} attempts · {problem.acceptance}% accepted · {problem.hints ? "Hints enabled" : "No hints"} · {problem.comments ? "Comments enabled" : "Comments off"}</small></section>
    <div className="admin-dialog-actions"><button type="button" className="button primary admin-button" onClick={onClose}>Done</button></div>
  </Dialog>;
}

export function AdminPracticeCatalogPage() {
  const [problems, setProblems] = useState(readAdminPracticeProblems);
  const [selectedTitle, setSelectedTitle] = useState(() => readAdminPracticeProblems()[0]?.title || "");
  const [activeTab, setActiveTab] = useState<"Problems" | "Topics">("Problems");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("All levels");
  const [visibility, setVisibility] = useState("All");
  const [notice, setNotice] = useState("");
  const [previewing, setPreviewing] = useState<AdminPracticeProblem | null>(null);
  const selected = problems.find((problem) => problem.title === selectedTitle) || problems[0];
  useEffect(() => saveAdminPracticeProblems(problems), [problems]);
  const list = useMemo(() => problems.filter((problem) =>
    `${problem.title} ${problem.author} ${problem.topics}`.toLowerCase().includes(query.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (visibility === "All" || problem.status === visibility)), [problems, query, difficulty, visibility]);

  function updateSelected(patch: Partial<AdminPracticeProblem>) {
    setProblems((current) => current.map((problem) => problem.title === selected.title ? { ...problem, ...patch } : problem));
  }

  return <div className="admin-page">
    <PageIntro title="Practice catalog" sub="Public problems shown to students / 38 problems" />
    <div className="admin-section-tabs" role="tablist" aria-label="Practice catalog sections">
      <button type="button" role="tab" aria-selected={activeTab === "Problems"} className={activeTab === "Problems" ? "active" : ""} onClick={() => setActiveTab("Problems")}>Problems (38)</button>
      <button type="button" role="tab" aria-selected={activeTab === "Topics"} className={activeTab === "Topics" ? "active" : ""} onClick={() => setActiveTab("Topics")}>Topics (12)</button>
    </div>
    {notice && <Notice>{notice}</Notice>}
    {activeTab === "Problems" && <div className="admin-practice-filters">
      <Field label="SEARCH"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or author..." /></Field>
      <Field label="DIFFICULTY"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All levels</option><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
      <Field label="VISIBILITY"><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>All</option><option>Visible</option><option>Hidden</option></select></Field>
    </div>}
    <Split className="admin-practice-split" main={activeTab === "Problems" ? <div className="admin-table-wrap"><table className="admin-table admin-practice-table"><thead><tr><th>PROBLEM</th><th>TOPICS</th><th>DIFFICULTY</th><th>SOLVED BY</th><th>STATUS</th></tr></thead><tbody>
      {list.map((problem) => <tr key={problem.title} className={problem.title === selected.title ? "is-selected" : ""} onClick={() => setSelectedTitle(problem.title)}>
        <td data-label="PROBLEM"><button className="admin-row-link" type="button" onClick={() => setSelectedTitle(problem.title)}>{problem.title}</button></td><td data-label="TOPICS">{problem.topics}</td><td data-label="DIFFICULTY">{problem.difficulty}</td><td data-label="SOLVED BY">{problem.solvedBy} students</td><td data-label="STATUS" className={problem.status === "Visible" ? "admin-success" : ""}>{problem.status}</td>
      </tr>)}
      {!list.length && <tr><td colSpan={5} className="admin-muted">No practice problems match these filters.</td></tr>}
    </tbody></table></div> : <div className="admin-table-wrap"><table className="admin-table admin-practice-topic-table"><thead><tr><th>TOPIC</th><th>PROBLEMS</th></tr></thead><tbody>{adminPracticeTopics.map((topic) => <tr key={topic.name} onClick={() => { setQuery(topic.name); setActiveTab("Problems"); }}><td data-label="TOPIC"><button className="admin-row-link" type="button" onClick={() => { setQuery(topic.name); setActiveTab("Problems"); }}>{topic.name}</button></td><td data-label="PROBLEMS">{topic.problems}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>Practice details</h2><h3 className="admin-detail-title">{selected.title}</h3><p className="admin-muted">Made Public by {selected.author} · {selected.published}</p><p className="admin-accent">{selected.difficulty} · {selected.topics} · {selected.database}</p>
      <div className="admin-detail-divider" /><h3 className="admin-subheading">Student activity</h3><p className="admin-muted">{selected.attempted} students attempted<br />{selected.acceptance}% acceptance rate<br />{selected.submissions.toLocaleString()} submissions</p>
      <div className="admin-detail-divider" /><h3 className="admin-subheading">Practice settings</h3>
      <Field label="DIFFICULTY"><select value={selected.difficulty} onChange={(event) => updateSelected({ difficulty: event.target.value as AdminPracticeProblem["difficulty"] })}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
      <Field label="TOPICS"><input value={selected.topics} onChange={(event) => updateSelected({ topics: event.target.value })} /></Field>
      <div className="admin-practice-toggle"><span>Comments</span><button type="button" role="switch" aria-label="Comments" aria-checked={selected.comments} className={`admin-toggle${selected.comments ? " is-on" : ""}`} onClick={() => updateSelected({ comments: !selected.comments })}><span /></button></div>
      <div className="admin-practice-toggle"><span>Hints</span><button type="button" role="switch" aria-label="Hints" aria-checked={selected.hints} className={`admin-toggle${selected.hints ? " is-on" : ""}`} onClick={() => updateSelected({ hints: !selected.hints })}><span /></button></div>
      <Field label="ADMIN NOTE"><textarea value={selected.note} onChange={(event) => updateSelected({ note: event.target.value })} /></Field>
      <div className="admin-practice-actions"><button className="button admin-button" type="button" onClick={() => setPreviewing(selected)}>Preview problem</button><button className="button primary admin-button" type="button" onClick={() => { const featured = !selected.featured; updateSelected({ featured }); setNotice(`${selected.title} ${featured ? "featured on" : "removed from"} Practice.`); }}>{selected.featured ? "Remove from featured" : "Feature on Practice"}</button><button className="admin-danger-link" type="button" onClick={() => { const next = selected.status === "Visible" ? "Hidden" : "Visible"; updateSelected({ status: next }); setNotice(`${selected.title} is now ${next.toLowerCase()} on Practice.`); }}>{selected.status === "Visible" ? "Hide from Practice" : "Show on Practice"}</button></div>
    </> : <><h2>Practice details</h2><p className="admin-muted">Select a problem to manage its Practice listing.</p></>} />
    {previewing && <PracticePreviewDialog problem={previewing} onClose={() => setPreviewing(null)} />}
  </div>;
}

export function AdminOverviewPage() {
  const [notice, setNotice] = useState("");
  return <div className="admin-page">
    <PageIntro title="System overview" sub="Sep 18, 2026 / Activity & service health"><button className="button primary admin-button" onClick={() => setNotice("Recent activity view is current through 14:42 today.")}>View activity</button></PageIntro>{notice && <Notice>{notice}</Notice>}
    <div className="admin-metrics"><div><strong>1,248</strong><small>Total users</small></div><div><strong>36</strong><small>Active classes</small></div><div><strong>421</strong><small>Submissions today</small></div><div><strong className="admin-warning">2</strong><small>Grading errors</small></div></div>
    <Split main={<>
      <section className="admin-attention">
        <h2 className="admin-section-heading">Needs attention</h2>
        <table className="admin-table admin-attention-table"><thead><tr><th>ITEM</th><th>COUNT</th><th>ACTION</th></tr></thead><tbody>
          <tr><td data-label="ITEM">Lecturer registrations</td><td data-label="COUNT" className="admin-warning">{readAdminLecturerRequests().length} pending</td><td data-label="ACTION"><Link to="/admin/users/approvals">Review approvals →</Link></td></tr>
          <tr><td data-label="ITEM">Classes without a lecturer</td><td data-label="COUNT" className="admin-warning">{readAdminClasses().filter((item) => item.status !== "Archived" && item.lecturer === "Unassigned").length} class</td><td data-label="ACTION"><Link to="/admin/courses/lecturers">Assign lecturer →</Link></td></tr>
        </tbody></table>
      </section>
      <section className="admin-recent-activity">
        <h2 className="admin-section-heading">Recent activity</h2>
        <table className="admin-table admin-activity-table"><thead><tr><th>ACTION</th><th>BY</th><th>TIME</th></tr></thead><tbody>{adminActivity.map((item) => <tr key={item.action}><td>{item.action}</td><td>{item.by}</td><td>{item.time}</td></tr>)}</tbody></table>
      </section>
    </>} side={<>
      <h2>Grading health</h2><p className="admin-health">Operational</p><p className="admin-muted">419 graded / 2 need attention</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Recent errors</h3><p className="admin-warning admin-error">#104 · Execution timeout<br />Revenue by category</p><p className="admin-warning admin-error">#1051 · Database unavailable<br />Top customers</p><button className="button admin-button" onClick={() => setNotice("Recent grading errors are listed in this demo overview.")}>Review errors</button>
    </>} />
  </div>;
}
