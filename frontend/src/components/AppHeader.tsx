import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun, X, LogOut } from "lucide-react";
import { APP_NAME, assignments, contests } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { studentApi } from "../services/studentApi";
import { storage } from "../services/storage";
export function Brand() {
  return (
    <Link
      className="brand"
      to="/dashboard"
      aria-label={APP_NAME}
      title={APP_NAME}
    >
      <img src="/assets/database.svg" width="20" height="20" alt="" />
    </Link>
  );
}
export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
const navigation = [
  "Dashboard",
  "Practice",
  "Assignments",
  "Contests",
  "Submissions",
];
type Panel = "notifications" | "streak" | "account" | null;
function StudentControls() {
  const { session, logout } = useAuth();
  const { dark, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState("Updates");
  const [unread, setUnread] = useState(
    () => storage.get("sql-practice:notifications-read") !== "yes",
  );
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const streak = studentApi.getLearningStreak();
  function close() {
    setPanel(null);
    trigger.current?.focus();
  }
  function open(next: Panel, element: HTMLButtonElement) {
    trigger.current = element;
    setPanel((current) => (current === next ? null : next));
    if (next === "notifications") {
      setUnread(false);
      storage.set("sql-practice:notifications-read", "yes");
    }
  }
  useEffect(() => {
    setPanel(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!panel) return;
    content.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setPanel(null);
    }
    function focus(e: FocusEvent) {
      if (!root.current?.contains(e.target as Node)) setPanel(null);
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focus);
    };
  }, [panel]);
  const work = assignments.find((a) => a.id === "a2")!;
  const contest = contests.find((c) => c.id === "t1")!;
  const updates = [
    {
      title: "New assignment is ready",
      description: work.title + " · Database Systems",
      action: "View assignment",
      age: "2h ago",
      to: "/assignments?work=" + work.id,
    },
    {
      title: "Your submission result is ready",
      description: "Review your SQL attempts and mock results",
      action: "View result",
      age: "5h ago",
      to: "/submissions",
    },
    {
      title: "A new practice set is available",
      description: "Joins and aggregation · Problems to explore",
      action: "Start practicing",
      age: "1d ago",
      to: "/practice",
    },
  ];
  const events = [
    {
      title: "Weekly SQL Contest starts soon",
      description:
        contest.title +
        " · " +
        contest.date +
        " · " +
        contest.time +
        "–" +
        contest.endTime +
        " ICT",
      action: "View contest",
      age: "1d ago",
      to: "/contests/" + contest.id,
    },
    {
      title: "Assignment deadline is approaching",
      description: work.title + " · " + work.date + " " + work.time + " ICT",
      action: "Open assignment",
      age: "3h ago",
      to: "/assignments?work=" + work.id,
    },
    {
      title: "Your group has assigned work",
      description: "Database Systems · Group 03",
      action: "View class",
      age: "2d ago",
      to: "/assignments/classes/c1",
    },
  ];
  return (
    <div className="header-actions" ref={root}>
      <button
        className="notification-trigger icon-button"
        onClick={(e) => open("notifications", e.currentTarget)}
        aria-label={unread ? "Notifications, unread updates" : "Notifications"}
        aria-expanded={panel === "notifications"}
        aria-controls={
          panel === "notifications" ? "student-popover" : undefined
        }
      >
        <img
          src={
            dark
              ? "/assets/notifications-dark.svg"
              : "/assets/notifications.svg"
          }
          alt=""
          width="24"
          height="24"
        />
        {unread && <span className="unread-dot" />}
      </button>
      <button
        className={"streak-trigger" + (!streak.current ? " inactive" : "")}
        onClick={(e) => open("streak", e.currentTarget)}
        aria-label={streak.current + "-day learning streak"}
        aria-expanded={panel === "streak"}
        aria-controls={panel === "streak" ? "student-popover" : undefined}
      >
        <img
          src={dark ? "/assets/flame-dark.svg" : "/assets/flame.svg"}
          alt=""
          width="22"
          height="22"
        />
        <span>{streak.current}</span>
      </button>
      <button
        className="account-trigger"
        onClick={(e) => open("account", e.currentTarget)}
        aria-expanded={panel === "account"}
        aria-controls={panel === "account" ? "student-popover" : undefined}
        aria-label="Student account"
      >
        <span className="avatar">{session?.initials}</span>
        <span className="account-identity">
          <b>{session?.name}</b>
          <small>Student</small>
        </span>
      </button>
      {panel && (
        <div
          id="student-popover"
          ref={content}
          className={"student-popover " + panel + "-popover"}
          role="region"
          aria-label={
            panel === "notifications"
              ? "Notifications"
              : panel === "streak"
                ? "Learning streak"
                : "Student account"
          }
        >
          {panel === "notifications" ? (
            <>
              <div className="section-heading">
                <h2>Notifications</h2>
                <button
                  className="icon-button"
                  aria-label="Close notifications"
                  onClick={close}
                >
                  <X size={18} />
                </button>
              </div>
              <div
                className="underline-tabs"
                aria-label="Notification category"
              >
                {["Updates", "Events"].map((value) => (
                  <button
                    className={tab === value ? "active" : ""}
                    aria-pressed={tab === value}
                    key={value}
                    onClick={() => setTab(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="notification-list">
                {(tab === "Updates" ? updates : events).map((item) => (
                  <article key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <Link to={item.to}>{item.action} →</Link>
                    <small> · {item.age}</small>
                  </article>
                ))}
              </div>
              <p className="popover-footnote">
                Demo notifications from the last 30 days
              </p>
            </>
          ) : panel === "streak" ? (
            <>
              <h2 className="streak-title">{streak.current}-day streak</h2>
              <p>
                {streak.complete
                  ? "Today's practice is complete."
                  : "Solve a SQL problem to keep it going."}
              </p>
              <p className="muted">
                Keep it going: submit an accepted solution each day.
              </p>
              <p className="tiny muted">
                Personal best: {streak.best} days · Demo history
              </p>
              <button className="button" onClick={close}>
                Close
              </button>
            </>
          ) : (
            <>
              <b className="account-name">{session?.name}</b>
              <small className="muted">Student</small>
              <p className="tiny muted">Appearance</p>
              <button
                className="appearance-option"
                aria-pressed={!dark}
                onClick={() => setTheme("light")}
              >
                <Sun size={16} />
                Light mode
              </button>
              <button
                className="appearance-option"
                aria-pressed={dark}
                onClick={() => setTheme("dark")}
              >
                <Moon size={16} />
                Dark mode
              </button>
              <button
                className="appearance-option logout-option"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut size={16} />
                Logout
              </button>
              <button className="button" onClick={close}>
                Close
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export function AppHeader({
  workspace,
}: {
  workspace?: { title: string; number: string; topic: string };
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menu.current?.focus();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  return (
    <header
      className={"global-header" + (workspace ? " workspace-header" : "")}
    >
      <Brand />
      {workspace ? (
        <>
          <Link className="back-link" to="/practice">
            ← Practice
          </Link>
          <div className="workspace-identity">
            <b>
              {workspace.number}. {workspace.title}
            </b>
            <small>Practice / {workspace.topic}</small>
          </div>
        </>
      ) : (
        <>
          <button
            ref={menu}
            className="mobile-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="student-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <nav
            id="student-navigation"
            aria-label="Student navigation"
            className={open ? "open" : ""}
          >
            {navigation.map((label) => (
              <NavLink
                key={label}
                to={"/" + label.toLowerCase()}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
      <StudentControls />
    </header>
  );
}
