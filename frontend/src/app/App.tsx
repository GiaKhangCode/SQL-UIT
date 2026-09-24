import { AssignmentWorkPage } from "../pages/student/AssignmentWorkPage";
import { lazy, Suspense, useEffect } from "react";
import { APP_NAME } from "../data/mockData";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { TeacherHeader } from "../components/TeacherHeader";
import { AdminHeader } from "../components/AdminHeader";
import {
  AdminRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  TeacherRoute,
} from "../components/ProtectedRoute";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyOtpPage,
} from "../pages/auth/AuthPages";
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
import { ProblemEditorPage } from "../pages/teacher/ProblemEditorPage";
import { AssignmentBuilderPage, ContestBuilderPage } from "../pages/teacher/BuilderPages";
import { ClassesGroupsPage } from "../pages/teacher/ClassesGroupsPage";
import { ManualReviewPage, ResultsDashboardPage } from "../pages/teacher/ResultsPages";
import {
  AdminCoursesPage,
  AdminLecturersPage,
  AdminModerationPage,
  AdminOverviewPage,
  AdminRolesPage,
  AdminUsersPage,
} from "../pages/admin/AdminPages";
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
function TeacherShell() {
  return (
    <>
      <TeacherHeader />
      <main id="main-content" className="teacher-main">
        <Outlet />
      </main>
    </>
  );
}
function AdminShell() {
  return (
    <>
      <AdminHeader />
      <main id="main-content" className="admin-main">
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
  const home = session?.role === "instructor"
    ? "/teacher/problems"
    : session?.role === "admin"
      ? "/admin/overview"
      : "/dashboard";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Routes>
        <Route
          path="/"
          element={<Navigate replace to={session ? home : "/login"} />}
        />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
        <Route element={<TeacherRoute />}>
          <Route path="/teacher" element={<TeacherShell />}>
            <Route index element={<Navigate replace to="problems" />} />
            <Route path="problems" element={<ProblemEditorPage />} />
            <Route path="assignments" element={<AssignmentBuilderPage />} />
            <Route path="contests/new" element={<ContestBuilderPage />} />
            <Route path="classes" element={<ClassesGroupsPage />} />
            <Route path="results" element={<ResultsDashboardPage />} />
            <Route path="results/review/:submissionId" element={<ManualReviewPage />} />
          </Route>
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate replace to="overview" />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="roles" element={<AdminRolesPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="lecturers" element={<AdminLecturersPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="overview" element={<AdminOverviewPage />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={<Navigate replace to={session ? home : "/login"} />}
        />
      </Routes>
    </>
  );
}
