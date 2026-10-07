import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ONBOARDING_STEPS, OnboardingProvider, useOnboarding } from "./OnboardingContext";
import { AuthProvider } from "./AuthContext";
import * as api from "../services/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/api");
const mockNavigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const UserTest = () => {
  const { currentStep, handleNextStep } = useOnboarding();
  return (
    <div>
      <span data-testid="syncStep"> {currentStep ?? "null"}</span>
      <button onClick={handleNextStep}>Next</button>
    </div>
  );
};

describe("OnboardingContext tests", () => {
  beforeEach(() => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({ user: { id: "learner-1", name: "Learner" }, csrfToken: "test-csrf" }),
    );
  });

  it("persists completed onboarding using the value read on reload", async () => {
    localStorage.removeItem("openquiz_onboarding_complete");
    api.getOnboardingState.mockResolvedValueOnce({
      onboarding: { is_completed: true },
    });
    render(
      <AuthProvider>
        <OnboardingProvider>
          <UserTest />
        </OnboardingProvider>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(localStorage.getItem("openquiz_onboarding_complete")).toBe("true");
    });
    expect(screen.getByTestId("syncStep")).toHaveTextContent("null");
    localStorage.removeItem("openquiz_onboarding_complete");
  });

  it("sends the lesson tour through the last-lesson redirect", () => {
    expect(ONBOARDING_STEPS[2]).toEqual({
      page: "lessonPage",
      route: "/learn/last-lesson",
    });
  });

  it(" sends API response, syncs with backend, simulates click and awaits state change", async () => {
    api.getOnboardingState.mockResolvedValueOnce({
      onboarding: { is_completed: false, started_at: "2026-01-01", current_step: 0 },
    });
    api.updateOnboardingProgress.mockResolvedValueOnce({ success: true });
    render(
      <AuthProvider>
        <OnboardingProvider>
          <UserTest />
        </OnboardingProvider>
      </AuthProvider>,
    );

    //waiting for initial fetch and set currentStep to 0
    await waitFor(() => {
      expect(screen.getByTestId("syncStep")).toHaveTextContent("0");
    });
    fireEvent.click(screen.getByText("Next"));
    //syncs the information of a completed step to the backend database with sendOnboardingStepToDB before updating the state of the current step
    await waitFor(() => {
      expect(screen.getByTestId("syncStep")).toHaveTextContent("1");
      expect(api.updateOnboardingProgress).toHaveBeenCalledWith({
        tourKey: "dashboardPage",
        step: 0,
        status: "completed",
        dismissed: false,
        csrfToken: "test-csrf",
      });
    });
  });
  it("when unable to sync with backend, the API error is handled", async () => {
    api.getOnboardingState.mockResolvedValueOnce({
      onboarding: { is_completed: false, started_at: "2026-01-01", current_step: 0 },
    });
    api.updateOnboardingProgress.mockRejectedValueOnce(new Error("API Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AuthProvider>
        <OnboardingProvider>
          <UserTest />
        </OnboardingProvider>
      </AuthProvider>,
    );
    //wait for initial payload so then then the button reacts to loaded state
    await waitFor(() => {
      expect(screen.getByTestId("syncStep")).toHaveTextContent("0");
    });
    //Simulate click event which will cause failure and then wait for catch error block
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });
});
