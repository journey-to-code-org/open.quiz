import { useCallback, useEffect, useMemo, useState } from "react";
import { getLeaderboard } from "../services/api";

export default function useLeaderboardData({ userId, isAuthenticated }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(isAuthenticated && userId));
  const [error, setError] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setLeaderboard(null);
      setIsLoading(false);
      setError("");
      return null;
    }

    setIsLoading(true);
    setError("");
    try {
      const payload = await getLeaderboard();
      setLeaderboard(payload);
      return payload;
    } catch (requestError) {
      setError(requestError.message || "We could not load the leaderboard right now.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    void Promise.resolve().then(fetchLeaderboard);
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return undefined;

    const refresh = () => void fetchLeaderboard();
    window.addEventListener("sprout:profile-updated", refresh);
    window.addEventListener("sprout:progress-updated", refresh);
    return () => {
      window.removeEventListener("sprout:profile-updated", refresh);
      window.removeEventListener("sprout:progress-updated", refresh);
    };
  }, [fetchLeaderboard, isAuthenticated, userId]);

  return useMemo(
    () => ({ leaderboard, isLoading, error, refresh: fetchLeaderboard }),
    [error, fetchLeaderboard, isLoading, leaderboard],
  );
}
