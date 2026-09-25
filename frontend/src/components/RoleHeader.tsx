import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

type Role = "student" | "teacher" | "admin";
const links: Record<Role, [string, string][]> = {
  student: [["Dashboard", "/dashboard"], ["Practice", "/practice"], ["Assignments", "/assignments"], ["Contests", "/contests"], ["Submissions", "/submissions"]],
  teacher: [["Problems", "/teacher/problems"], ["Assignments", "/teacher/assignments"], ["Contests", "/teacher/contests"], ["Classes", "/teacher/classes"], ["Results", "/teacher/results"]],
  admin: [["Overview", "/admin/overview"], ["Users", "/admin/users"], ["Courses", "/admin/courses"], ["Practice", "/admin/practice"], ["Roles", "/admin/roles"]],
};

export function RoleHeader({ role, workspace }: { role: Role; workspace?: { title: string; number: string; topic: string; source?: string; context?: string; backTo?: string } }) {
  const { session, logout } = useAuth();
  const { dark, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    accountRef.current?.querySelector<HTMLButtonElement>("#role-account-menu button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAccountOpen(false); accountButton.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [accountOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  const home = links[role][0][1];
  return <header className={`global-header role-header role-${role}${workspace ? " workspace-header" : ""}`}>
    <Link className="brand" to={home} aria-label="QueryLab home"><img src="/assets/database.svg" width="20" height="20" alt="" /></Link>
    {workspace ? <><Link className="back-link" to={workspace.backTo || "/practice"}>← {workspace.source || "Practice"}</Link><div className="workspace-identity"><b>{workspace.number}. {workspace.title}</b><small>{workspace.source || "Practice"} / {workspace.context || workspace.topic}</small></div></> : <>
      <button type="button" className="mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls={`${role}-navigation`} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? "Close" : "Menu"}</button>
      <nav id={`${role}-navigation`} className={menuOpen ? "open" : ""} aria-label={`${role} navigation`}>
        {links[role].map(([label, path]) => <NavLink key={path} to={path} className={({ isActive }) => isActive || location.pathname.startsWith(path + "/") ? "active" : undefined} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}
      </nav>
    </>}
    <div className="role-account" ref={accountRef}>
      <button ref={accountButton} type="button" className="account-trigger" aria-label={`${role} account and appearance`} aria-expanded={accountOpen} aria-controls="role-account-menu" onClick={() => setAccountOpen(value => !value)}>
        <span className="avatar">{session?.initials || "?"}</span><span className="account-identity"><b>{session?.name || "Account"}</b><small>{role === "teacher" ? "Lecturer" : role[0].toUpperCase() + role.slice(1)}</small></span>
      </button>
      {accountOpen && <div id="role-account-menu" className="role-account-menu" role="region" aria-label="Account settings">
        <b>{session?.name || "Account"}</b><small className="muted">Appearance</small>
        <button type="button" aria-pressed={!dark} onClick={() => setTheme("light")}><Sun size={16} /> Light mode</button>
        <button type="button" aria-pressed={dark} onClick={() => setTheme("dark")}><Moon size={16} /> Dark mode</button>
        <button type="button" onClick={() => { logout(); navigate("/login", { replace: true }); }}><LogOut size={16} /> Log out</button>
      </div>}
    </div>
  </header>;
}
