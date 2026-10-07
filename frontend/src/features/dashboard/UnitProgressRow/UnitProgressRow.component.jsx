import Card from "../../../shared/Card/Card.component";
import ProgressBar from "../../../shared/ProgressBar/ProgressBar.component";

export default function UnitProgressRow({ unit }) {
  const unitIcon = unit.icon || unit.name.charAt(0).toUpperCase();

  return (
    <Card className="px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-bold text-primary"
          >
            {unitIcon}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-heading">{unit.name}</p>
            <p className="text-small text-neutral-600">
              {unit.completedLessons}/{unit.totalLessons} lessons complete
            </p>
          </div>
        </div>

        <ProgressBar
          variant="circular"
          size="sm"
          value={unit.progressPercent}
          label={`${unit.name} progress`}
          className="shrink-0 self-end min-[380px]:self-auto"
        />
      </div>
    </Card>
  );
}
