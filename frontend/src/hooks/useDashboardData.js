import { useCallback, useEffect, useMemo, useState } from "react";
import { getDashboard } from "../services/api";

// Sets default cache Time to Live to 30 seconds.
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;

const getCacheKey = (userId) => `openquiz.dashboard.${userId}`;

const readCachedDashboard = (userId) => {
  // We use sessionStorage to cache dashboard data for the current browser session.
  const stored = window.sessionStorage.getItem(getCacheKey(userId));
  if (!stored) {
    return null;
  }

  try {
    // Cache entries are stored as { payload, expiresAt }.
    const cached = JSON.parse(stored);
    // Return cached data only while it is still fresh.
    return cached.expiresAt > Date.now() ? cached.payload : null;
  } catch {
    // Ignore malformed cache values and treat as a cache miss.
    return null;
  }
};
const cacheDashboard = (userId, payload) => {
  try {
    window.sessionStorage.setItem(
      getCacheKey(userId),
      // Expiration is evaluated on read to keep writes simple.
      JSON.stringify({ payload, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS }),
    );
  } catch {
    // A full or unavailable session store just means no caching.
  }
};

export default function useDashboardData({ userId, isAuthenticated }) {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(
    async ({ force = false } = {}) => {
      // Reset local state when there is no authenticated user context.
      if (!isAuthenticated || !userId) {
        setDashboard(null);
        setIsLoading(false);
        setError("");
        return;
      }

      // Use session cache unless a forced refresh is requested.
      if (!force) {
        const cachedDashboard = readCachedDashboard(userId);
        if (cachedDashboard) {
          setDashboard(cachedDashboard);
          setIsLoading(false);
          setError("");
          return cachedDashboard;
        }
      }

      setIsLoading(true);
      setError("");

      try {
        const payload = await getDashboard();

        setDashboard(payload);
        cacheDashboard(userId, payload);
        return payload;
      } catch (requestError) {
        setError(requestError.message || "We could not load your dashboard right now.");
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, userId],
  );

  useEffect(() => {
    // Refresh the dashboard when the user completes a lesson or quiz.
    // Using void here to avoid unhandled promise rejections in case the fetch fails.
    void Promise.resolve().then(fetchDashboard);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!userId) return undefined;

    const handleProgressUpdate = () => {
      window.sessionStorage.removeItem(getCacheKey(userId));
      fetchDashboard({ force: true });
    };

    window.addEventListener("openquiz:progress-updated", handleProgressUpdate);
    return () => window.removeEventListener("openquiz:progress-updated", handleProgressUpdate);
  }, [fetchDashboard, userId]);

  const refresh = useCallback(() => {
    // Public refresh always bypasses cache.
    return fetchDashboard({ force: true });
  }, [fetchDashboard]);

  return useMemo(
    () => ({
      dashboard,
      isLoading,
      error,
      refresh,
    }),
    [dashboard, error, isLoading, refresh],
  );
}
