const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
const AUTH_BASE_PATH = `${API_BASE_URL}/api/v1/auth`;
const USERS_BASE_PATH = `${API_BASE_URL}/api/v1/users`;
const DASHBOARD_BASE_PATH = `${API_BASE_URL}/api/v1/dashboard`;
const LEADERBOARD_BASE_PATH = `${API_BASE_URL}/api/v1/leaderboard`;
const DASHBOARD_CACHE_KEY_PREFIX = "openquiz.dashboard.";
const LESSONS_BASE_PATH = `${API_BASE_URL}/api/v1/lessons`;
const QUIZZES_BASE_PATH = `${API_BASE_URL}/api/v1/quizzes`;
const ONBOARDING_BASE_PATH = `${API_BASE_URL}/api/v1/onboarding`;
const PROFILE_BASE_PATH = `${API_BASE_URL}/api/v1/profile`;
const ADMIN_BASE_PATH = `${API_BASE_URL}/api/v1/admin`;
const CSRF_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);
const CSRF_TOKEN_HEADER = "x-csrf-token";
const CSRF_MISMATCH_MESSAGE = "Invalid CSRF token.";
const ACCOUNT_INVALIDATING_CODES = new Set([
  "ACCOUNT_DISABLED",
  "ACCOUNT_DELETED",
  "SESSION_INVALIDATED",
]);

export const resolveAssetUrl = (assetPath) => {
  if (typeof assetPath !== "string" || !assetPath) return null;
  if (/^(https?:|data:|blob:)/i.test(assetPath)) return assetPath;
  if (!assetPath.startsWith("/api/")) return assetPath;
  return `${API_BASE_URL}${assetPath}`;
};

let currentCsrfToken = null;
export const AUTH_EXPIRED_EVENT = "openquiz:auth-expired";
export const CSRF_TOKEN_UPDATED_EVENT = "openquiz:csrf-token-updated";

export const setCsrfToken = (csrfToken) => {
  currentCsrfToken = csrfToken ?? null;
};

export const clearCsrfToken = () => {
  currentCsrfToken = null;
};

const refreshCsrfToken = (csrfToken) => {
  setCsrfToken(csrfToken);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CSRF_TOKEN_UPDATED_EVENT, { detail: { csrfToken } }));
  }
};

async function apiRequest(path, options = {}, hasRetriedCsrf = false) {
  const {
    method = "GET",
    body,
    csrfToken,
    headers = {},
    basePath = USERS_BASE_PATH,
    cache,
  } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const requestCsrfToken = currentCsrfToken ?? csrfToken;
  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (isFormData) delete requestHeaders["Content-Type"];
  if (requestCsrfToken && CSRF_METHODS.has(method.toUpperCase())) {
    requestHeaders["X-CSRF-TOKEN"] = requestCsrfToken;
  }

  const response = await fetch(`${basePath}${path}`, {
    method,
    credentials: "include",
    cache,
    headers: requestHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const refreshedCsrfToken = response.headers.get(CSRF_TOKEN_HEADER);
    if (
      response.status === 403 &&
      payload?.message === CSRF_MISMATCH_MESSAGE &&
      refreshedCsrfToken &&
      !hasRetriedCsrf
    ) {
      refreshCsrfToken(refreshedCsrfToken);
      return apiRequest(path, options, true);
    }

    const error = new Error(payload?.message || "Request failed. Please try again.");
    error.status = response.status;
    error.code = payload?.code;
    error.errors = Array.isArray(payload?.errors) ? payload.errors : [];
    error.authInvalidating = ACCOUNT_INVALIDATING_CODES.has(error.code);
    if (error.authInvalidating && typeof window !== "undefined") {
      clearCsrfToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw error;
  }
  return payload;
}

export const registerUser = (formData) =>
  apiRequest("/register", {
    method: "POST",
    body: formData,
  });

export const loginUser = (credentials) =>
  apiRequest("/login", {
    method: "POST",
    body: credentials,
  });

export const logoutUser = (csrfToken) =>
  apiRequest("/logout", {
    method: "POST",
    csrfToken,
  });

export const beginOnboarding = () =>
  apiRequest("", {
    method: "GET",
    basePath: ONBOARDING_BASE_PATH,
  });

export const getOnboardingState = () =>
  apiRequest("", {
    method: "GET",
    basePath: ONBOARDING_BASE_PATH,
  });

export const toggleOnboardingWorkflow = ({ enabled, csrfToken }) =>
  apiRequest("/toggle", {
    method: "PATCH",
    csrfToken,
    body: { enabled },
    basePath: ONBOARDING_BASE_PATH,
  });

export const updateOnboardingProgress = async ({
  tourKey,
  step,
  status,
  dismissed,
  markAllComplete,
  csrfToken,
}) => {
  const response = await apiRequest("/step", {
    method: "PATCH",
    csrfToken,
    body: { tourKey, step, status, dismissed, markAllComplete },
    basePath: ONBOARDING_BASE_PATH,
  });
  notifyDashboardProgressChanged({ rewards: response?.rewards });
  return response;
};

export const resetOnboardingProgress = (csrfToken) =>
  apiRequest("/reset", {
    method: "POST",
    csrfToken,
    basePath: ONBOARDING_BASE_PATH,
  });

export const getCurrentUser = () => apiRequest("/me", { method: "GET" });

// Full-page navigation targets — the browser must follow the OAuth provider's redirect chain,
// so these are used as anchor hrefs rather than fetched with apiRequest.
export const getOAuthProviders = () =>
  apiRequest("/providers", {
    method: "GET",
    basePath: AUTH_BASE_PATH,
  });

export const getOAuthUrl = (provider, tosAccepted = false, next) => {
  const query = new URLSearchParams();
  if (tosAccepted) query.set("tos", "true");
  if (next) query.set("next", next);

  const search = query.toString();
  return `${AUTH_BASE_PATH}/${provider}${search ? `?${search}` : ""}`;
};

export const verifyUserEmail = (token) => apiRequest(`/verify?token=${encodeURIComponent(token)}`);

export const forgotPasswordRequest = (email) =>
  apiRequest("/forgot-password", {
    method: "POST",
    body: { email },
  });

export const resetPasswordRequest = (token, newPassword) =>
  apiRequest("/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });

export const getDashboard = () =>
  apiRequest("", {
    method: "GET",
    basePath: DASHBOARD_BASE_PATH,
    cache: "no-store",
  });

export const getLeaderboard = () =>
  apiRequest("", {
    method: "GET",
    basePath: LEADERBOARD_BASE_PATH,
  });

export const getProfile = () =>
  apiRequest("", {
    basePath: PROFILE_BASE_PATH,
    method: "GET",
  });

export const updateProfile = async ({ csrfToken, ...profile }) => {
  try {
    const response = await apiRequest("", {
      method: "PATCH",
      body: profile,
      csrfToken,
      basePath: PROFILE_BASE_PATH,
    });
    notifyProfileChange({ user: response?.user || profile });
    return response;
  } catch (error) {
    console.error("failed to update profile", error);
    throw error;
  }
};

export const changeProfilePassword = ({ currentPassword, newPassword, csrfToken }) =>
  apiRequest("/password", {
    method: "POST",
    body: { currentPassword, newPassword },
    csrfToken,
    basePath: PROFILE_BASE_PATH,
  });

export const deleteProfile = ({ email, csrfToken }) =>
  apiRequest("/request-deletion", {
    method: "POST",
    body: { email },
    csrfToken,
    basePath: PROFILE_BASE_PATH,
  });

export const setProfileAvatarUrl = async ({ avatarUrl, csrfToken }) => {
  const response = await apiRequest("/avatar", {
    method: "POST",
    body: { avatar_url: avatarUrl || null },
    csrfToken,
    basePath: PROFILE_BASE_PATH,
  });
  notifyProfileChange({ avatarUrl: response?.avatar_url || null });
  return response;
};

export const resetProfileProgress = (csrfToken) =>
  apiRequest("/progress/reset", {
    method: "POST",
    body: { confirmation: "CONFIRM" },
    csrfToken,
    basePath: PROFILE_BASE_PATH,
  });

export const getAdminUsers = ({ page, limit, role, emailVerified, search } = {}) => {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (limit) params.set("limit", limit);
  if (role) params.set("role", role);
  if (emailVerified !== undefined) params.set("emailVerified", emailVerified);
  if (search) params.set("search", search);
  const query = params.toString();
  return apiRequest(`/users${query ? `?${query}` : ""}`, {
    method: "GET",
    basePath: ADMIN_BASE_PATH,
  });
};

export const getPendingDeleteAccount = () =>
  apiRequest("/deletions/pending", {
    method: "GET",
    basePath: ADMIN_BASE_PATH,
  });

export const approveDeleteAccount = (userId, csrfToken) =>
  apiRequest(`/deletions/approve/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    csrfToken,
    basePath: ADMIN_BASE_PATH,
  });

export const rejectDeleteAccount = (userId, csrfToken) =>
  apiRequest(`/deletions/deny/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    csrfToken,
    basePath: ADMIN_BASE_PATH,
  });

export const reactivateUserAcct = (userId, csrfToken) =>
  apiRequest(`/deletions/reactivate/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    csrfToken,
    basePath: ADMIN_BASE_PATH,
  });

export const getAdminModules = () =>
  apiRequest("/modules", { method: "GET", basePath: ADMIN_BASE_PATH });

export const getAdminAvatarAssets = () =>
  apiRequest("/assets/avatars", { method: "GET", basePath: ADMIN_BASE_PATH });

export const uploadAdminAvatar = ({ file, csrfToken }) => {
  const body = new FormData();
  body.append("file", file);

  return apiRequest("/assets/avatars", {
    method: "POST",
    csrfToken,
    body,
    basePath: ADMIN_BASE_PATH,
  });
};

export const seedAdminRandomUsers = (csrfToken, count = 10) =>
  apiRequest("/users/seed-random", {
    method: "POST",
    csrfToken,
    body: { count },
    basePath: ADMIN_BASE_PATH,
  });

export const createAdminModule = ({ module, csrfToken }) =>
  apiRequest("/modules", { method: "POST", csrfToken, body: module, basePath: ADMIN_BASE_PATH });

export const updateAdminModule = ({ moduleId, updates, csrfToken }) =>
  apiRequest(`/modules/${encodeURIComponent(moduleId)}`, {
    method: "PATCH",
    csrfToken,
    body: updates,
    basePath: ADMIN_BASE_PATH,
  });

export const deleteAdminModule = ({ moduleId, csrfToken }) =>
  apiRequest(`/modules/${encodeURIComponent(moduleId)}`, {
    method: "DELETE",
    csrfToken,
    basePath: ADMIN_BASE_PATH,
  });

export const createAdminLesson = ({ moduleId, lesson, csrfToken }) =>
  apiRequest(`/modules/${encodeURIComponent(moduleId)}/lessons`, {
    method: "POST",
    csrfToken,
    body: lesson,
    basePath: ADMIN_BASE_PATH,
  });

export const updateAdminLesson = ({ moduleId, lessonId, lesson, csrfToken }) =>
  apiRequest(`/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: "PATCH",
    csrfToken,
    body: lesson,
    basePath: ADMIN_BASE_PATH,
  });

export const deleteAdminLesson = ({ moduleId, lessonId, csrfToken }) =>
  apiRequest(`/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: "DELETE",
    csrfToken,
    basePath: ADMIN_BASE_PATH,
  });

export const updateAdminUserRole = ({ userId, role, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    csrfToken,
    body: { role, confirmation: "CONFIRM" },
    basePath: ADMIN_BASE_PATH,
  });

export const setAdminUserDisabled = ({ userId, disabled, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}/disabled`, {
    method: "PATCH",
    csrfToken,
    body: { disabled, confirmation: "CONFIRM" },
    basePath: ADMIN_BASE_PATH,
  });

export const resetAdminUserProgress = ({ userId, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}/progress/reset`, {
    method: "POST",
    csrfToken,
    body: { confirmation: "CONFIRM" },
    basePath: ADMIN_BASE_PATH,
  });

export const verifyAdminUserEmail = ({ userId, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}/verify-email`, {
    method: "PATCH",
    csrfToken,
    body: { confirmation: "CONFIRM" },
    basePath: ADMIN_BASE_PATH,
  });

export const setAdminUserDeleted = ({ userId, deleted, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}/deleted`, {
    method: "PATCH",
    csrfToken,
    body: { confirmation: "CONFIRM", deleted },
    basePath: ADMIN_BASE_PATH,
  });

export const hardDeleteAdminUser = ({ userId, email, csrfToken }) =>
  apiRequest(`/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    csrfToken,
    body: { confirmation: "CONFIRM", email },
    basePath: ADMIN_BASE_PATH,
  });

export const importAdminLessonModule = ({ file, csrfToken }) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/modules/import", {
    method: "POST",
    csrfToken,
    body: formData,
    basePath: ADMIN_BASE_PATH,
  });
};

export const notifyProfileChange = (detail = {}) => {
  window.dispatchEvent(new CustomEvent("openquiz:profile-updated", { detail }));
};

export const notifyDashboardProgressChanged = (detail = {}) => {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(DASHBOARD_CACHE_KEY_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Browser storage can be unavailable without affecting the progress refresh event.
  }

  window.dispatchEvent(new CustomEvent("openquiz:progress-updated", { detail }));
};

export const trackDashboardEvent = async ({ type, csrfToken, ...payload }) => {
  const response = await apiRequest("/events", {
    method: "POST",
    csrfToken,
    body: { type, ...payload },
    basePath: DASHBOARD_BASE_PATH,
  });
  notifyDashboardProgressChanged({ rewards: response?.rewards });
  return response;
};

export const clearDashboardCache = (userId) => {
  window.sessionStorage.removeItem(`${DASHBOARD_CACHE_KEY_PREFIX}${userId}`);
};

export const getLesson = (moduleId, lessonId) =>
  apiRequest(`/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`, {
    method: "GET",
    basePath: LESSONS_BASE_PATH,
  });

export const getLessonModules = () =>
  apiRequest("/modules", { method: "GET", basePath: LESSONS_BASE_PATH });

export const getPublicLessonModules = () =>
  apiRequest("/public/modules", { method: "GET", basePath: LESSONS_BASE_PATH });

export const getPublicLesson = (moduleId, lessonId) =>
  apiRequest(`/public/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`, {
    method: "GET",
    basePath: LESSONS_BASE_PATH,
  });

export const getLastLesson = () =>
  apiRequest("/last", {
    method: "GET",
    basePath: LESSONS_BASE_PATH,
  });

export const getLessonProgress = (moduleId) =>
  apiRequest(`/progress?moduleId=${encodeURIComponent(moduleId)}`, {
    method: "GET",
    basePath: LESSONS_BASE_PATH,
  });

export const updateLessonProgress = ({
  moduleId,
  lessonId,
  microLessonId,
  currentChunkIndex,
  csrfToken,
}) =>
  apiRequest("/progress", {
    method: "PATCH",
    csrfToken,
    body: { moduleId, lessonId, microLessonId, currentChunkIndex },
    basePath: LESSONS_BASE_PATH,
  });

export const completeLesson = async ({ moduleId, lessonId, csrfToken }) => {
  const response = await apiRequest("/progress/complete", {
    method: "POST",
    csrfToken,
    body: { moduleId, lessonId },
    basePath: LESSONS_BASE_PATH,
  });

  notifyDashboardProgressChanged({ type: "lesson_complete" });
  return response;
};

export const restartLessonProgress = ({ moduleId, csrfToken }) =>
  apiRequest("/progress/restart", {
    method: "PATCH",
    csrfToken,
    body: { moduleId },
    basePath: LESSONS_BASE_PATH,
  });

export const checkQuizAnswer = ({ moduleId, microLessonId, questionId, choiceIds }) =>
  apiRequest("/check", {
    method: "POST",
    body: { moduleId, microLessonId, questionId, choiceIds },
    basePath: QUIZZES_BASE_PATH,
  });

//User completes microlesson
export const completeMicroLesson = async ({ moduleId, microLessonId, csrfToken }) => {
  const response = await apiRequest("/complete", {
    method: "POST",
    csrfToken,
    body: {
      moduleId,
      microLessonId,
    },
    basePath: LESSONS_BASE_PATH,
  });

  notifyDashboardProgressChanged({ rewards: response?.rewards });
  return response;
};

export const getQuizProgress = () =>
  apiRequest("/progress", {
    method: "GET",
    basePath: QUIZZES_BASE_PATH,
  });

export const getQuizAttempts = () =>
  apiRequest("/attempts", {
    method: "GET",
    basePath: QUIZZES_BASE_PATH,
  });

export const startQuiz = ({ moduleId, microLessonId, csrfToken }) =>
  apiRequest("/start", {
    method: "POST",
    csrfToken,
    body: { moduleId, microLessonId },
    basePath: QUIZZES_BASE_PATH,
  });

export const submitQuiz = async (microLessonId, { attemptId, moduleId, answers, csrfToken }) => {
  const response = await apiRequest(`/${encodeURIComponent(microLessonId)}/submit`, {
    method: "POST",
    csrfToken,
    body: { attemptId, moduleId, answers },
    basePath: QUIZZES_BASE_PATH,
  });

  notifyDashboardProgressChanged({ rewards: response?.rewards });
  return response;
};
