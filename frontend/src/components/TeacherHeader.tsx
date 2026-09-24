import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function TeacherHeader() {
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

  const problemActive = location.pathname.startsWith("/teacher/problems");
  const assignmentActive = location.pathname.startsWith("/teacher/assignments");
  const contestActive = location.pathname.startsWith("/teacher/contests");
  const resultsActive = location.pathname.startsWith("/teacher/results");

  return (
    <header className="teacher-header">
      <Link
        to="/teacher/problems"
        className="teacher-brand"
        aria-label="QueryLab teacher home"
      >
        <img src="/assets/database.svg" width="20" height="20" alt="" />
      </Link>
      <button
        className="teacher-mobile-menu"
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="teacher-navigation"
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav
        id="teacher-navigation"
        className={menuOpen ? "teacher-navigation open" : "teacher-navigation"}
        aria-label="Teacher navigation"
      >
        <NavLink to="/teacher/problems" className={problemActive ? "active" : undefined}>Problems</NavLink>
        <NavLink
          to="/teacher/assignments"
          className={assignmentActive ? "active" : undefined}
        >
          Assignments
        </NavLink>
        <NavLink to="/teacher/contests" className={contestActive ? "active" : undefined}>Contests</NavLink>
        <NavLink to="/teacher/classes">Classes</NavLink>
        <NavLink
          to="/teacher/results"
          className={resultsActive ? "active" : undefined}
        >
          Results
        </NavLink>
      </nav>
      <div className="teacher-account-wrap">
        <button
          className="teacher-profile-trigger"
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-expanded={accountOpen}
          aria-controls="teacher-account-menu"
          aria-label="Teacher account and appearance"
        >
          <span className="teacher-avatar" aria-hidden="true">H</span>
          <span className="teacher-profile-text">
            <b>{session?.name || "Huy Lai"}</b>
            <small>Teacher</small>
          </span>
        </button>
        {accountOpen && (
          <div
            id="teacher-account-menu"
            className="teacher-account-menu"
            role="region"
            aria-label="Teacher account"
          >
            <b>{session?.name || "Huy Lai"}</b>
            <small className="muted">Teacher demo account</small>
            <p className="tiny muted">Appearance</p>
            <button
              type="button"
              className="teacher-menu-option"
              aria-pressed={!dark}
              onClick={() => setTheme("light")}
            >
              <Sun size={16} /> Light mode
            </button>
            <button
              type="button"
              className="teacher-menu-option"
              aria-pressed={dark}
              onClick={() => setTheme("dark")}
            >
              <Moon size={16} /> Dark mode
            </button>
            <button
              type="button"
              className="teacher-menu-option"
              onClick={endSession}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
