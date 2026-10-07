import { Link } from "react-router";
import { ROUTES } from "../app/router/routes";
import { useAuthContext } from "../context/AuthContext";
import LeaderboardCard from "../features/dashboard/LeaderboardCard/LeaderboardCard.component";
import useLeaderboardData from "../hooks/useLeaderboardData";
import Button from "../shared/Button/Button.component";
import EmptyState from "../shared/EmptyState/EmptyState.component";
import Spinner from "../shared/Spinner/Spinner.component";

export default function LeaderboardPage() {
  const { isAuthenticated, user } = useAuthContext();
  const { leaderboard, isLoading, error, refresh } = useLeaderboardData({
    publicView: true,
    isAuthenticated,
    userId: user?.id,
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-h2 font-bold text-heading">Leaderboard</h1>
        <p className="text-small text-neutral-600">
          Celebrate this week's learning. Only learners who choose to participate appear here.
        </p>
        <Link
          to={isAuthenticated ? ROUTES.PROFILE : ROUTES.LOGIN}
          className="text-small text-primary underline"
        >
          {isAuthenticated ? "Choose leaderboard settings" : "Log in to join the leaderboard"}
        </Link>
      </header>
      {error ? (
        <EmptyState
          title="We could not load the leaderboard"
          message={error}
          action={<Button onClick={() => void refresh()}>Retry</Button>}
        />
      ) : isLoading || !leaderboard ? (
        <Spinner label="Loading leaderboard" />
      ) : (
        <LeaderboardCard leaderboard={leaderboard} publicView />
      )}
    </section>
  );
}
