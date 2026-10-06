import { getAppName } from "../instanceTheme";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/verify",
  OAUTH_CALLBACK: "/oauth/callback",
  PASSWORD_RESET: "/reset-password",
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  LEARN: "/learn",
  LAST_LESSON: "/learn/last-lesson",
  LEARN_LESSON: "/learn/:moduleId/:lessonId",
  PRIVACY: "/privacy",
  TERMS: "/terms",
  ADMIN_DASHBOARD: "/admin/dashboard",
};

// External link for the "Report a bug" CTA on error pages (404/500).
export const REPORT_BUG_LINK =
  "https://github.com/Code-the-Dream-School/summer-26-js-practicum-team2/issues/new?template=bug_report.md";

const TITLES = {
  [ROUTES.LOGIN]: "Log in",
  [ROUTES.REGISTER]: "Create an account",
  [ROUTES.VERIFY_EMAIL]: "Verify your email",
  [ROUTES.OAUTH_CALLBACK]: "Signing you in",
  [ROUTES.PASSWORD_RESET]: "Reset your password",
  [ROUTES.DASHBOARD]: "Dashboard",
  [ROUTES.PROFILE]: "Profile",
  [ROUTES.LEARN]: "Learning path",
  [ROUTES.PRIVACY]: "Privacy policy",
  [ROUTES.TERMS]: "Terms of service",
  [ROUTES.ADMIN_DASHBOARD]: "Admin dashboard",
};

export function getRouteTitle(pathname, appName = getAppName()) {
  if (pathname === ROUTES.HOME) return appName;
  const page = TITLES[pathname] ?? (pathname.startsWith("/learn/") ? "Lesson" : "Not found");
  return `${page} — ${appName}`;
}
