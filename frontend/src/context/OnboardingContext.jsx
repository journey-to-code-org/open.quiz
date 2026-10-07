import { createContext, use, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "./AuthContext";
import { ONBOARDING_STEPS } from "../features/onboarding/onboarding.constants";
import {
  resetOnboardingProgress as apiResetOnboarding,
  updateOnboardingProgress as apiUpdateOnboardingProgress,
  beginOnboarding as apiBeginOnboarding,
  getOnboardingState as apiGetOnboardingState,
  toggleOnboardingWorkflow as apiToggleOnboardingWorkflow,
} from "../services/api";

export { ONBOARDING_STEPS } from "../features/onboarding/onboarding.constants";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const { csrfToken, isAuthenticated } = useAuthContext();
  const [currentStep, setCurrentStep] = useState(null); //when you are waiting for user's response
  const navigate = useNavigate();
  const stepSyncInFlightRef = useRef(false);

  const [hasCompleted, setHasCompleted] = useState(() => {
    const status = localStorage.getItem("openquiz_onboarding_complete");

    if (status === null) {
      localStorage.setItem("openquiz_onboarding_complete", "false");
      return false;
    }
    return status === "true";
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    async function fetchOnboardingState() {
      try {
        const response = await apiGetOnboardingState();
        if (response?.onboarding) {
          const onboarding = response.onboarding;
          const completed = Boolean(onboarding.is_completed);
          setHasCompleted(completed);
          localStorage.setItem("openquiz_onboarding_complete", completed ? "true" : "false");
          if (!completed && onboarding.started_at) {
            setCurrentStep(onboarding.current_step ?? 0);
          } else if (!completed && !onboarding.started_at) {
            setCurrentStep(0);
          } else {
            setCurrentStep(null);
          }
        }
      } catch (error) {
        console.error("Failed fetching onboarding:", error);
      }
    }
    fetchOnboardingState();
  }, [isAuthenticated]);
  const startOnboarding = async () => {
    setCurrentStep(0);
    localStorage.setItem("openquiz_onboarding_complete", "false");
    setHasCompleted(false);
    navigate(ONBOARDING_STEPS[0].route);
    try {
      await apiBeginOnboarding();
      await apiResetOnboarding(csrfToken);
    } catch (error) {
      console.error("Fail to start onboarding session:", error);
    }
  };
  const sendOnboardingStepToDB = async (tourKey, step, status, dismissed) => {
    try {
      await apiUpdateOnboardingProgress({
        tourKey,
        step,
        status,
        dismissed,
        csrfToken,
      });
    } catch (err) {
      console.error("Fail to sync onboard progress:", err);
    }
  };
  const skipOnboarding = async () => {
    setCurrentStep(null);
    localStorage.setItem("openquiz_onboarding_complete", "true");
    setHasCompleted(true);
    navigate("/dashboard");

    try {
      await apiToggleOnboardingWorkflow({ enabled: false, csrfToken });
    } catch (err) {
      console.error("Failed to skip onboarding session:", err);
    }
  };
  const handleNextStep = async () => {
    // A second click while the step is syncing would resend the same step.
    if (stepSyncInFlightRef.current) return;
    stepSyncInFlightRef.current = true;

    const activeTourKey = ONBOARDING_STEPS[currentStep]?.page;

    try {
      if (activeTourKey) {
        await sendOnboardingStepToDB(activeTourKey, currentStep, "completed", false);
      }
    } catch (err) {
      console.error("Failed to sync step to backend: ", err);
    } finally {
      stepSyncInFlightRef.current = false;
    }
    const nextStepIndex = currentStep + 1;

    if (ONBOARDING_STEPS[nextStepIndex]) {
      setCurrentStep(nextStepIndex);
      navigate(ONBOARDING_STEPS[nextStepIndex].route);
    } else {
      localStorage.setItem("openquiz_onboarding_complete", "true");
      setHasCompleted(true);
      navigate("/dashboard");
    }
  };
  const value = {
    currentStep,
    hasCompleted,
    activePage: currentStep !== null ? ONBOARDING_STEPS[currentStep]?.page : null,
    startOnboarding,
    skipOnboarding,
    handleNextStep,
  };
  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding() {
  const context = use(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
