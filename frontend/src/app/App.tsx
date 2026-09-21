import { AssignmentWorkPage } from "../pages/student/AssignmentWorkPage";
import { lazy, Suspense, useEffect } from "react";
import { APP_NAME } from "../data/mockData";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { ProtectedRoute, PublicOnlyRoute } from "../components/ProtectedRoute";
import { LoginPage, RegisterPage } from "../pages/auth/AuthPages";
import { DashboardPage } from "../pages/student/DashboardPage";
import { PracticePage } from "../pages/student/PracticePage";
import { Loading } from "../components/ui";
const WorkspacePage = lazy(() =>
  import("../pages/student/WorkspacePage").then((module) => ({
    default: module.WorkspacePage,
  })),
);
import { AssignmentsPage } from "../pages/student/AssignmentsPage";
import { AssignmentDetailPage } from "../pages/student/AssignmentDetailPage";
import { ContestDetailPage } from "../pages/student/ContestDetailPage";
import { ContestsPage } from "../pages/student/ContestsPage";
import { SubmissionsPage } from "../pages/student/SubmissionsPage";
function Shell() {
  return (
    <>
      <AppHeader />
      <main id="main-content">
        <Outlet />
      </main>
    </>
  );
}
export function App() {
  useEffect(() => {
    document.title = APP_NAME;
  }, []);
  const { session } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Routes>
        <Route
          path="/"
          element={<Navigate replace to={session ? "/dashboard" : "/login"} />}
        />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route
              path="/assignments/work/:assignmentId"
              element={<AssignmentWorkPage />}
            />
            <Route
              path="/assignments/classes/:scopeId"
              element={<AssignmentDetailPage />}
            />
            <Route
              path="/assignments/groups/:scopeId"
              element={<AssignmentDetailPage group />}
            />
            <Route path="/contests" element={<ContestsPage />} />
            <Route
              path="/contests/:contestId"
              element={<ContestDetailPage />}
            />
            <Route path="/submissions" element={<SubmissionsPage />} />
          </Route>
          <Route
            path="/workspace/:problemId"
            element={
              <Suspense fallback={<Loading />}>
                <WorkspacePage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="*"
          element={<Navigate replace to={session ? "/dashboard" : "/login"} />}
        />
      </Routes>
    </>
  );
}
