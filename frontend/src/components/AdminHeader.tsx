import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const adminLinks = [
  ["Overview", "/admin/overview"],
  ["Users", "/admin/users"],
  ["Courses", "/admin/courses"],
  ["Practice", "/admin/lecturers"],
  ["Moderation", "/admin/moderation"],
  ["Roles", "/admin/roles"],
] as const;

export function AdminHeader() {
  const { session, logout } = useAuth();
  const { dark, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  function endSession() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="admin-header">
      <Link to="/admin/overview" className="admin-brand" aria-label="QueryLab admin home">
        <img src="/assets/database.svg" width="20" height="20" alt="" />
      </Link>
      <button
        className="admin-mobile-menu"
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="admin-navigation"
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav id="admin-navigation" className={menuOpen ? "admin-navigation open" : "admin-navigation"} aria-label="Admin navigation">
        {adminLinks.map(([label, path]) => (
          <NavLink key={path} to={path}>{label}</NavLink>
        ))}
      </nav>
      <div className="admin-account-wrap">
        <button
          className="admin-profile-trigger"
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-expanded={accountOpen}
          aria-controls="admin-account-menu"
          aria-label="Admin account and appearance"
        >
          <span className="admin-avatar" aria-hidden="true">{session?.initials || "A"}</span>
          <span className="admin-profile-text"><b>{session?.name || "Huy Lai"}</b><small>Admin</small></span>
        </button>
        {accountOpen && (
          <div id="admin-account-menu" className="admin-account-menu" role="region" aria-label="Admin account">
            <b>{session?.name || "Huy Lai"}</b>
            <small className="muted">Admin demo account</small>
            <p className="tiny muted">Appearance</p>
            <button type="button" className="admin-menu-option" aria-pressed={!dark} onClick={() => setTheme("light")}><Sun size={16} /> Light mode</button>
            <button type="button" className="admin-menu-option" aria-pressed={dark} onClick={() => setTheme("dark")}><Moon size={16} /> Dark mode</button>
            <button type="button" className="admin-menu-option" onClick={endSession}><LogOut size={16} /> Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}
