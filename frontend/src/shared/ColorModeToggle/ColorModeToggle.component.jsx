import { useColorMode } from "../../app/instanceAssets";
import { setColorModePreference } from "../../app/instanceTheme";

const placementClasses = {
  header: "",
  footer: "",
  "bottom-right": "fixed bottom-4 right-4 z-40 shadow-lg sm:bottom-6 sm:right-6",
  "bottom-left": "fixed bottom-4 left-4 z-40 shadow-lg sm:bottom-6 sm:left-6",
};

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Lets learners switch between light and dark when the admin shows the toggle at this placement. */
export default function ColorModeToggle({ placement }) {
  const { mode, settings } = useColorMode();
  if (!settings.showToggle || settings.togglePosition !== placement) return null;
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setColorModePreference(isDark ? "light" : "dark")}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-surface-raised text-heading transition-colors hover:bg-surface-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${placementClasses[placement] || ""}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
