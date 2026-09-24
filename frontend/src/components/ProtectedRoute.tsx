import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();
  if (session?.role === "instructor") {
    return <Navigate to="/teacher/problems" replace />;
  }
  if (session?.role === "admin") {
    return <Navigate to="/admin/overview" replace />;
  }
  return session ? <Outlet /> : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search + location.hash }}
    />
  );
}
export function PublicOnlyRoute() {
  const session = useAuth().session;
  return session ? (
    <Navigate
      to={
        session.role === "instructor"
          ? "/teacher/problems"
          : session.role === "admin"
            ? "/admin/overview"
            : "/dashboard"
      }
      replace
    />
  ) : (
    <Outlet />
  );
}

export function AdminRoute() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }
  return session.role === "admin" ? (
    <Outlet />
  ) : (
    <Navigate
      to={session.role === "instructor" ? "/teacher/problems" : "/dashboard"}
      replace
    />
  );
}

export function TeacherRoute() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }
  return session.role === "instructor" ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}
