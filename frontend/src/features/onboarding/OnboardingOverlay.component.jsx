import { useAppName } from "../../app/instanceAssets";

const STEP_CONTENT = {
  0: {
    title: "Welcome to {appName}!",
    text: "Your email has been successfully verified! This is your dashboard where you can see your achievements.Let's kick things off with a quick tour. Click 'Next Step' to hop straight over to your profile manager layout.",
  },
  1: {
    title: "Your Profile Page",
    text: "This is where your personal information live. You can update your avatar icon right here by updating your name, it will show the first letter of your name!",
  },
  2: {
    title: "Lesson Page",
    text: "Welcome to your first learning playground! Here you will go through small lessons followed by mini checks to test your knowledge from the lesson.",
  },
  3: {
    title: "Learning Path",
    text: "This is the learning path and helps you see where you are in your journey. Click on an unlocked step and proceed to the lesson. Have Fun!",
  },
};

export default function OnboardingOverlay({
  hasCompleted,
  currentStep,
  activePage,
  pageName,
  onNext,
  onStart,
  onSkip,
}) {
  const appName = useAppName();
  const stepContent = STEP_CONTENT[currentStep];
  const tourContent = stepContent
    ? { ...stepContent, title: stepContent.title.replace("{appName}", appName) }
    : {};
  //render floating step popup if step is active and matches the current route
  const showTourPopup = currentStep !== null && activePage === pageName && !hasCompleted;

  return (
    <>
      {pageName === "dashboardPage" && hasCompleted && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-semibold text-heading">Need a refresher?</span>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Retake tour
          </button>
        </div>
      )}

      {showTourPopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {currentStep + 1}
            </span>
            <h4 className="font-heading text-sm font-bold text-heading">{tourContent.title}</h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">{tourContent.text}</p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onSkip}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Skip
            </button>
            <button
              onClick={onNext}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {currentStep === 3 ? "Finish Tour" : "Next Step"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
