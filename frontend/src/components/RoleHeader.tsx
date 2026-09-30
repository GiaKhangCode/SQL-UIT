import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { APP_NAME } from "../data/models";
import { studentApi } from "../services/studentApi";
import { useLoad } from "./useLoad";

type Role = "student" | "teacher" | "admin";
const links: Record<Role, [string, string][]> = {
  student: [["Dashboard", "/dashboard"], ["Practice", "/practice"], ["Assignments", "/assignments"], ["Contests", "/contests"], ["Submissions", "/submissions"]],
  teacher: [["Problems", "/teacher/problems"], ["Assignments", "/teacher/assignments"], ["Contests", "/teacher/contests"], ["Classes", "/teacher/classes"], ["Results", "/teacher/results"]],
  admin: [["Overview", "/admin/overview"], ["Users", "/admin/users"], ["Courses", "/admin/courses"], ["Practice", "/admin/practice"], ["Roles", "/admin/roles"]],
};
type NotificationTab = "updates" | "events";

export function RoleHeader({ role, workspace }: { role: Role; workspace?: { title: string; number: string; topic: string; source?: string; context?: string; backTo?: string } }) {
  const { session, logout } = useAuth();
  const { dark, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<NotificationTab>("updates");
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const streakButton = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // Fetch data
  const { data: dashboardStats } = useLoad<any>(() => role === "student" ? studentApi.getDashboard() : Promise.resolve(null), [role]);
  const { data: notifications, mutate: setNotifications } = useLoad<any[]>(() => role === "student" ? studentApi.getNotifications() : Promise.resolve([]), [role]);
  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  const handleMarkAllRead = async () => {
    if (role === "student") {
      await studentApi.markAllAsRead();
      setNotifications(notifications?.map((n: any) => ({ ...n, isRead: true })));
    }
  };

  const handleNotificationClick = async (id: string, isRead: boolean) => {
    if (!isRead && role === "student") {
      await studentApi.markAsRead(id);
      setNotifications(notifications?.map((n: any) => n.id === id ? { ...n, isRead: true } : n));
    }
    setNotificationsOpen(false);
  };

  useEffect(() => { setMenuOpen(false); setAccountOpen(false); setNotificationsOpen(false); setStreakOpen(false); }, [location.pathname]);
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
    if (!notificationsOpen && !streakOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setStreakOpen(false);
        (notificationsOpen ? notificationButton : streakButton).current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationRef.current?.contains(target)) setNotificationsOpen(false);
      if (!streakRef.current?.contains(target)) setStreakOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [notificationsOpen, streakOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateIndicator = () => {
      if (getComputedStyle(nav).display === "none") return;
      const active = nav.querySelector<HTMLElement>("a.active");
      if (!active) return;
      const navBounds = nav.getBoundingClientRect();
      const activeBounds = active.getBoundingClientRect();
      const next = {
        left: activeBounds.left - navBounds.left,
        width: activeBounds.width,
      };
      setIndicator((current) => current?.left === next.left && current.width === next.width ? current : next);
    };
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(nav);
    nav.querySelectorAll("a").forEach((link) => observer.observe(link));
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [location.pathname, role, menuOpen, workspace]);
  const home = links[role][0][1];
  return <header className={`global-header role-header role-${role}${workspace ? " workspace-header" : ""}`}>
    <Link className="brand" to={home} aria-label={`${APP_NAME} home`}><img src="/favicon.svg" width="40" height="40" alt="" /><span className="brand-name">{APP_NAME}</span></Link>
    {workspace ? <><Link className="back-link" to={workspace.backTo || "/practice"}>← {workspace.source || "Practice"}</Link><div className="workspace-identity"><b>{workspace.number}. {workspace.title}</b><small>{workspace.source || "Practice"} / {workspace.context || workspace.topic}</small></div></> : <>
      <button type="button" className="mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls={`${role}-navigation`} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? "Close" : "Menu"}</button>
      <nav ref={navRef} id={`${role}-navigation`} className={`${menuOpen ? "open " : ""}${indicator ? "has-indicator" : ""}`} aria-label={`${role} navigation`}>
        {indicator && <span className="nav-active-indicator" aria-hidden="true" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />}
        {links[role].map(([label, path]) => <NavLink key={path} to={path} className={({ isActive }) => isActive || location.pathname.startsWith(path + "/") ? "active" : undefined} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}
      </nav>
    </>}
    {role === "student" && <div className="student-header-status" role="group" aria-label="Student activity">
      <div className="notification-anchor" ref={notificationRef}>
        <button ref={notificationButton} type="button" className="notification-trigger" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="student-notification-popover" onClick={() => { setNotificationsOpen(value => !value); setStreakOpen(false); setAccountOpen(false); }}>
          <img src={dark ? "/assets/notifications-dark.svg" : "/assets/notifications.svg"} width="40" height="40" alt="" />
          {unreadCount > 0 && <span className="unread-dot" aria-hidden="true">{unreadCount}</span>}
        </button>
        {notificationsOpen && <div id="student-notification-popover" className="student-popover notification-popover" role="region" aria-label="Notifications">
          <div className="notification-heading">
            <h2>Notifications</h2>
            <div className="notification-actions" style={{display: 'flex', gap: '12px'}}>
              {unreadCount > 0 && <button type="button" className="text-button" onClick={handleMarkAllRead}>Mark all read</button>}
              <button type="button" className="popover-close" onClick={() => { setNotificationsOpen(false); notificationButton.current?.focus(); }}>Close</button>
            </div>
          </div>
          <div className="notification-list" role="tabpanel">
            {notifications && notifications.length > 0 ? notifications.map((item: any) => <article 
              key={item.id} 
              className={`notification-card ${item.isRead ? "notification-read" : ""}`}
              onClick={() => {
                handleNotificationClick(item.id, item.isRead);
                if (item.link) navigate(item.link);
              }}
              style={{ cursor: 'pointer' }}
            >
              <h3 style={{fontWeight: item.isRead ? 'normal' : 'bold'}}>{item.title}</h3>
              <p>{item.message}</p>
              <div className="notification-item-footer">
                <small className="muted">{new Date(item.createdAt).toLocaleDateString()}</small>
              </div>
            </article>) : <p className="muted" style={{padding: '1rem'}}>No notifications yet.</p>}
          </div>
          <p className="popover-footnote">Notifications from the last 30 days</p>
        </div>}
      </div>
      <div className="streak-anchor" ref={streakRef}>
        <button ref={streakButton} type="button" className="streak-trigger" aria-label={`${dashboardStats?.currentStreak || 0} day learning streak`} aria-expanded={streakOpen} aria-controls="student-streak-popover" onClick={() => { setStreakOpen(value => !value); setNotificationsOpen(false); setAccountOpen(false); }}>
          <img src={dark ? "/assets/flame-dark.svg" : "/assets/flame.svg"} width="22" height="22" alt="" />
          <span>{dashboardStats?.currentStreak || 0}</span>
        </button>
        {streakOpen && <div id="student-streak-popover" className="student-popover streak-popover" role="region" aria-label="streak details">
          <div className="streak-heading">
            <strong className="streak-title">{dashboardStats?.currentStreak || 0}-day streak</strong>
            <button type="button" className="popover-close" onClick={() => { setStreakOpen(false); streakButton.current?.focus(); }}>Close</button>
          </div>
          <p className="streak-today">{dashboardStats?.currentStreak ? "Keep it going: solve at least one SQL problem each day." : "Start your streak by solving a problem today!"}</p>
          <small>Personal best · {dashboardStats?.longestStreak || 0} days</small>
        </div>}
      </div>
    </div>}
    <div className="role-account" ref={accountRef}>
      <button ref={accountButton} type="button" className="account-trigger" aria-label={`${role} account and appearance`} aria-expanded={accountOpen} aria-controls="role-account-menu" onClick={() => { setAccountOpen(value => !value); setNotificationsOpen(false); setStreakOpen(false); }}>
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
