import { useCallback, useEffect, useMemo, useState } from "react";
import { getLeaderboard, getPublicLeaderboard } from "../services/api";

export default function useLeaderboardData({ userId, isAuthenticated, publicView = false }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(publicView || (isAuthenticated && userId)));
  const [error, setError] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    if (!publicView && (!isAuthenticated || !userId)) {
      setLeaderboard(null);
      setIsLoading(false);
      setError("");
      return null;
    }

    setIsLoading(true);
    setError("");
    try {
      const payload = await (publicView ? getPublicLeaderboard() : getLeaderboard());
      setLeaderboard(payload);
      return payload;
    } catch (requestError) {
      setError(requestError.message || "We could not load the leaderboard right now.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, publicView]);

  useEffect(() => {
    void Promise.resolve().then(fetchLeaderboard);
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return undefined;

    const refresh = () => void fetchLeaderboard();
    window.addEventListener("openquiz:profile-updated", refresh);
    window.addEventListener("openquiz:progress-updated", refresh);
    return () => {
      window.removeEventListener("openquiz:profile-updated", refresh);
      window.removeEventListener("openquiz:progress-updated", refresh);
    };
  }, [fetchLeaderboard, isAuthenticated, userId]);

  return useMemo(
    () => ({ leaderboard, isLoading, error, refresh: fetchLeaderboard }),
    [error, fetchLeaderboard, isLoading, leaderboard],
  );
}
