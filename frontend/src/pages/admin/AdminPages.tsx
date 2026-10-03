import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Dialog, Empty, ErrorState, Loading } from "../../components/ui";
import {
  adminCapabilities,
  defaultAdminRolePolicy,
  type AdminClass,
  type AdminLecturerRequest,
  type AdminPracticeProblem,
  type AdminRoleName,
} from "../../data/adminPolicy";
import { adminService, type AdminUser } from "../../services/adminService";
import { teacherService } from "../../services/teacherService";
import type { TeacherClassMember } from "../../data/teacherTypes";
import { studentApi } from "../../services/studentApi";
import { academicTerms } from "../../utils/academicTerms";
import { localTime, parseServerDateTime } from "../../utils/serverDateTime";

function PageIntro({ title, sub, children, compact = false }: { title: string; sub?: string; children?: ReactNode; compact?: boolean }) {
  return <div className={`admin-page-intro${compact ? " page-list-intro" : ""}`}><div><h1 className={compact ? "sr-only" : undefined}>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="admin-page-actions">{children}</div>}</div>;
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const newUser = await adminService.createUser({ name: name.trim(), email: email.trim(), role, password });
      onAdd(newUser);
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return <Dialog title="Add user" onClose={onClose} className="admin-dialog"><form onSubmit={submit} className="admin-dialog-form">
    <Field label="NAME"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required /></Field>
    <Field label="EMAIL"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.edu" required /></Field>
    <Field label="PASSWORD"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={8} /></Field>
    <Field label="ROLE"><select value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
    {error && <p className="admin-warning" style={{ margin: 0 }}>{error}</p>}
    <div className="admin-dialog-actions"><button type="button" className="button" onClick={onClose} disabled={loading}>Cancel</button><button className="button primary" disabled={loading}>{loading ? "Adding..." : "Add user"}</button></div>
  </form></Dialog>;
}

function AdminListPagination({ total, page, onPageChange, label, noun, alwaysVisible = false }: { total: number; page: number; onPageChange: (page: number) => void; label: string; noun: string; alwaysVisible?: boolean }) {
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  return <div className="admin-list-table-footer">
    <p className="admin-table-footer" role="status">Showing {total === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + pageSize, total)} of {total.toLocaleString()} {noun}</p>
    {(pageCount > 1 || alwaysVisible) && <nav className="admin-table-pagination" aria-label={label}>
      <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>← Previous</button>
      <span>Page {currentPage} of {pageCount}</span>
      <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}>Next →</button>
    </nav>}
  </div>;
}

export function AdminUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  
  useEffect(() => {
    adminService.getUsers().then(data => {
      setUsers(data);
      if (data.length > 0) {
        setSelectedEmail(current => current || data[0].email);
      }
      setLoading(false);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : "Failed to load users.");
      setLoading(false);
    });

    adminService.getLecturerRequests().then(requests => {
      setPendingRequestCount(requests.length);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (loading) return;
    const state = location.state as { selectedEmail?: string; notice?: string } | null;
    if (state?.selectedEmail) {
      setSelectedEmail(state.selectedEmail);
      const userIndex = filtered.findIndex(user => user.email === state.selectedEmail);
      if (userIndex >= 0) setPage(Math.floor(userIndex / pageSize) + 1);
    }
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state, loading]);

  const filtered = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "All roles" || user.role === roleFilter) && (statusFilter === "All statuses" || user.status === statusFilter);
  }), [users, query, roleFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  const pageUsers = filtered.slice(firstIndex, firstIndex + pageSize);
  const selected = pageUsers.find((user) => user.email === selectedEmail) || pageUsers[0];

  useEffect(() => {
    setPendingRole(null);
  }, [selected?.email]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  async function handleUpdateRole(userToUpdate: AdminUser, newRole: string) {
    try {
      const updated = await adminService.updateUser(userToUpdate.email, { ...userToUpdate, role: newRole });
      setUsers(all => all.map(u => u.email === updated.email ? updated : u));
    } catch (err: any) {
      setNotice(err.message || "Failed to update role");
    }
  }

  function exportCsv() {
    const csv = ["Name,Email,Role,Status", ...users.map((u) => [u.name, u.email, u.role, u.status].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "uit-sql-users.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}><h1 className="sr-only">Users</h1><Loading label="Loading users…" /></div>;
  if (loadError) return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}><h1 className="sr-only">Users</h1><ErrorState title="Could not load users" message={loadError} onRetry={() => window.location.reload()} /></div>;
  return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}>
    <h1 className="sr-only">Users</h1>
    {pendingRequestCount > 0 && <div className="admin-pending-banner"><span>{pendingRequestCount} lecturer registrations are awaiting approval. Lecturer access stays locked until approved.</span><Link className="text-button" to="/admin/users/approvals">Review requests →</Link></div>}
    <div className="admin-user-filter-row">
      <div className="admin-user-filters">
        <Field label="SEARCH"><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name or email..." /></Field>
        <Field label="ROLE"><select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}><option>All roles</option><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
        <Field label="STATUS"><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option>Active</option><option>All statuses</option><option>Inactive</option><option>Pending</option></select></Field>
      </div>
      <div className="admin-user-actions">
        <button className="button admin-button" onClick={exportCsv} disabled={users.length === 0}>Export all CSV</button>
        <button className="button primary admin-button" onClick={() => setDialog(true)}>Add user</button>
      </div>
    </div>
    {notice && <Notice>{notice}</Notice>}
    <Split main={<>
      <div className="admin-table-wrap compact-table-scroll" role="region" aria-label="Users table" tabIndex={0}><table className="admin-table admin-users-table"><thead><tr><th>NAME / EMAIL</th><th>ROLE</th><th>STATUS</th><th>LAST ACTIVE</th></tr></thead><tbody>
        {pageUsers.map((user) => <tr key={user.email} className={selected?.email === user.email ? "is-selected" : ""} onClick={() => { setSelectedEmail(user.email); setShowUserDetails(true); }}>
          <td data-label="NAME / EMAIL"><button className="admin-row-link" onClick={() => { setSelectedEmail(user.email); setShowUserDetails(true); }}>{user.name}</button><small>{user.email}</small></td><td data-label="ROLE">{user.role}</td><td data-label="STATUS" className={user.status === "Active" ? "admin-success" : ""}>{user.status}</td><td data-label="LAST ACTIVE">{user.lastActive}</td>
        </tr>)}
      </tbody></table>
      {filtered.length === 0 && <Empty title={users.length === 0 ? "No accounts yet" : "No matching accounts"}>{users.length === 0 ? "Add a user to get started." : "Try a different search or filter."}</Empty>}
      </div>
      <div className="admin-compact-list-footer">
        <div className="admin-compact-list-controls">
          <span role="status">Showing {filtered.length === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + pageSize, filtered.length)} of {filtered.length.toLocaleString()} accounts</span>
          <nav className="admin-table-pagination" aria-label="User pages">
            <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>← Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next →</button>
          </nav>
        </div>
      </div>
    </>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2>Account details</h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowUserDetails(false)}>Back to users</button></div><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label="ROLE"><select value={pendingRole ?? selected.role} onChange={(e) => setPendingRole(e.target.value)}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
      {pendingRole && pendingRole !== selected.role && (
        <button className="button primary admin-button" style={{ marginBottom: "1rem" }} onClick={() => { handleUpdateRole(selected, pendingRole); setPendingRole(null); }}>Save role</button>
      )}
      <p className={selected.status === "Active" ? "admin-success admin-detail-status" : "admin-warning admin-detail-status"}>{selected.status} · Joined {selected.joined}</p><p className="admin-muted">{selected.detail}</p>
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/users/${encodeURIComponent(selected.email)}/edit`}>Edit account</Link></div>
    </> : <><h2>Account details</h2><p className="admin-muted">Select an account to review its access.</p></>} />
    {dialog && <AddUserDialog onClose={() => setDialog(false)} onAdd={(user) => { setUsers((all) => [...all, user]); setSelectedEmail(user.email); setPage(Math.floor(filtered.length / pageSize) + 1); setDialog(false); setNotice(`${user.name} was added successfully.`); }} />}
  </div>;
}

export function AdminEditAccountPage() {
  const { email: encodedEmail = "" } = useParams();
  const email = decodeURIComponent(encodedEmail);
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [name, setName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("Student");
  const [status, setStatus] = useState<AdminUser["status"]>("Active");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirmDeactivationSave, setConfirmDeactivationSave] = useState(false);

  useEffect(() => {
    adminService.getUsers().then(users => {
      const found = users.find(u => u.email === email);
      if (found) {
        setCurrentUser(found);
        setName(found.name);
        setAccountEmail(found.email);
        setRole(found.role);
        setStatus(found.status);
      }
    }).catch(err => setLoadError(err instanceof Error ? err.message : "Could not load account.")).finally(() => setLoading(false));
  }, [email]);

  if (loading) return <div className="admin-page"><Loading label="Loading account…" /></div>;
  if (loadError) return <div className="admin-page"><PageIntro title="Could not load account" /><Notice>{loadError}</Notice><Link className="button admin-button" to="/admin/users">Back to users</Link></div>;
  if (!currentUser) return <div className="admin-page"><PageIntro title="Account not found" /><p className="admin-muted">This account may have been removed or its email has changed.</p><Link className="button admin-button" to="/admin/users">Back to users</Link></div>;

  async function persistAccount() {
    if (!currentUser) return;
    const nextName = name.trim();
    const nextEmail = accountEmail.trim().toLowerCase();
    if (!nextName || !nextEmail) { setNotice("Name and email are required."); return; }

    setConfirmDeactivationSave(false);
    setSaving(true);
    try {
      await adminService.updateUser(currentUser.email, {
        name: nextName,
        email: nextEmail,
        role,
        status
      });
      navigate("/admin/users", { state: { selectedEmail: nextEmail, notice: `Account updated for ${nextName}.` } });
    } catch (err: any) {
      setNotice(err.message || "Failed to update account.");
      setSaving(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (currentUser?.status !== "Inactive" && status === "Inactive") {
      setConfirmDeactivationSave(true);
      return;
    }
    void persistAccount();
  }


  return <div className="admin-page">
    <div className="admin-edit-layout admin-account-edit-layout">
      <form className="admin-edit-form" onSubmit={save}>
        <div className="admin-account-form-header">
          <div><h1>Account information</h1><p className="admin-muted">Update this user’s profile, role, and sign-in status.</p></div>
          <Link className="button admin-button" to="/admin/users">Back to users</Link>
        </div>
        <div className="admin-account-fields">
        <Field label="FULL NAME"><input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="EMAIL ADDRESS"><input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} required /></Field>
        <Field label="ROLE"><select value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
        <Field label="ACCOUNT STATUS"><select value={status} onChange={(event) => setStatus(event.target.value as AdminUser["status"])}><option>Active</option><option>Inactive</option><option>Pending</option></select></Field>
        </div>
        {notice && <Notice>{notice}</Notice>}
        <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/users">Cancel</Link><button className="button primary admin-button" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
      </form>
    </div>
    {confirmDeactivationSave && <Dialog title="Deactivate account" onClose={() => setConfirmDeactivationSave(false)} className="admin-dialog">
      <div className="admin-dialog-form">
        <p>Save these changes and deactivate <strong>{currentUser.name}</strong> ({currentUser.email})? They will no longer be able to sign in. Their classes and submissions will be retained.</p>
        <div className="admin-dialog-actions"><button type="button" className="button" onClick={() => setConfirmDeactivationSave(false)}>Cancel</button><button type="button" className="button admin-reject-button" onClick={() => void persistAccount()}>Save and deactivate</button></div>
      </div>
    </Dialog>}
  </div>;
}

function RejectLecturerDialog({
  request,
  onClose,
  onReject,
}: {
  request: any;
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
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    adminService.getLecturerRequests().then(data => {
      setRequests(data);
      if (data.length > 0) setSelectedEmail(data[0].email);
      setLoading(false);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : "Could not load lecturer requests.");
      setLoading(false);
    });
  }, []);

  const selected = requests.find((request) => request.email === selectedEmail) || requests[0];

  async function resolveRequest(request: any, approved: boolean, reason = "") {
    try {
      if (approved) {
        await adminService.approveLecturerRequest(request.id);
        setNotice(`${request.name} was approved as a lecturer.`);
      } else {
        await adminService.rejectLecturerRequest(request.id);
        setNotice(`${request.name}'s request was rejected.${reason ? " The reason was not sent because the server does not accept it." : ""}`);
      }
      const next = requests.filter((item) => item.email !== request.email);
      setRequests(next);
      setSelectedEmail(next[0]?.email || "");
      setRejecting(null);
    } catch (err: any) {
      setNotice(err.message || "Action failed.");
      setRejecting(null);
    }
  }

  return <div className="admin-page admin-approvals-page">
    <PageIntro title="Lecturer approvals" sub={`People & access / ${requests.length} pending lecturer requests`} />
    <div className="admin-section-tabs">
      <Link to="/admin/users">All users</Link>
      <Link className="active" to="/admin/users/approvals">Lecturer approvals ({requests.length})</Link>
    </div>
    {notice && <Notice>{notice}</Notice>}
    {loading ? <Loading label="Loading lecturer requests…" /> : loadError ? <p className="admin-notice" role="alert">{loadError}</p> :
    <Split main={<>
      <div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-approval-table"><thead><tr><th>NAME / EMAIL</th><th>DEPARTMENT</th><th>SUBMITTED</th><th>STATUS</th></tr></thead><tbody>
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
      <p className="admin-muted">Lecturer access stays locked. The server does not send the entered reason.</p>
    </> : <><h2>Request details</h2><p className="admin-muted">There are no pending lecturer requests.</p></>} />}
    {rejecting && <RejectLecturerDialog request={rejecting} onClose={() => setRejecting(null)} onReject={(reason) => resolveRequest(rejecting, false, reason)} />}
  </div>;
}

export function AdminRolesPage() {
  const [selectedRole, setSelectedRole] = useState<AdminRoleName>("Lecturer");
  const policy = defaultAdminRolePolicy;
  const roleInfo: Record<AdminRoleName, { title: string; description: string }> = {
    Student: { title: "Learning access", description: "Run and submit SQL for assigned work, and practice from the shared problem library." },
    Lecturer: { title: "Teaching access", description: "Create problems, assign work and review results in assigned classes." },
    Admin: { title: "System access", description: "Manage accounts, courses, classes, the Practice catalog, and platform activity." },
  };
  const enabledCount = adminCapabilities.filter(({ key }) => policy.permissions[key]?.[selectedRole]).length;
  return <div className="admin-page admin-roles-page">
    <h1 className="sr-only">Roles &amp; permissions</h1>
    <Split main={<div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-permissions-table"><thead><tr><th>CAPABILITY</th><th>STUDENT</th><th>LECTURER</th><th>ADMIN</th></tr></thead><tbody>{adminCapabilities.map(({ key, label }) => <tr key={key}><td data-label="CAPABILITY">{label}</td>{(["Student", "Lecturer", "Admin"] as const).map((role) => {
      const enabled = policy.permissions[key]?.[role] ?? false;
      return <td data-label={role.toUpperCase()} key={role}><span className={enabled ? "admin-success" : "admin-muted"}>{enabled ? "Allowed" : "—"}</span></td>;
    })}</tr>)}</tbody></table></div>} side={<>
      <div className="admin-role-tabs">{(["Student", "Lecturer", "Admin"] as const).map((role) => <button type="button" key={role} className={selectedRole === role ? "active" : ""} onClick={() => setSelectedRole(role)}>{role}</button>)}</div>
      <h3 className="admin-detail-title">{roleInfo[selectedRole].title}</h3><p className="admin-muted">{roleInfo[selectedRole].description}</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Effective access</h3>
      <p className="admin-role-summary">{enabledCount} of {adminCapabilities.length} capabilities enabled</p>
      <dl className="teacher-list-detail-facts"><div><dt>Class access</dt><dd>{policy.scopes[selectedRole].classAccess}</dd></div><div><dt>Problem access</dt><dd>{policy.scopes[selectedRole].problemAccess}</dd></div></dl>
      <p className="admin-muted">This guide describes intended product roles. The server enforces access; these detailed capability labels are not fetched from it.</p>
    </>} />
  </div>;
}

function CourseDialog({ onClose, onCreate, error, busy }: { onClose: () => void; onCreate: (id: string, course: string, term: string) => void; error: string; busy: boolean }) {
  const [newClassForm, setNewClassForm] = useState({
    id: "",
    course: "",
    term: ""
  });

  return (
    <Dialog title="Create a new class" onClose={onClose}>
      <form className="teacher-manage-dialog" onSubmit={(e) => { e.preventDefault(); if (newClassForm.id.trim() && newClassForm.course.trim() && newClassForm.term) onCreate(newClassForm.id.trim(), newClassForm.course.trim(), newClassForm.term); }}>
        <p className="tiny muted">Set up a new class or section</p>
        
        <label className="teacher-field" style={{ marginTop: "1rem" }}>
          <span>CLASS CODE</span>
          <input required autoFocus value={newClassForm.id} onChange={e => setNewClassForm({...newClassForm, id: e.target.value})} placeholder="E.g. IS207.R14" />
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

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy} type="submit">{busy ? "Creating…" : "Create class"}</button>
        </div>
        {error && <p className="admin-notice" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
}

export function AdminCoursesPage() {
  const location = useLocation();
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showCourseDetails, setShowCourseDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [semester, setSemester] = useState("All semesters");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getClasses().then((classesData) => {
      setClasses(classesData);
      if (classesData.length > 0 && !selectedId) {
        setSelectedId(classesData[0].id);
      }
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes.")).finally(() => setLoading(false));
  }, []);

  
  useEffect(() => {
    if (loading) return;
    const state = location.state as { selectedId?: string; notice?: string } | null;
    if (state?.selectedId) {
      setSelectedId(state.selectedId);
      const index = visible.findIndex(item => item.id === state.selectedId);
      if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
    }
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state, loading]);

  const visible = classes.filter((item) =>
    `${item.course} ${item.id} ${item.lecturer}`.toLowerCase().includes(query.toLowerCase()) &&
    (semester === "All semesters" || item.semester === semester));
  const semesters = [...new Set(classes.map((item) => item.semester).filter(Boolean))].sort().reverse();
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageClasses = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = pageClasses.find(item => item.id === selectedId) || pageClasses[0];

  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  if (loading) return <div className="admin-page compact-tables-page compact-admin-list-page admin-course-page"><h1 className="sr-only">Courses & classes</h1><Loading label="Loading courses and classes…" /></div>;
  if (loadError) return <div className="admin-page compact-tables-page compact-admin-list-page admin-course-page"><h1 className="sr-only">Courses & classes</h1><ErrorState title="Could not load courses" message={loadError} onRetry={() => window.location.reload()} /></div>;

  return <div className={"admin-page compact-tables-page compact-admin-list-page admin-course-page" + (showCourseDetails ? " show-course-details" : "")}>
    <h1 className="sr-only">Courses & classes</h1>
    <div className="admin-course-filter-row">
      <Field label="SEARCH"><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search course or class..." /></Field>
      <div className="admin-course-options">
        <Field label="SEMESTER"><select value={semester} onChange={(event) => { setSemester(event.target.value); setPage(1); }}><option>All semesters</option>{semesters.map((term) => <option key={term}>{term}</option>)}</select></Field>
        <button className="button primary admin-button" onClick={() => { setCreateError(""); setDialog(true); }}>Add class</button>
      </div>
    </div>
    {loadError && <Notice>{loadError}</Notice>}{notice && <Notice>{notice}</Notice>}
    <Split main={<><div className="admin-table-wrap compact-table-scroll" role="region" aria-label="Courses and classes table" tabIndex={0}><table className="admin-table admin-course-table"><thead><tr><th>COURSE / CLASS</th><th>LECTURER</th><th>STUDENTS</th><th>STATUS</th></tr></thead><tbody>{pageClasses.map((item) => <tr key={item.id} className={item.id === selected?.id ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setShowCourseDetails(true); }}><td data-label="COURSE / CLASS"><button className="admin-row-link" onClick={() => { setSelectedId(item.id); setShowCourseDetails(true); }}>{item.course}</button><small>{item.id}</small></td><td data-label="LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STUDENTS">{item.students}</td><td data-label="STATUS" className={item.status === "Active" ? "admin-success" : "admin-warning"}>{item.status}</td></tr>)}</tbody></table>{!loadError && classes.length === 0 && <p className="admin-table-footer">No classes yet. Add a class to get started.</p>}{!loadError && classes.length > 0 && visible.length === 0 && <p className="admin-table-footer">No classes match these filters.</p>}</div><AdminListPagination total={visible.length} page={currentPage} onPageChange={setPage} label="Course and class pages" noun="classes" alwaysVisible /></>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2>{selected.id}</h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowCourseDetails(false)}>Back to classes</button></div><h3 className="admin-detail-title">{selected.course.split(" · ")[1] || selected.course}</h3><p className={selected.status === "Active" ? "admin-success" : "admin-warning"}>{selected.status}{selected.lecturer === "Unassigned" ? " · Lecturer needed" : ""}</p><div className="admin-detail-divider" />
      <Field label="SEMESTER"><select value={selected.semester} onChange={async (event) => {
        const newSemester = event.target.value;
        try {
          const res = await adminService.updateClass(selected.id, { semester: newSemester });
          setClasses(all => all.map(c => c.id === selected.id ? res : c));
          setNotice(`${selected.id} semester updated.`);
        } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update semester."); }
      }}>
        {academicTerms(selected.semester).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select></Field>
      <Field label="CLASS DATES"><input readOnly value={selected.startDate && selected.endDate ? `${selected.startDate} – ${selected.endDate}` : selected.dates} /></Field><p className="admin-muted">{selected.students} enrolled student{selected.students === 1 ? "" : "s"}</p>
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/courses/classes/${encodeURIComponent(selected.id)}/edit`}>Edit class</Link></div>
    </> : <h2>Class details</h2>} />
    {dialog && <CourseDialog error={createError} busy={creating} onClose={() => setDialog(false)} onCreate={async (id, course, term) => {
      if (classes.some((item) => item.id.toLowerCase() === id.toLowerCase())) { setCreateError(`A class with ID ${id} already exists.`); return; }
      setCreating(true);
      setCreateError("");
      try {
        const item = await adminService.createClass({ id, course, semester: term, lecturerId: "Unassigned" });
        setClasses((all) => [...all, item]); setSelectedId(id); setQuery(""); setSemester("All semesters"); setPage(Math.floor(classes.length / pageSize) + 1); setDialog(false); setNotice(`${id} was added.`);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Could not create class.");
      } finally { setCreating(false); }
    }} />}
  </div>;
}

export function AdminEditClassPage() {
  const { classId: routeId = "" } = useParams();
  const classId = decodeURIComponent(routeId);
  const navigate = useNavigate();
  const [record, setRecord] = useState<AdminClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lecturer, setLecturer] = useState("Unassigned");
  const [status, setStatus] = useState<AdminClass["status"]>("Draft");
  const [notice, setNotice] = useState("");
  const [lecturers, setLecturers] = useState<{name: string, id: string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeacherClassMember[]>([]);
  const [students, setStudents] = useState<TeacherClassMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [membersNotice, setMembersNotice] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberTab, setMemberTab] = useState<"remove" | "add">("remove");
  const [memberBusyId, setMemberBusyId] = useState("");

  useEffect(() => {
    Promise.all([
      adminService.getClasses(),
      adminService.getUsers()
    ]).then(([classes, users]) => {
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        setRecord(cls);
        setCourse(cls.course);
        setSemester(cls.semester);
        setStartDate(cls.startDate || "");
        setEndDate(cls.endDate || "");
        setLecturer(cls.lecturerId || "Unassigned");
        setStatus(cls.status as AdminClass["status"]);
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer" || user.role === "instructor").map((user: any) => ({ name: user.name, id: user.id })));
      setLoading(false);
    }).catch((error) => { setLoadError(error instanceof Error ? error.message : "Could not load class details."); setLoading(false); });
  }, [classId]);

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    setMembersError("");
    Promise.all([teacherService.getClassMembers(classId), teacherService.getAllStudents()])
      .then(([classMembers, allStudents]) => {
        if (!active) return;
        setMembers(classMembers);
        setStudents(allStudents);
      })
      .catch((error) => {
        if (active) setMembersError(error instanceof Error ? error.message : "Could not load class members.");
      })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [classId]);

  if (loading) return <div className="admin-page"><Loading label="Loading class details…" /></div>;
  if (loadError) return <div className="admin-page"><Notice>{loadError}</Notice></div>;
  if (!record) return <div className="admin-page"><p className="admin-muted">This class may have been removed.</p></div>;
  
  const currentRecord = record;

  const enrolledIds = new Set(members.map((member) => member.id).filter(Boolean));
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.id || ""} ${member.email || ""}`.toLowerCase().includes(normalizedMemberSearch),
  );
  const availableStudents = students.filter((student) =>
    student.id && !enrolledIds.has(student.id) &&
    `${student.name} ${student.id} ${student.email || ""}`.toLowerCase().includes(normalizedMemberSearch),
  );
  const availableStudentCount = students.filter((student) => student.id && !enrolledIds.has(student.id)).length;

  async function changeMembership(student: TeacherClassMember, action: "add" | "remove") {
    if (!student.id || memberBusyId) return;
    setMemberBusyId(student.id);
    setMembersError("");
    setMembersNotice("");
    try {
      if (action === "add") {
        const added = await teacherService.addClassMember(classId, { student_id: student.id });
        setMembers((current) => [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
        setMembersNotice(`${student.name} added to this class.`);
      } else {
        await teacherService.removeClassMember(classId, student.id);
        setMembers((current) => current.filter((member) => member.id !== student.id));
        setMembersNotice(`${student.name} removed from this class.`);
      }
      setRecord((current) => current ? { ...current, students: Math.max(0, current.students + (action === "add" ? 1 : -1)) } : current);
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : `Could not ${action} this student.`);
    } finally {
      setMemberBusyId("");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!startDate.trim() || !endDate.trim()) { setNotice("Class dates are required."); return; }
    if (endDate < startDate) { setNotice("End date must be after the start date."); return; }
    setSaving(true);
    setNotice("");
    try {
      await adminService.updateClass(currentRecord.id, { course, semester, lecturerId: lecturer, status, startDate, endDate });
      navigate("/admin/courses", { state: { selectedId: currentRecord.id, notice: `${currentRecord.id} class details saved.` } });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save class details.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-page">
    <div className="admin-edit-layout admin-class-edit-layout">
    <form className="admin-edit-form admin-class-form" onSubmit={save}>
      <h2>{currentRecord.id} · Class details</h2>
      <Field label="CLASS ID"><input value={currentRecord.id} readOnly /><small className="admin-muted">Class IDs stay fixed so existing student work keeps its link.</small></Field>
      <Field label="COURSE"><input value={course} onChange={(event) => setCourse(event.target.value)} /></Field>
      <Field label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}>
        {academicTerms(semester).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select></Field>
      <Field label="LECTURER"><select value={lecturer} onChange={(event) => setLecturer(event.target.value)}><option value="Unassigned">Unassigned</option>{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <Field label="CLASS STATUS"><select value={status} onChange={(event) => setStatus(event.target.value as AdminClass["status"])}><option>Draft</option><option>Active</option><option>Archived</option></select></Field>
      {notice && <Notice>{notice}</Notice>}
      <div className="admin-class-form-bottom">
        <div className="admin-class-date-row">
          <Field label="START DATE"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field>
          <Field label="END DATE"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></Field>
        </div>
        <div className="admin-edit-actions admin-class-inline-actions"><Link className="button admin-button" to="/admin/courses">Cancel</Link><button className="button primary admin-button" disabled={saving}>{saving ? "Saving…" : "Save class"}</button></div>
      </div>
    </form>
    <aside className="admin-edit-form admin-edit-members" aria-labelledby="admin-class-members-title">
      <div className="admin-members-heading">
        <div><h2 id="admin-class-members-title">Manage members</h2><p className="admin-muted">Add students to or remove them from this class.</p></div>
      </div>
      {membersError && <Notice>{membersError}</Notice>}
      {membersNotice && <p className="admin-member-notice" role="status">{membersNotice}</p>}
      {membersLoading ? <Loading label="Loading class members…" /> : <>
        <Field label="SEARCH STUDENTS"><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search by name, ID, or email..." /></Field>
        <div className="admin-member-tabs" role="tablist" aria-label="Manage class members">
          <button id="remove-students-tab" type="button" role="tab" aria-selected={memberTab === "remove"} aria-controls="remove-students-panel" className={memberTab === "remove" ? "is-active" : ""} onClick={() => setMemberTab("remove")}>Remove students <span>{members.length}</span></button>
          <button id="add-students-tab" type="button" role="tab" aria-selected={memberTab === "add"} aria-controls="add-students-panel" className={memberTab === "add" ? "is-active" : ""} onClick={() => setMemberTab("add")}>Add students <span>{availableStudentCount}</span></button>
        </div>
        {memberTab === "remove" ? <section id="remove-students-panel" className="admin-member-list" role="tabpanel" aria-labelledby="remove-students-tab">
          {filteredMembers.map((member) => <div className="admin-member-row" key={member.id || member.email}>
            <div><strong>{member.name}</strong><small>{member.id}{member.email ? ` · ${member.email}` : ""}</small></div>
            <button className="admin-member-remove" type="button" disabled={Boolean(memberBusyId)} onClick={() => void changeMembership(member, "remove")}>{memberBusyId === member.id ? "…" : "Remove"}</button>
          </div>)}
          {!filteredMembers.length && <p className="admin-member-empty">{members.length ? "No enrolled students match this search." : "No students are enrolled yet."}</p>}
        </section> : <section id="add-students-panel" className="admin-member-list" role="tabpanel" aria-labelledby="add-students-tab">
          {availableStudents.map((student) => <div className="admin-member-row" key={student.id}>
            <div><strong>{student.name}</strong><small>{student.id}{student.email ? ` · ${student.email}` : ""}</small></div>
            <button className="admin-member-add" type="button" disabled={Boolean(memberBusyId)} onClick={() => void changeMembership(student, "add")}>{memberBusyId === student.id ? "…" : "Add"}</button>
          </div>)}
          {!availableStudents.length && <p className="admin-member-empty">{students.every((student) => !student.id || enrolledIds.has(student.id)) ? "All students are already in this class." : "No available students match this search."}</p>}
        </section>}
      </>}
    </aside>
    </div>
  </div>;
}

export function AdminLecturersPage() {
  const location = useLocation();
  const state = location.state as { selectedId?: string } | null;
  const initialSelectedId = state?.selectedId || "";
  
  const [assignments, setAssignments] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [lecturer, setLecturer] = useState("Unassigned");
  const [notice, setNotice] = useState("");
  const [lecturers, setLecturers] = useState<{name: string, id: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    Promise.all([
      adminService.getClasses(),
      adminService.getUsers()
    ]).then(([classes, users]) => {
      const sorted = [...classes].sort((a, b) => Number(b.lecturer === "Unassigned") - Number(a.lecturer === "Unassigned"));
      setAssignments(sorted);
      if (sorted.length > 0 && !selectedId) {
        setSelectedId(sorted[0].id);
        setLecturer(sorted[0].lecturerId || "Unassigned");
      } else if (selectedId) {
        const cls = sorted.find(c => c.id === selectedId);
        if (cls) setLecturer(cls.lecturerId || "Unassigned");
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer" || user.role === "instructor").map((user: any) => ({ name: user.name, id: user.id })));
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes and lecturers.")).finally(() => setLoading(false));
  }, []);

  const selected = assignments.find((item) => item.id === selectedId);

  return <div className="admin-page">
    <PageIntro title="Lecturer assignment" sub={`Class ownership / ${selected?.semester || ""}`}>
      <button className="button primary admin-button" disabled={!selected || saving || lecturer === (selected.lecturerId || "Unassigned")} onClick={async () => {
        if (!selected) return;
        setSaving(true);
        setNotice("");
        try {
          const updated = await adminService.updateClass(selectedId, { lecturerId: lecturer === "Unassigned" ? "Unassigned" : lecturer });
          setAssignments((all) => all.map((item) => item.id === selectedId ? updated : item));
          setNotice(`${updated.lecturer} assigned to ${selectedId}.`);
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Could not assign lecturer.");
        } finally {
          setSaving(false);
        }
      }}>{saving ? "Saving…" : "Save assignment"}</button>
    </PageIntro>{notice && <Notice>{notice}</Notice>}
    {loading ? <Loading label="Loading classes and lecturers…" /> : loadError ? <p className="admin-notice" role="alert">{loadError}</p> : assignments.length === 0 ? <p className="admin-muted">No classes are available for lecturer assignment.</p> :
    <Split main={<div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-lecturer-table"><thead><tr><th>CLASS</th><th>CURRENT LECTURER</th><th>STATUS</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setLecturer(item.lecturerId || "Unassigned"); }}><td data-label="CLASS"><b>{item.id}</b></td><td data-label="CURRENT LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STATUS">{item.lecturer === "Unassigned" ? "Needs lecturer" : "Assigned"}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>Assign {selected.id}</h2><p className="admin-muted">{selected.course.split(" · ")[1] || selected.course} · {selected.semester} · {selected.students} student{selected.students === 1 ? "" : "s"}</p><Field label="LECTURER"><select value={lecturer} onChange={(e) => setLecturer(e.target.value)}><option value="Unassigned">Unassigned</option>{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><div className="admin-detail-divider" /><h3 className="admin-subheading">Access preview</h3><p className="admin-muted">The selected lecturer can manage assignments, view class results and review submissions after assignment is saved.</p>
    </> : <h2>No class selected</h2>} />}
  </div>;
}

type CatalogProblem = AdminPracticeProblem & { id: string };
function PracticePreviewDialog({ problem, onClose }: { problem: CatalogProblem; onClose: () => void }) {
  const reviewSignal = problem.attempted ? problem.acceptance < 45
    ? "Low solve rate · consider adding a hint"
    : problem.acceptance > 80
      ? "High solve rate · suitable for an introductory set"
      : "Balanced solve rate" : "Activity statistics unavailable";
  return <Dialog title="Student practice preview" onClose={onClose} className="admin-practice-preview">
    <div className="admin-preview-heading"><h3>{problem.title}</h3><p>{problem.difficulty} · {problem.topics} · {problem.database}</p></div>
    <section className="admin-preview-section"><h4>Problem</h4><p>{problem.description}</p>{problem.expectedColumns && <p className="admin-muted">Return columns: <code>{problem.expectedColumns}</code></p>}</section>
    <section className="admin-preview-section"><h4>Available tables</h4><pre>{problem.schemaPreview}</pre></section>
    <section className="admin-preview-insight"><b>Practice signal</b><span>{reviewSignal}</span>{problem.attempted > 0 && <small>{problem.attempted} attempts · {problem.acceptance}% accepted</small>}</section>
    <div className="admin-dialog-actions"><button type="button" className="button primary admin-button" onClick={onClose}>Done</button></div>
  </Dialog>;
}

export function AdminPracticeCatalogPage() {
  const [problems, setProblems] = useState<CatalogProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [showPracticeDetails, setShowPracticeDetails] = useState(false);
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [difficulty, setDifficulty] = useState("All levels");
  const [visibility, setVisibility] = useState("All");
  const [notice, setNotice] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [previewing, setPreviewing] = useState<CatalogProblem | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    studentApi.getProblems().then(data => {
      const mapped: CatalogProblem[] = data.map((p: any) => ({
        id: p.id,
        title: p.title,
        topics: p.topics ? p.topics.join(" · ") : (p.topic || ""),
        difficulty: p.difficulty,
        solvedBy: p.solvedBy || 0,
        status: p.practiceListed ? "Visible" : "Hidden",
        author: "—",
        published: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—",
        database: p.databaseType || "SQL Server",
        attempted: p.attempted || 0,
        acceptance: p.acceptance || 0,
        submissions: p.submissions || 0,
        comments: false,
        hints: false,
        note: "",
        featured: false,
        description: "",
        schemaPreview: "",
        expectedColumns: ""
      }));
      setProblems(mapped);
      if (mapped.length > 0) {
        setSelectedId(mapped[0].id);
      }
      setLoading(false);
    }).catch(err => {
      setCatalogError(err instanceof Error ? err.message : "Could not load the Practice catalog.");
      setLoading(false);
    });
  }, []);

  async function openPreview(problem: CatalogProblem) {
    setPreviewBusy(true);
    setNotice("");
    try {
      const detail = await studentApi.getProblem(problem.id);
      setPreviewing({ ...problem, description: detail.description || "", schemaPreview: detail.schema || "" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load problem preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  const list = useMemo(() => problems.filter((problem) =>
    problem.title.toLowerCase().includes(query.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (visibility === "All" || problem.status === visibility) &&
    (!topic || problem.topics.split(" · ").some(name => name.trim() === topic))), [problems, query, difficulty, visibility, topic]);

  const computedTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of problems) {
      if (!p.topics) continue;
      const parts = p.topics.split(" · ");
      for (const t of parts) {
        if (!t.trim()) continue;
        counts[t.trim()] = (counts[t.trim()] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, problems: count }))
      .sort((a, b) => b.problems - a.problems);
  }, [problems]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageProblems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = pageProblems.find(problem => problem.id === selectedId) || pageProblems[0];
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  if (loading) {
    return <div className="admin-page compact-tables-page compact-admin-list-page admin-practice-page"><h1 className="sr-only">Practice catalog</h1><Loading label="Loading catalog…" /></div>;
  }
  if (catalogError) return <div className="admin-page compact-tables-page compact-admin-list-page admin-practice-page"><h1 className="sr-only">Practice catalog</h1><ErrorState title="Could not load catalog" message={catalogError} onRetry={() => window.location.reload()} /></div>;

  return <div className={"admin-page compact-tables-page compact-admin-list-page admin-practice-page" + (showPracticeDetails ? " show-practice-details" : "")}>
    <h1 className="sr-only">Practice catalog</h1>
    {notice && <Notice>{notice}</Notice>}
    <div className="admin-practice-filters admin-practice-topic-filters">
      <div className="admin-practice-main-filters">
        <Field label="SEARCH"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search title..." /></Field>
        <Field label="TOPIC"><select value={topic} onChange={event => { setTopic(event.target.value); setPage(1); }}><option value="">All topics</option>{computedTopics.map(item => <option key={item.name} value={item.name}>{item.name} ({item.problems})</option>)}</select></Field>
        <Field label="DIFFICULTY"><select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}><option>All levels</option><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
      </div>
      <Field label="VISIBILITY"><select value={visibility} onChange={(event) => { setVisibility(event.target.value); setPage(1); }}><option>All</option><option>Visible</option><option>Hidden</option></select></Field>
    </div>
    <Split className="admin-practice-split" main={<><div className="admin-table-wrap compact-table-scroll" role="region" aria-label="Practice problems table" tabIndex={0}><table className="admin-table admin-practice-table"><thead><tr><th>PROBLEM</th><th>TOPICS</th><th>DIFFICULTY</th><th>SOLVED BY</th><th>STATUS</th></tr></thead><tbody>
      {pageProblems.map((problem) => <tr key={problem.id} className={problem.id === selected?.id ? "is-selected" : ""} onClick={() => { setSelectedId(problem.id); setShowPracticeDetails(true); }}>
        <td data-label="PROBLEM"><button className="admin-row-link" type="button" onClick={() => { setSelectedId(problem.id); setShowPracticeDetails(true); }}>{problem.title}</button></td><td data-label="TOPICS">{problem.topics}</td><td data-label="DIFFICULTY">{problem.difficulty}</td><td data-label="SOLVED BY">{problem.solvedBy}</td><td data-label="STATUS" className={problem.status === "Visible" ? "admin-success" : ""}>{problem.status}</td>
      </tr>)}
      {!list.length && <tr><td colSpan={5} className="admin-muted">No practice problems match these filters.</td></tr>}
    </tbody></table></div><AdminListPagination total={list.length} page={currentPage} onPageChange={setPage} label="Practice problem pages" noun="problems" alwaysVisible /></>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2>{selected.title}</h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowPracticeDetails(false)}>Back to problems</button></div>
      {selected.published !== "—" && <p className="admin-muted">Updated {selected.published}</p>}
      <p className="admin-accent">{selected.difficulty} · {selected.database}</p>
      {selected.topics && <p className="admin-muted">{selected.topics}</p>}
      <div className="admin-detail-divider" />
      <dl className="teacher-list-detail-facts">
        <div><dt>Visibility</dt><dd>{selected.status}</dd></div>
        <div><dt>Attempts</dt><dd>{selected.attempted}</dd></div>
        <div><dt>Acceptance</dt><dd>{selected.attempted ? selected.acceptance + "%" : "—"}</dd></div>
        <div><dt>Submissions</dt><dd>{selected.submissions}</dd></div>
      </dl>
      <div className="admin-practice-actions"><button className="button admin-button" type="button" disabled={previewBusy} onClick={() => void openPreview(selected)}>{previewBusy ? "Loading…" : "View details"}</button></div>
    </> : <p className="admin-muted">Select a problem.</p>} />
    {previewing && <PracticePreviewDialog problem={previewing} onClose={() => setPreviewing(null)} />}
  </div>;
}

function OverviewPagination({ total, page, onPageChange, label }: { total: number; page: number; onPageChange: (page: number) => void; label: string }) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  return <nav className="admin-table-pagination" aria-label={label}>
      <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>← Previous</button>
      <span>Page {currentPage} of {pageCount}</span>
      <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}>Next →</button>
    </nav>;
}

function OverviewLecturerApprovalsPanel({ onClose, onResolved }: { onClose: () => void; onResolved: (pendingCount: number) => void }) {
  const [requests, setRequests] = useState<(AdminLecturerRequest & { id: string })[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const selected = requests.find(request => request.id === selectedId) || requests[0];

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getLecturerRequests();
      setRequests(data);
      setSelectedId(data[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load lecturer requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function resolveRequest(approved: boolean) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (approved) await adminService.approveLecturerRequest(selected.id);
      else await adminService.rejectLecturerRequest(selected.id);
      const remaining = requests.filter(request => request.id !== selected.id);
      setRequests(remaining);
      setSelectedId(remaining[0]?.id || "");
      setConfirmReject(false);
      setNotice(approved ? selected.name + " was approved as a lecturer." : selected.name + "'s request was rejected.");
      onResolved(remaining.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-overview-approvals">
    <div className="admin-overview-panel-header"><h2>Lecturer approvals</h2><button type="button" className="text-button" disabled={busy} onClick={onClose}>Close</button></div>
    {loading ? <Loading label="Loading lecturer requests…" /> : <>
      {notice && <Notice>{notice}</Notice>}
      {error && <p className="admin-warning" role="alert">{error}</p>}
      {selected ? <>
        <Field label={"PENDING REQUESTS (" + requests.length + ")"}><select value={selected.id} disabled={busy} onChange={event => { setSelectedId(event.target.value); setConfirmReject(false); setError(""); setNotice(""); }}>{requests.map(request => <option key={request.id} value={request.id}>{request.name} · {request.email}</option>)}</select></Field>
        <div className="admin-detail-divider" />
        <h3 className="admin-detail-title">{selected.name}</h3>
        <dl className="teacher-list-detail-facts">
          <div><dt>Email</dt><dd>{selected.email}</dd></div>
          <div><dt>Department</dt><dd>{selected.department || "—"}</dd></div>
          <div><dt>Submitted</dt><dd>{selected.submitted || "—"}</dd></div>
        </dl>
        {confirmReject ? <div className="admin-overview-reject-confirm">
          <p>Reject the registration for <strong>{selected.name}</strong>?</p>
          <div className="admin-overview-request-actions"><button type="button" className="button admin-button" disabled={busy} onClick={() => setConfirmReject(false)}>Cancel</button><button type="button" className="button admin-button admin-reject-button" disabled={busy} onClick={() => void resolveRequest(false)}>{busy ? "Rejecting…" : "Confirm rejection"}</button></div>
        </div> : <div className="admin-overview-request-actions">
          <button type="button" className="button primary admin-button" disabled={busy} onClick={() => void resolveRequest(true)}>{busy ? "Approving…" : "Approve lecturer"}</button>
          <button type="button" className="button admin-button admin-reject-button" disabled={busy} onClick={() => setConfirmReject(true)}>Reject request</button>
        </div>}
      </> : error ? <button type="button" className="button admin-button" onClick={() => void loadRequests()}>Retry</button> : <>
        <p className="admin-muted">No pending requests.</p>
        <button type="button" className="text-button" onClick={() => void loadRequests()}>Refresh</button>
      </>}
    </>}
  </div>;
}

function OverviewActivityPanel({ activity, onClose }: { activity: any; onClose: () => void }) {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const classId = /^(?:Created|Updated) class (.+)$/.exec(activity.action)?.[1];
  const relatedClass = classes.find(item => item.id === classId);
  const namedActors = users.filter(user => user.name === activity.by);
  const actor = namedActors.length === 1 ? namedActors[0] : undefined;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([adminService.getClasses(), adminService.getUsers()]).then(([classResult, userResult]) => {
      if (cancelled) return;
      if (classResult.status === "fulfilled") setClasses(classResult.value);
      if (userResult.status === "fulfilled") setUsers(userResult.value);
      if (classResult.status === "rejected" || userResult.status === "rejected") setError("Some related information could not be loaded.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <div className="admin-overview-details">
    <div className="admin-overview-panel-header"><h2>Activity details</h2><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    <h3 className="admin-detail-title">{activity.action}</h3>
    <dl className="teacher-list-detail-facts">
      <div><dt>Performed by</dt><dd>{activity.by || "System"}</dd></div>
      <div><dt>Time</dt><dd>{activity.time ? parseServerDateTime(activity.time).toLocaleString() : "Unknown"}</dd></div>
    </dl>
    {loading ? <Loading label="Loading related information…" /> : <>
      {error && <p className="admin-warning" role="alert">{error}</p>}
      {classId && <>
        <div className="admin-detail-divider" />
        <h3 className="admin-subheading">Current class information</h3>
        {relatedClass ? <dl className="teacher-list-detail-facts">
          <div><dt>Class code</dt><dd>{relatedClass.id}</dd></div>
          <div><dt>Course</dt><dd>{relatedClass.course}</dd></div>
          <div><dt>Semester</dt><dd>{relatedClass.semester || "—"}</dd></div>
          <div><dt>Lecturer</dt><dd>{relatedClass.lecturer}</dd></div>
          <div><dt>Students</dt><dd>{relatedClass.students}</dd></div>
          <div><dt>Status</dt><dd>{relatedClass.status}</dd></div>
          <div><dt>Dates</dt><dd>{relatedClass.startDate && relatedClass.endDate ? relatedClass.startDate + " – " + relatedClass.endDate : "Not specified"}</dd></div>
        </dl> : <p className="admin-muted">Class {classId}: current information is unavailable.</p>}
        <p className="admin-muted admin-overview-context-note">Class information reflects its current state. This activity record does not contain the previous field values.</p>
      </>}
      {actor && <>
        <div className="admin-detail-divider" /><h3 className="admin-subheading">Current account information</h3>
        <dl className="teacher-list-detail-facts"><div><dt>Email</dt><dd>{actor.email}</dd></div><div><dt>Role</dt><dd>{actor.role}</dd></div><div><dt>Status</dt><dd>{actor.status}</dd></div><div><dt>Joined</dt><dd>{actor.joined}</dd></div>{actor.detail && <div><dt>Department</dt><dd>{actor.detail}</dd></div>}</dl>
      </>}
    </>}
    <details className="admin-overview-record-reference"><summary>Record reference</summary><p className="admin-muted">{activity.id}</p></details>
  </div>;
}

function OverviewUnassignedClassesPanel({ onClose }: { onClose: () => void }) {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selected = classes.find(item => item.id === selectedId) || classes[0];

  async function loadClasses() {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getClasses();
      const unassigned = data.filter(item => item.status !== "Archived" && item.lecturer === "Unassigned");
      setClasses(unassigned);
      setSelectedId(unassigned[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadClasses(); }, []);

  return <div className="admin-overview-details">
    <div className="admin-overview-panel-header"><h2>Classes without a lecturer</h2><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {loading ? <Loading label="Loading classes…" /> : error ? <><p className="admin-warning" role="alert">{error}</p><button type="button" className="button admin-button" onClick={() => void loadClasses()}>Retry</button></> : selected ? <>
      <Field label={"UNASSIGNED CLASSES (" + classes.length + ")"}><select value={selected.id} onChange={event => setSelectedId(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.id} · {item.course}</option>)}</select></Field>
      <div className="admin-detail-divider" />
      <h3 className="admin-detail-title">{selected.id}</h3>
      <dl className="teacher-list-detail-facts">
        <div><dt>Course</dt><dd>{selected.course}</dd></div>
        <div><dt>Semester</dt><dd>{selected.semester || "—"}</dd></div>
        <div><dt>Status</dt><dd>{selected.status}</dd></div>
        <div><dt>Lecturer</dt><dd className="admin-warning">Unassigned</dd></div>
        <div><dt>Students</dt><dd>{selected.students}</dd></div>
        <div><dt>Dates</dt><dd>{selected.startDate && selected.endDate ? selected.startDate + " – " + selected.endDate : selected.dates || "—"}</dd></div>
      </dl>
    </> : <p className="admin-muted">All classes have an assigned lecturer.</p>}
  </div>;
}

export function AdminOverviewPage() {
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState({ users: 0, classes: 0, pendingRequests: 0, unassignedClasses: 0, submissionsToday: 0, gradingErrors: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [attentionPage, setAttentionPage] = useState(1);
  const [selection, setSelection] = useState<{ type: "attention" | "activity"; id: string } | null>(null);
  const selectedActivity = selection?.type === "activity" ? activities.find(item => item.id === selection.id) : undefined;
  const [activityPage, setActivityPage] = useState(1);
  const pageSize = 10;
  const attentionItems = [
    { id: "registrations", title: "Lecturer registrations", count: stats.pendingRequests, unit: "pending" },
    { id: "unassigned", title: "Classes without a lecturer", count: stats.unassignedClasses, unit: "class(es)" },
  ];
  const currentAttentionPage = Math.min(attentionPage, Math.max(1, Math.ceil(attentionItems.length / pageSize)));
  const currentActivityPage = Math.min(activityPage, Math.max(1, Math.ceil(activities.length / pageSize)));
  const visibleAttention = attentionItems.slice((currentAttentionPage - 1) * pageSize, currentAttentionPage * pageSize);
  const visibleActivities = activities.slice((currentActivityPage - 1) * pageSize, currentActivityPage * pageSize);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminService.getOverviewStats(),
      adminService.getActivities(),
      adminService.getErrors()
    ]).then(([statsData, activitiesData, errorsData]) => {
      setStats({
        users: statsData.users,
        classes: statsData.classes,
        pendingRequests: statsData.pendingRequests,
        unassignedClasses: statsData.unassignedClasses,
        submissionsToday: statsData.submissionsToday,
        gradingErrors: statsData.gradingErrors
      });
      setActivities(activitiesData);
      setErrors(errorsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setNotice("Failed to load overview data.");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}><h1 className="sr-only">System overview</h1><Loading label="Loading overview…" /></div>;
  }
  if (notice) return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}><h1 className="sr-only">System overview</h1><p className="admin-notice" role="alert">{notice}</p></div>;

  return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}>
    <h1 className="sr-only">System overview</h1>
    <Split className="admin-overview-split" main={<>
      <section className="admin-attention">
        <div className="admin-overview-table-heading">
          <h2 className="admin-section-heading">Needs attention</h2>
          <div className="admin-overview-table-controls">
            <span className="admin-muted" role="status">Showing {attentionItems.length === 0 ? 0 : (currentAttentionPage - 1) * pageSize + 1}–{Math.min(currentAttentionPage * pageSize, attentionItems.length)} of {attentionItems.length.toLocaleString()} items</span>
            <OverviewPagination total={attentionItems.length} page={currentAttentionPage} onPageChange={setAttentionPage} label="Needs attention pages" />
          </div>
        </div>
        <div className="compact-table-scroll" role="region" aria-label="Needs attention table" tabIndex={0}>
        <table className="admin-table admin-attention-table"><thead><tr><th>ITEM</th><th>COUNT</th></tr></thead><tbody>
          {visibleAttention.map(item => {
            const isSelected = selection?.type === "attention" && selection.id === item.id;
            const selectRow = () => setSelection({ type: "attention", id: item.id });
            return <tr key={item.id} className={isSelected ? "is-selected" : ""} onClick={selectRow}>
              <td data-label="ITEM"><button type="button" className="admin-overview-row-button" aria-pressed={isSelected} onClick={selectRow}>{item.title}</button></td>
              <td data-label="COUNT" className={item.count > 0 ? "admin-warning" : ""}>{item.count} {item.unit}</td>
            </tr>;
          })}
        </tbody></table>
        </div>
      </section>
      <section className="admin-recent-activity">
        <div className="admin-overview-table-heading">
          <h2 className="admin-section-heading">Recent activity</h2>
          <div className="admin-overview-table-controls">
            <span className="admin-muted" role="status">Showing {activities.length === 0 ? 0 : (currentActivityPage - 1) * pageSize + 1}–{Math.min(currentActivityPage * pageSize, activities.length)} of {activities.length.toLocaleString()} items</span>
            <OverviewPagination total={activities.length} page={currentActivityPage} onPageChange={setActivityPage} label="Recent activity pages" />
          </div>
        </div>
        <div className="compact-table-scroll" role="region" aria-label="Recent activity table" tabIndex={0}>
        <table className="admin-table admin-activity-table"><thead><tr><th>ACTION</th><th>BY</th><th>TIME</th></tr></thead><tbody>
          {activities.length > 0 ? visibleActivities.map(item => {
            const isSelected = selection?.type === "activity" && selection.id === item.id;
            const selectRow = () => setSelection({ type: "activity", id: item.id });
            return <tr key={item.id} className={isSelected ? "is-selected" : ""} onClick={selectRow}>
              <td><button type="button" className="admin-overview-row-button" aria-pressed={isSelected} onClick={selectRow}>{item.action}</button></td><td>{item.by}</td><td>{item.time ? localTime(item.time) : "Unknown"}</td>
            </tr>;
          }) : <tr><td colSpan={3} className="admin-muted">No recent activity</td></tr>}
        </tbody></table>
        </div>
      </section>
    </>} side={selection?.type === "attention" && selection.id === "registrations" ? <OverviewLecturerApprovalsPanel onClose={() => setSelection(null)} onResolved={pendingCount => {
      setStats(current => ({ ...current, pendingRequests: pendingCount }));
      adminService.getActivities().then(setActivities).catch(console.error);
    }} /> : selection?.type === "attention" && selection.id === "unassigned" ? <OverviewUnassignedClassesPanel onClose={() => setSelection(null)} /> : selectedActivity ? <OverviewActivityPanel key={selectedActivity.id} activity={selectedActivity} onClose={() => setSelection(null)} /> : <>
      <h2>Grading health</h2><p className={stats.gradingErrors === 0 ? "admin-health" : "admin-health admin-warning"}>{stats.gradingErrors === 0 ? "Operational" : "Needs Attention"}</p><p className="admin-muted">{stats.submissionsToday} submitted today / {stats.gradingErrors} need attention</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Recent errors</h3>
      {errors.length > 0 ? errors.map(err => <p key={err.id} className="admin-warning admin-error">#{err.id.substring(0, 8)} · {err.errorType}<br />{err.problemTitle}</p>) : <p className="admin-muted">No errors recently</p>}
    </>} />
  </div>;
}
