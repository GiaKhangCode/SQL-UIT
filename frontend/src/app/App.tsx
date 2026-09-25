import { AssignmentWorkPage } from "../pages/student/AssignmentWorkPage";
import { lazy, Suspense, useEffect } from "react";
import { APP_NAME } from "../data/models";
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
  RegisterLecturerPage,
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
import { AssignmentsListPage, ProblemLibraryPage } from "../pages/teacher/TeacherLandingPages";
import { ContestsListPage } from "../pages/teacher/ContestListPage";
import { ClassesGroupsPage } from "../pages/teacher/ClassesGroupsPage";
import { ManualReviewPage, ResultsDashboardPage } from "../pages/teacher/ResultsPages";
import {
  AdminCoursesPage,
  AdminEditClassPage,
  AdminEditAccountPage,
  AdminLecturerApprovalsPage,
  AdminLecturersPage,
  AdminOverviewPage,
  AdminPracticeCatalogPage,
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
          <Route path="/register-lecturer" element={<RegisterLecturerPage />} />
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
            <Route path="problems" element={<ProblemLibraryPage />} />
            <Route path="problems/new" element={<ProblemEditorPage />} />
            <Route path="problems/:problemId/edit" element={<ProblemEditorPage />} />
            <Route path="assignments" element={<AssignmentsListPage />} />
            <Route path="assignments/new" element={<AssignmentBuilderPage />} />
            <Route path="assignments/:id/edit" element={<AssignmentBuilderPage />} />
            <Route path="contests" element={<ContestsListPage />} />
            <Route path="contests/new" element={<ContestBuilderPage />} />
            <Route path="contests/:id/edit" element={<ContestBuilderPage />} />
            <Route path="classes" element={<ClassesGroupsPage />} />
            <Route path="results" element={<ResultsDashboardPage />} />
            <Route path="results/review/:submissionId" element={<ManualReviewPage />} />
          </Route>
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate replace to="overview" />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:email/edit" element={<AdminEditAccountPage />} />
            <Route path="users/approvals" element={<AdminLecturerApprovalsPage />} />
            <Route path="roles" element={<AdminRolesPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="courses/classes/:classId/edit" element={<AdminEditClassPage />} />
            <Route path="courses/lecturers" element={<AdminLecturersPage />} />
            <Route path="lecturers" element={<Navigate replace to="/admin/courses/lecturers" />} />
            <Route path="practice" element={<AdminPracticeCatalogPage />} />
            <Route path="moderation" element={<Navigate replace to="/admin/practice" />} />
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
