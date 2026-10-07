import { Link } from "react-router";
import Badge from "../../../shared/Badge/Badge.component";
import Card from "../../../shared/Card/Card.component";
import Button from "../../../shared/Button/Button.component";
import ProgressBar from "../../../shared/ProgressBar/ProgressBar.component";
import { badgeMap } from "../../../constants/badges";

const fallbackHero = {
  state: "new_user",
  displayName: "Learner",
  greeting: "Welcome back",
  statusText: "Start with one short lesson and get your first win today.",
  streak: {
    currentDays: 0,
    longestDays: 0,
    activeLearningDays: 0,
    helperText: "Start your streak with a lesson.",
  },
  dailyGoal: {
    current: 0,
    target: 2,
    label: "0 / 2 lessons",
    isMet: false,
  },
  primaryAction: {
    label: "Start learning",
    href: "/learn",
  },
};

const formatStreakLabel = (days) => {
  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
};

export default function DashboardHero({ hero, nextAction, overallProgress, badges = [], xp = 0 }) {
  const resolvedHero = hero || fallbackHero;
  const streakDays = Number.isFinite(resolvedHero?.streak?.currentDays)
    ? resolvedHero.streak.currentDays
    : 0;

  const totalXp = Number.isFinite(xp) ? xp : 0;

  const longestStreak = Number.isFinite(resolvedHero?.streak?.longestDays)
    ? resolvedHero.streak.longestDays
    : 0;

  const activeLearningDays = Number.isFinite(resolvedHero?.streak?.activeLearningDays)
    ? resolvedHero.streak.activeLearningDays
    : 0;
  const goalCurrent = Number.isFinite(resolvedHero?.dailyGoal?.current)
    ? resolvedHero.dailyGoal.current
    : 0;
  const goalTarget = Number.isFinite(resolvedHero?.dailyGoal?.target)
    ? resolvedHero.dailyGoal.target
    : 1;
  const goalBadgeText = resolvedHero?.dailyGoal?.isMet ? "Goal met" : "In progress";
  const ctaLabel = resolvedHero?.primaryAction?.label || "Continue learning";
  const ctaHref = resolvedHero?.primaryAction?.href || "/learn";
  const recommendationTitle = nextAction?.title || ctaLabel;
  const recommendationDescription = nextAction?.description || resolvedHero.statusText;
  const recommendationCtaLabel = nextAction?.ctaLabel || ctaLabel;
  const recommendationHref = nextAction?.href || ctaHref;
  const completedLessons = Number.isFinite(overallProgress?.completedLessons)
    ? overallProgress.completedLessons
    : 0;
  const totalLessons = Number.isFinite(overallProgress?.totalLessons)
    ? overallProgress.totalLessons
    : 0;
  const overallPercent = Number.isFinite(overallProgress?.overallPercent)
    ? overallProgress.overallPercent
    : 0;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-surface-raised p-5 text-foreground shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-start">
        <div>
          <h1 className="font-heading text-h2 font-bold text-heading">{resolvedHero.greeting}</h1>
          <p className="mt-2 max-w-2xl text-neutral-700">{resolvedHero.statusText}</p>

          {totalLessons > 0 ? (
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between gap-3 text-small text-neutral-700">
                <span className="font-semibold text-heading">Overall progress</span>
                <span>{overallPercent}%</span>
              </div>
              <ProgressBar
                value={overallPercent}
                min={0}
                max={100}
                label="Overall learning progress"
                className="mt-2"
              />
              <p className="mt-1 text-small text-neutral-600">
                {completedLessons} of {totalLessons} lessons complete
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <p className="text-small font-semibold uppercase tracking-wide text-primary">
              Recommended next
            </p>
            <h2 className="mt-1 font-heading text-h4 font-bold text-heading">
              {recommendationTitle}
            </h2>
            <p className="mt-1 max-w-xl text-small text-neutral-700">{recommendationDescription}</p>
            <Button
              as={Link}
              to={recommendationHref}
              variant="primary"
              className="mt-3 px-5 py-2.5"
            >
              {recommendationCtaLabel}
            </Button>
          </div>
          <article className="mt-5 rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Earned Badges
            </p>

            {badges.length === 0 ? (
              <div className="mt-5 mb-5 rounded-lg border border-dashed border-neutral-300 p-4 text-center">
                <p className="font-semibold text-heading">Welcome to your progress dashboard! 🎉</p>
                <p className="mt-1 text-small text-neutral-600">
                  Complete lessons, build streaks, and pass quizzes to earn your first badge.
                </p>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                {badges.map((earnedBadge) => {
                  const badge = badgeMap[earnedBadge.badge_id];

                  if (!badge) return null;

                  return (
                    <Card
                      key={earnedBadge.badge_id}
                      className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-surface-inset px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <div className="text-3xl">{badge.icon}</div>

                        <div className="flex flex-col">
                          <h3 className="font-semibold">{badge.title}</h3>

                          <p className="text-small text-neutral-600">{badge.description}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-1">
          <article className="rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Streak</p>
            <p className="mt-1 text-lg font-bold text-heading">{formatStreakLabel(streakDays)}</p>
            <p className="mt-1 text-small text-neutral-600">{resolvedHero?.streak?.helperText}</p>
          </article>

          <article className="rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Total XP
            </p>
            <p className="mt-1 text-lg font-bold text-heading">{totalXp} XP</p>
            <p className="mt-1 text-small text-neutral-600">
              Total experience earned from lessons and quizzes.
            </p>
          </article>

          <article className="rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Longest Streak
            </p>
            <p className="mt-1 text-lg font-bold text-heading">
              {formatStreakLabel(longestStreak)}
            </p>
            <p className="mt-1 text-small text-neutral-600">How far can you go?</p>
          </article>

          <article className="rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Learning Days
            </p>
            <p className="mt-1 text-lg font-bold text-heading">
              {formatStreakLabel(activeLearningDays)}
            </p>
            <p className="mt-1 text-small text-neutral-600">
              Total days you've completed a new micro lesson.
            </p>
          </article>

          <article className="rounded-xl border border-neutral-200 bg-surface-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Today's goal
              </p>
              <Badge
                mode="pill"
                variant={resolvedHero?.dailyGoal?.isMet ? "success" : "default"}
                label={goalBadgeText}
                className="px-2 py-1 text-xs"
              />
            </div>
            <p className="mt-1 font-semibold text-heading">{resolvedHero?.dailyGoal?.label}</p>
            <ProgressBar
              value={goalCurrent}
              min={0}
              max={goalTarget}
              label="Daily goal progress"
              className="mt-3"
            />
          </article>
        </div>
        <div></div>
      </div>

      {resolvedHero.state === "all_caught_up" ? (
        <p className="mt-4 text-small text-neutral-600">
          Today's activity is already counted in your streak.
        </p>
      ) : null}
    </section>
  );
}
