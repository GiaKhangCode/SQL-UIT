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
import { studentApi } from "../../services/studentApi";
import { academicTerms } from "../../utils/academicTerms";

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

export function AdminUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [confirmDeactivation, setConfirmDeactivation] = useState<AdminUser | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
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
    const state = location.state as { selectedEmail?: string; notice?: string } | null;
    if (state?.selectedEmail) setSelectedEmail(state.selectedEmail);
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state]);

  useEffect(() => {
    setPendingRole(null);
  }, [selectedEmail]);

  const filtered = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "All roles" || user.role === roleFilter) && (statusFilter === "All statuses" || user.status === statusFilter);
  }), [users, query, roleFilter, statusFilter]);
  const selected = filtered.find((user) => user.email === selectedEmail) || filtered[0];

  async function handleUpdateRole(userToUpdate: AdminUser, newRole: string) {
    try {
      const updated = await adminService.updateUser(userToUpdate.email, { ...userToUpdate, role: newRole });
      setUsers(all => all.map(u => u.email === updated.email ? updated : u));
    } catch (err: any) {
      setNotice(err.message || "Failed to update role");
    }
  }

  async function handleToggleStatus(userToUpdate: AdminUser) {
    const newStatus = userToUpdate.status === "Inactive" ? "Active" : "Inactive";
    setStatusBusy(true);
    setStatusError("");
    try {
      const updated = await adminService.updateUser(userToUpdate.email, { ...userToUpdate, status: newStatus });
      setUsers(all => all.map(u => u.email === updated.email ? updated : u));
      setConfirmDeactivation(null);
      setNotice(`${updated.name} is now ${updated.status.toLowerCase()}.`);
    } catch (err: any) {
      const message = err.message || "Failed to update status";
      setStatusError(message);
      setNotice(message);
    } finally {
      setStatusBusy(false);
    }
  }

  function exportCsv() {
    const csv = ["Name,Email,Role,Status", ...users.map((u) => [u.name, u.email, u.role, u.status].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "querylab-users.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function requestStatusChange(userToUpdate: AdminUser) {
    if (userToUpdate.status === "Inactive") {
      void handleToggleStatus(userToUpdate);
      return;
    }
    setStatusError("");
    setConfirmDeactivation(userToUpdate);
  }
  if (loading) return <div className="admin-page"><Loading label="Loading users…" /></div>;
  if (loadError) return <div className="admin-page"><PageIntro title="Users" sub="People & access" /><ErrorState title="Could not load users" message={loadError} onRetry={() => window.location.reload()} /></div>;
  return <div className="admin-page">
    <PageIntro title="Users" sub={`People & access / ${users.length.toLocaleString()} accounts`}>
      <button className="button admin-button" onClick={exportCsv} disabled={users.length === 0}>Export all CSV</button><button className="button primary admin-button" onClick={() => setDialog(true)}>Add user</button>
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
      {filtered.length === 0 && <Empty title={users.length === 0 ? "No accounts yet" : "No matching accounts"}>{users.length === 0 ? "Add a user to get started." : "Try a different search or filter."}</Empty>}
      <p className="admin-table-footer">Showing {filtered.length} of {users.length.toLocaleString()} accounts</p>
    </>} side={selected ? <>
      <h2>Account details</h2><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label="ROLE"><select value={pendingRole ?? selected.role} onChange={(e) => setPendingRole(e.target.value)}><option>Student</option><option>Lecturer</option><option>Admin</option></select></Field>
      {pendingRole && pendingRole !== selected.role && (
        <button className="button primary admin-button" style={{ marginBottom: "1rem" }} onClick={() => { handleUpdateRole(selected, pendingRole); setPendingRole(null); }}>Save role</button>
      )}
      <p className={selected.status === "Active" ? "admin-success admin-detail-status" : "admin-warning admin-detail-status"}>{selected.status} · Joined {selected.joined}</p><p className="admin-muted">{selected.detail}</p>
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/users/${encodeURIComponent(selected.email)}/edit`}>Edit account</Link></div>
      <div className="admin-detail-divider" /><button className="admin-danger-link" disabled={statusBusy} onClick={() => requestStatusChange(selected)}>{selected.status === "Inactive" ? "Reactivate account" : "Deactivate account"}</button><p className="admin-muted">Blocks future sign-in. Existing classes and submissions are retained.</p>
    </> : <><h2>Account details</h2><p className="admin-muted">Select an account to review its access.</p></>} />
    {dialog && <AddUserDialog onClose={() => setDialog(false)} onAdd={(user) => { setUsers((all) => [...all, user]); setSelectedEmail(user.email); setDialog(false); setNotice(`${user.name} was added successfully.`); }} />}
    {confirmDeactivation && <Dialog title="Deactivate account" onClose={() => { if (!statusBusy) setConfirmDeactivation(null); }} className="admin-dialog">
      <div className="admin-dialog-form">
        <p>Deactivate <strong>{confirmDeactivation.name}</strong> ({confirmDeactivation.email})? They will no longer be able to sign in. Their classes and submissions will be retained.</p>
        {statusError && <p className="admin-warning" role="alert">{statusError}</p>}
        <div className="admin-dialog-actions"><button type="button" className="button" disabled={statusBusy} onClick={() => setConfirmDeactivation(null)}>Cancel</button><button type="button" className="button admin-reject-button" disabled={statusBusy} onClick={() => void handleToggleStatus(confirmDeactivation)}>{statusBusy ? "Deactivating…" : "Deactivate account"}</button></div>
      </div>
    </Dialog>}
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
  if (loadError) return <div className="admin-page"><PageIntro title="Could not load account" sub="People & access" /><Notice>{loadError}</Notice><Link className="button admin-button" to="/admin/users">Back to users</Link></div>;
  if (!currentUser) return <div className="admin-page"><PageIntro title="Account not found" sub="People & access" /><p className="admin-muted">This account may have been removed or its email has changed.</p><Link className="button admin-button" to="/admin/users">Back to users</Link></div>;

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
        <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/users">Cancel</Link><button className="button primary admin-button" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
      </form>
      <aside className="admin-edit-access"><h2>Access management</h2><p className="admin-muted">Account status and role are saved with the profile. Password reset is unavailable in this interface.</p><p><strong>{currentUser.email}</strong></p></aside>
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

  return <div className="admin-page">
    <PageIntro title="Users" sub={`People & access / ${requests.length} pending lecturer requests`} />
    <div className="admin-section-tabs">
      <Link to="/admin/users">All users</Link>
      <Link className="active" to="/admin/users/approvals">Lecturer approvals ({requests.length})</Link>
    </div>
    {notice && <Notice>{notice}</Notice>}
    {loading ? <Loading label="Loading lecturer requests…" /> : loadError ? <p className="admin-notice" role="alert">{loadError}</p> :
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
  return <div className="admin-page">
    <PageIntro title="Roles & permissions" sub="Illustrative role guide · read only" />
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-permissions-table"><thead><tr><th>CAPABILITY</th><th>STUDENT</th><th>LECTURER</th><th>ADMIN</th></tr></thead><tbody>{adminCapabilities.map(({ key, label }) => <tr key={key}><td data-label="CAPABILITY">{label}</td>{(["Student", "Lecturer", "Admin"] as const).map((role) => {
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

function CourseDialog({ onClose, onCreate, lecturers, error, busy }: { onClose: () => void; onCreate: (id: string, course: string, term: string, lecturer: string, startDate: string, endDate: string) => void; lecturers: string[]; error: string; busy: boolean }) {
  const [newClassForm, setNewClassForm] = useState({
    id: "",
    course: "",
    term: "",
    lecturer: "Unassigned",
    startDate: "",
    endDate: ""
  });

  return (
    <Dialog title="Create a new class" onClose={onClose}>
      <form className="teacher-manage-dialog" onSubmit={(e) => { e.preventDefault(); if (newClassForm.id.trim()) onCreate(newClassForm.id.trim(), newClassForm.course, newClassForm.term, newClassForm.lecturer, newClassForm.startDate, newClassForm.endDate); }}>
        <p className="tiny muted">Set up a new class or section</p>
        
        <label className="teacher-field" style={{ marginTop: "1rem" }}>
          <span>CLASS ID</span>
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
        
        <label className="teacher-field">
          <span>LECTURER</span>
          <select value={newClassForm.lecturer} onChange={e => setNewClassForm({...newClassForm, lecturer: e.target.value})}>
             <option value="Unassigned">Unassigned</option>
             {lecturers.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <label className="teacher-field" style={{ flex: 1, marginTop: 0 }}>
            <span>START DATE</span>
            <input required type="date" value={newClassForm.startDate} onChange={e => setNewClassForm({...newClassForm, startDate: e.target.value})} />
          </label>
          <label className="teacher-field" style={{ flex: 1, marginTop: 0 }}>
            <span>END DATE</span>
            <input required type="date" value={newClassForm.endDate} onChange={e => setNewClassForm({...newClassForm, endDate: e.target.value})} />
          </label>
        </div>
        
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
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState("All semesters");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lecturers, setLecturers] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      adminService.getClasses(),
      adminService.getUsers()
    ]).then(([classesData, users]) => {
      setClasses(classesData);
      if (classesData.length > 0 && !selectedId) {
        setSelectedId(classesData[0].id);
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer").map((user: any) => user.name));
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes.")).finally(() => setLoading(false));
  }, []);

  const selected = classes.find((item) => item.id === selectedId) || null;
  
  useEffect(() => {
    const state = location.state as { selectedId?: string; notice?: string } | null;
    if (state?.selectedId) setSelectedId(state.selectedId);
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state]);

  const visible = classes.filter((item) =>
    `${item.course} ${item.id} ${item.lecturer}`.toLowerCase().includes(query.toLowerCase()) &&
    (semester === "All semesters" || item.semester === semester));
  const semesters = [...new Set(classes.map((item) => item.semester).filter(Boolean))].sort().reverse();

  if (loading) return <div className="admin-page"><Loading label="Loading courses and classes…" /></div>;
  if (loadError) return <div className="admin-page"><PageIntro title="Courses & classes" sub="Academic structure" /><ErrorState title="Could not load courses" message={loadError} onRetry={() => window.location.reload()} /></div>;

  return <div className="admin-page">
    <PageIntro title="Courses & classes" sub="Academic structure / Manage class rosters and access"><button className="button primary admin-button" onClick={() => { setCreateError(""); setDialog(true); }}>Add class</button></PageIntro>
    <div className="admin-course-filters"><Field label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}><option>All semesters</option>{semesters.map((term) => <option key={term}>{term}</option>)}</select></Field><Field label="SEARCH"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course or class..." /></Field></div>{loadError && <Notice>{loadError}</Notice>}{notice && <Notice>{notice}</Notice>}
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-course-table"><thead><tr><th>COURSE / CLASS</th><th>LECTURER</th><th>STUDENTS</th><th>STATUS</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><td data-label="COURSE / CLASS"><button className="admin-row-link" onClick={() => setSelectedId(item.id)}>{item.course}</button><small>{item.id}</small></td><td data-label="LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STUDENTS">{item.students}</td><td data-label="STATUS" className={item.status === "Active" ? "admin-success" : "admin-warning"}>{item.status}</td></tr>)}</tbody></table>{!loadError && classes.length === 0 && <p className="admin-table-footer">No classes yet. Add a class to get started.</p>}{!loadError && classes.length > 0 && visible.length === 0 && <p className="admin-table-footer">No classes match these filters.</p>}</div>} side={selected ? <>
      <h2>{selected.id}</h2><h3 className="admin-detail-title">{selected.course.split(" · ")[1] || selected.course}</h3><p className={selected.status === "Active" ? "admin-success" : "admin-warning"}>{selected.status}{selected.lecturer === "Unassigned" ? " · Lecturer needed" : ""}</p><div className="admin-detail-divider" />
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
      <div className="admin-button-stack"><Link className="button primary admin-button" to="/admin/courses/lecturers" state={{ selectedId: selected.id }}>Assign lecturer</Link><Link className="button admin-button" to={`/admin/courses/classes/${encodeURIComponent(selected.id)}/edit`}>Edit class</Link></div><div className="admin-detail-divider" />
      <button className="admin-danger-link" onClick={async () => { 
        const status = selected.status === "Archived" ? "Active" : "Archived"; 
        try {
          const res = await adminService.updateClass(selected.id, { status });
          setClasses((all) => all.map((item) => item.id === selected.id ? res : item));
          setNotice(`${selected.id} ${status === "Archived" ? "archived" : "restored"}.`);
        } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update class."); }
      }}>{selected.status === "Archived" ? "Restore class" : "Archive class"}</button>
    </> : <h2>Class details</h2>} />
    {dialog && <CourseDialog lecturers={lecturers} error={createError} busy={creating} onClose={() => setDialog(false)} onCreate={async (id, course, term, lecturer, startDate, endDate) => {
      if (classes.some((item) => item.id.toLowerCase() === id.toLowerCase())) { setCreateError(`A class with ID ${id} already exists.`); return; }
      if (endDate < startDate) { setCreateError("End date must be after the start date."); return; }
      setCreating(true);
      setCreateError("");
      try {
        const item = await adminService.createClass({ id, course, semester: term, lecturerName: lecturer, startDate: startDate, endDate: endDate });
        setClasses((all) => [...all, item]); setSelectedId(id); setDialog(false); setNotice(`${id} was added.`);
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
  const [lecturers, setLecturers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        setLecturer(cls.lecturer);
        setStatus(cls.status as AdminClass["status"]);
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer").map((user: any) => user.name));
      setLoading(false);
    }).catch((error) => { setLoadError(error instanceof Error ? error.message : "Could not load class details."); setLoading(false); });
  }, [classId]);

  if (loading) return <div className="admin-page"><PageIntro title="Edit class" sub="Courses & classes" /><Loading label="Loading class details…" /></div>;
  if (loadError) return <div className="admin-page"><PageIntro title="Class unavailable" sub="Courses & classes" /><Notice>{loadError}</Notice><Link className="button admin-button" to="/admin/courses">Back to courses</Link></div>;
  if (!record) return <div className="admin-page"><PageIntro title="Class not found" sub="Courses & classes" /><p className="admin-muted">This class may have been removed.</p><Link className="button admin-button" to="/admin/courses">Back to courses</Link></div>;
  
  const currentRecord = record;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!startDate.trim() || !endDate.trim()) { setNotice("Class dates are required."); return; }
    if (endDate < startDate) { setNotice("End date must be after the start date."); return; }
    setSaving(true);
    setNotice("");
    try {
      await adminService.updateClass(currentRecord.id, { course, semester, lecturerName: lecturer, status, startDate, endDate });
      navigate("/admin/courses", { state: { selectedId: currentRecord.id, notice: `${currentRecord.id} class details saved.` } });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save class details.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-page">
    <PageIntro title="Edit class" sub={`Courses & classes / ${currentRecord.id}`}><Link className="button admin-button" to="/admin/courses">Back to courses</Link></PageIntro>
    <form className="admin-edit-form admin-class-form" onSubmit={save}>
      <h2>Class details</h2><p className="admin-muted">Update the course, term, instructor, and enrollment status for this class.</p>
      <Field label="CLASS ID"><input value={currentRecord.id} readOnly /><small className="admin-muted">Class IDs stay fixed so existing student work keeps its link.</small></Field>
      <Field label="COURSE"><input value={course} onChange={(event) => setCourse(event.target.value)} /></Field>
      <Field label="SEMESTER"><select value={semester} onChange={(event) => setSemester(event.target.value)}>
        {academicTerms(semester).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select></Field>
      <Field label="LECTURER"><select value={lecturer} onChange={(event) => setLecturer(event.target.value)}><option>Unassigned</option>{Array.from(new Set([...lecturers, record.lecturer].filter((name) => name !== "Unassigned"))).map((name) => <option key={name}>{name}</option>)}</select></Field>
      <Field label="CLASS STATUS"><select value={status} onChange={(event) => setStatus(event.target.value as AdminClass["status"])}><option>Draft</option><option>Active</option><option>Archived</option></select></Field>
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}><Field label="START DATE"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field></div>
        <div style={{ flex: 1 }}><Field label="END DATE"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></Field></div>
      </div>
      <p className="admin-muted">{currentRecord.students} enrolled student{currentRecord.students === 1 ? "" : "s"}. Archiving keeps rosters and submissions available to admins.</p>
      {notice && <Notice>{notice}</Notice>}
      <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/courses">Cancel</Link><button className="button primary admin-button" disabled={saving}>{saving ? "Saving…" : "Save class"}</button></div>
    </form>
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
  const [lecturers, setLecturers] = useState<string[]>([]);
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
        setLecturer(sorted[0].lecturer);
      } else if (selectedId) {
        const cls = sorted.find(c => c.id === selectedId);
        if (cls) setLecturer(cls.lecturer);
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer").map((user: any) => user.name));
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes and lecturers.")).finally(() => setLoading(false));
  }, []);

  const selected = assignments.find((item) => item.id === selectedId);

  return <div className="admin-page">
    <PageIntro title="Lecturer assignment" sub={`Class ownership / ${selected?.semester || ""}`}>
      <button className="button primary admin-button" disabled={!selected || saving || lecturer === selected.lecturer} onClick={async () => {
        if (!selected) return;
        setSaving(true);
        setNotice("");
        try {
          const updated = await adminService.updateClass(selectedId, { lecturer_name: lecturer });
          setAssignments((all) => all.map((item) => item.id === selectedId ? updated : item));
          setNotice(`${lecturer} assigned to ${selectedId}.`);
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Could not assign lecturer.");
        } finally {
          setSaving(false);
        }
      }}>{saving ? "Saving…" : "Save assignment"}</button>
    </PageIntro>{notice && <Notice>{notice}</Notice>}
    {loading ? <Loading label="Loading classes and lecturers…" /> : loadError ? <p className="admin-notice" role="alert">{loadError}</p> : assignments.length === 0 ? <p className="admin-muted">No classes are available for lecturer assignment.</p> :
    <Split main={<div className="admin-table-wrap"><table className="admin-table admin-lecturer-table"><thead><tr><th>CLASS</th><th>CURRENT LECTURER</th><th>STATUS</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setLecturer(item.lecturer); }}><td data-label="CLASS"><b>{item.id}</b></td><td data-label="CURRENT LECTURER" className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label="STATUS">{item.lecturer === "Unassigned" ? "Needs lecturer" : "Assigned"}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>Assign {selected.id}</h2><p className="admin-muted">{selected.course.split(" · ")[1] || selected.course} · {selected.semester} · {selected.students} student{selected.students === 1 ? "" : "s"}</p><Field label="LECTURER"><select value={lecturer} onChange={(e) => setLecturer(e.target.value)}>{Array.from(new Set([...lecturers, "Unassigned"])).map((name) => <option key={name}>{name}</option>)}</select></Field><div className="admin-detail-divider" /><h3 className="admin-subheading">Access preview</h3><p className="admin-muted">The selected lecturer can manage assignments, view class results and review submissions after assignment is saved.</p>
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
  const [activeTab, setActiveTab] = useState<"Problems" | "Topics">("Problems");
  const [query, setQuery] = useState("");
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

  const selected = problems.find((problem) => problem.id === selectedId) || problems[0];
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
    `${problem.title} ${problem.topics}`.toLowerCase().includes(query.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (visibility === "All" || problem.status === visibility)), [problems, query, difficulty, visibility]);

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

  if (loading) {
    return <div className="admin-page"><Loading label="Loading catalog…" /></div>;
  }
  if (catalogError) return <div className="admin-page"><PageIntro title="Practice catalog" sub="Shared SQL problems" /><ErrorState title="Could not load catalog" message={catalogError} onRetry={() => window.location.reload()} /></div>;

  return <div className="admin-page">
    <PageIntro title="Practice catalog" sub={`${problems.filter(p => p.status === "Visible").length} public problem${problems.filter(p => p.status === "Visible").length === 1 ? "" : "s"} · Catalog view`} />
    <div className="admin-section-tabs" role="tablist" aria-label="Practice catalog sections">
      <button type="button" role="tab" aria-selected={activeTab === "Problems"} className={activeTab === "Problems" ? "active" : ""} onClick={() => setActiveTab("Problems")}>Problems ({problems.length})</button>
      <button type="button" role="tab" aria-selected={activeTab === "Topics"} className={activeTab === "Topics" ? "active" : ""} onClick={() => setActiveTab("Topics")}>Topics ({computedTopics.length})</button>
    </div>
    {notice && <Notice>{notice}</Notice>}
    {activeTab === "Problems" && <div className="admin-practice-filters">
      <Field label="SEARCH"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or topic..." /></Field>
      <Field label="DIFFICULTY"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All levels</option><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
      <Field label="VISIBILITY"><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>All</option><option>Visible</option><option>Hidden</option></select></Field>
    </div>}
    <Split className="admin-practice-split" main={activeTab === "Problems" ? <div className="admin-table-wrap"><table className="admin-table admin-practice-table"><thead><tr><th>PROBLEM</th><th>TOPICS</th><th>DIFFICULTY</th><th>SOLVED BY</th><th>STATUS</th></tr></thead><tbody>
      {list.map((problem) => <tr key={problem.id} className={problem.id === selected?.id ? "is-selected" : ""} onClick={() => setSelectedId(problem.id)}>
        <td data-label="PROBLEM"><button className="admin-row-link" type="button" onClick={() => setSelectedId(problem.id)}>{problem.title}</button></td><td data-label="TOPICS">{problem.topics}</td><td data-label="DIFFICULTY">{problem.difficulty}</td><td data-label="SOLVED BY">{problem.solvedBy}</td><td data-label="STATUS" className={problem.status === "Visible" ? "admin-success" : ""}>{problem.status}</td>
      </tr>)}
      {!list.length && <tr><td colSpan={5} className="admin-muted">No practice problems match these filters.</td></tr>}
    </tbody></table></div> : <div className="admin-table-wrap"><table className="admin-table admin-practice-topic-table"><thead><tr><th>TOPIC</th><th>PROBLEMS</th></tr></thead><tbody>{computedTopics.map((topic) => <tr key={topic.name} onClick={() => { setQuery(topic.name); setActiveTab("Problems"); }}><td data-label="TOPIC"><button className="admin-row-link" type="button" onClick={() => { setQuery(topic.name); setActiveTab("Problems"); }}>{topic.name}</button></td><td data-label="PROBLEMS">{topic.problems}</td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2>Practice details</h2><h3 className="admin-detail-title">{selected.title}</h3><p className="admin-muted">{selected.published === "—" ? "Publish date unavailable" : `Updated ${selected.published}`}</p><p className="admin-accent">{selected.difficulty} · {selected.topics} · {selected.database}</p>
      <div className="admin-detail-divider" /><dl className="teacher-list-detail-facts"><div><dt>Visibility</dt><dd>{selected.status}</dd></div><div><dt>Attempts</dt><dd>{selected.attempted}</dd></div><div><dt>Acceptance</dt><dd>{selected.attempted ? `${selected.acceptance}%` : "—"}</dd></div><div><dt>Submissions</dt><dd>{selected.submissions}</dd></div></dl>
      <p className="admin-muted">Catalog settings are currently read only. A server API is needed to change visibility or featured status.</p>
      <div className="admin-practice-actions"><button className="button admin-button" type="button" disabled={previewBusy} onClick={() => void openPreview(selected)}>{previewBusy ? "Loading preview…" : "Preview problem"}</button></div>
    </> : <><h2>Practice details</h2><p className="admin-muted">Select a problem to manage its Practice listing.</p></>} />
    {previewing && <PracticePreviewDialog problem={previewing} onClose={() => setPreviewing(null)} />}
  </div>;
}

export function AdminOverviewPage() {
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState({ users: 0, classes: 0, pendingRequests: 0, unassignedClasses: 0, submissionsToday: 0, gradingErrors: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
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
    return <div className="admin-page"><Loading label="Loading overview…" /></div>;
  }
  if (notice) return <div className="admin-page"><PageIntro title="System overview" sub="Activity & service health" /><p className="admin-notice" role="alert">{notice}</p></div>;

  return <div className="admin-page">
    <PageIntro title="System overview" sub="Activity & service health" />
    <div className="admin-metrics"><div><strong>{stats.users.toLocaleString()}</strong><small>Total users</small></div><div><strong>{stats.classes}</strong><small>Active classes</small></div><div><strong>{stats.submissionsToday.toLocaleString()}</strong><small>Submissions today</small></div><div><strong className={stats.gradingErrors > 0 ? "admin-warning" : ""}>{stats.gradingErrors}</strong><small>Grading errors</small></div></div>
    <Split main={<>
      <section className="admin-attention">
        <h2 className="admin-section-heading">Needs attention</h2>
        <table className="admin-table admin-attention-table"><thead><tr><th>ITEM</th><th>COUNT</th><th>ACTION</th></tr></thead><tbody>
          <tr><td data-label="ITEM">Lecturer registrations</td><td data-label="COUNT" className={stats.pendingRequests > 0 ? "admin-warning" : ""}>{stats.pendingRequests} pending</td><td data-label="ACTION"><Link to="/admin/users/approvals">Review approvals →</Link></td></tr>
          <tr><td data-label="ITEM">Classes without a lecturer</td><td data-label="COUNT" className={stats.unassignedClasses > 0 ? "admin-warning" : ""}>{stats.unassignedClasses} class(es)</td><td data-label="ACTION"><Link to="/admin/courses/lecturers">Assign lecturer →</Link></td></tr>
        </tbody></table>
      </section>
      <section className="admin-recent-activity">
        <h2 className="admin-section-heading">Recent activity</h2>
        <table className="admin-table admin-activity-table"><thead><tr><th>ACTION</th><th>BY</th><th>TIME</th></tr></thead><tbody>
          {activities.length > 0 ? activities.map((item) => <tr key={item.id}><td>{item.action}</td><td>{item.by}</td><td>{item.time}</td></tr>) : <tr><td colSpan={3} className="admin-muted">No recent activity</td></tr>}
        </tbody></table>
      </section>
    </>} side={<>
      <h2>Grading health</h2><p className={stats.gradingErrors === 0 ? "admin-health" : "admin-health admin-warning"}>{stats.gradingErrors === 0 ? "Operational" : "Needs Attention"}</p><p className="admin-muted">{stats.submissionsToday} submitted today / {stats.gradingErrors} need attention</p><div className="admin-detail-divider" /><h3 className="admin-subheading">Recent errors</h3>
      {errors.length > 0 ? errors.map(err => <p key={err.id} className="admin-warning admin-error">#{err.id.substring(0, 8)} · {err.errorType}<br />{err.problemTitle}</p>) : <p className="admin-muted">No errors recently</p>}
    </>} />
  </div>;
}
