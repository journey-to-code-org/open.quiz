import { Link } from "react-router";
import Button from "../../../shared/Button/Button.component";
import Card from "../../../shared/Card/Card.component";

function Avatar({ displayName, avatarUrl }) {
  const initial = displayName?.trim().charAt(0).toUpperCase() || "?";

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-surface-inset text-sm font-bold text-heading">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}

function LeaderboardEntry({ entry, isCurrentUser }) {
  return (
    <li
      aria-current={isCurrentUser ? "true" : undefined}
      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 ${
        isCurrentUser ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface-inset"
      }`}
    >
      <span className="text-center text-sm font-bold text-heading">#{entry.rank}</span>
      <span className="flex min-w-0 items-center gap-3">
        <Avatar displayName={entry.displayName} avatarUrl={entry.avatarUrl} />
        <span className="truncate text-sm font-semibold text-heading">
          {entry.displayName}
          {isCurrentUser ? <span className="ml-1 text-primary">(You)</span> : null}
        </span>
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-neutral-700">
        {entry.weeklyXp.toLocaleString()} XP
      </span>
    </li>
  );
}

export default function LeaderboardCard({ leaderboard }) {
  const { optedIn = false, entries = [], currentUser = null } = leaderboard || {};

  if (!optedIn) {
    return (
      <Card className="space-y-3">
        <h2 className="font-heading text-h4 font-bold text-heading">Weekly leaderboard</h2>
        <p className="text-small text-neutral-600">
          Join for a friendly look at this week&apos;s XP rankings. Only your display name and
          avatar will be visible.
        </p>
        <Button as={Link} to="/profile" variant="primary">
          Choose leaderboard settings
        </Button>
      </Card>
    );
  }

  const visibleEntries = entries.slice(0, 20);
  const currentUserIsVisible = visibleEntries.some((entry) => entry.isCurrentUser);

  return (
    <Card>
      <header>
        <h2 className="font-heading text-h4 font-bold text-heading">Weekly leaderboard</h2>
        <p className="mt-1 text-small text-neutral-600">Resets Mondays at 00:00 UTC.</p>
      </header>

      {visibleEntries.length > 0 ? (
        <ol className="mt-4 space-y-2" aria-label="Weekly XP rankings">
          {visibleEntries.map((entry) => (
            <LeaderboardEntry
              key={`${entry.rank}-${entry.displayName}-${entry.avatarUrl ?? "initials"}-${entry.weeklyXp}`}
              entry={entry}
              isCurrentUser={entry.isCurrentUser}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-inset p-4 text-small text-neutral-600">
          No XP rankings yet. Complete an activity to get the week started.
        </p>
      )}

      <div className="mt-4 border-t border-neutral-200 pt-4">
        {currentUser ? (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-primary/10 px-4 py-3 ring-1 ring-primary/30">
            <div>
              <p className="font-heading font-bold text-heading">You are #{currentUser.rank}</p>
              <p className="text-small text-neutral-600">
                {currentUserIsVisible
                  ? "You’re in the top 20 this week."
                  : "Your rank is outside the top 20."}
              </p>
            </div>
            <span className="whitespace-nowrap font-semibold text-heading">
              {currentUser.weeklyXp.toLocaleString()} XP
            </span>
          </div>
        ) : (
          <p className="text-small text-neutral-600">Earn XP to receive your first weekly rank.</p>
        )}
      </div>
    </Card>
  );
}
