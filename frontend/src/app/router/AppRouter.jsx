import { Route, Routes } from "react-router";
import { ROUTES } from "./routes";
import { useAuthContext } from "../../context/AuthContext";
import MainLayout from "../../shared/MainLayout/MainLayout.component";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

import HomePage from "../../pages/HomePage";
import LoginPage from "../../pages/LoginPage";
import RegisterPage from "../../pages/RegisterPage";
import VerifyEmailPage from "../../pages/VerifyEmailPage";
import OAuthCallbackPage from "../../pages/OAuthCallbackPage";
import PasswordResetPage from "../../pages/PasswordResetPage";
import ProfilePage from "../../pages/ProfilePage";
import DashboardPage from "../../pages/DashboardPage";
import LeaderboardPage from "../../pages/LeaderboardPage";
import LearningPathPage from "../../pages/LearningPathPage";
import LearnPage from "../../pages/LearnPage";
import LastLessonRedirect from "../../pages/LastLessonRedirect";
import PrivacyPage from "../../pages/PrivacyPage";
import TermsPage from "../../pages/TermsPage";
import NotFoundPage from "../../pages/NotFoundPage";
import Spinner from "../../shared/Spinner/Spinner.component";
import AdminDashboardPage from "../../pages/AdminDashboardPage";

export default function AppRouter() {
  const { isHydrating } = useAuthContext();

  if (isHydrating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Loading" />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.LEADERBOARD} element={<LeaderboardPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
        <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallbackPage />} />
        <Route path={ROUTES.PASSWORD_RESET} element={<PasswordResetPage />} />
        <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
        <Route path={ROUTES.TERMS} element={<TermsPage />} />
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/*Admin Route */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LEARN}
          element={
            <ProtectedRoute>
              <LearningPathPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LAST_LESSON}
          element={
            <ProtectedRoute>
              <LastLessonRedirect />
            </ProtectedRoute>
          }
        />

        {/* Public so unauthenticated visitors can preview a sample lesson. */}
        <Route path={ROUTES.LEARN_LESSON} element={<LearnPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
