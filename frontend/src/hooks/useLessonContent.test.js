import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useLessonContent from "./useLessonContent";
import * as api from "../services/api";

// Mock the lesson API so these tests can control the response without making a real request.
vi.mock("../services/api", () => ({
  getLesson: vi.fn(),
}));

describe("useLessonContent", () => {
  beforeEach(() => {
    // Clear any previous API mock calls before each test.
    vi.clearAllMocks();
  });

  it("loads lesson data and exposes progress", async () => {
    const payload = {
      moduleData: { id: "cashFlow" },
      lessonData: { id: "1.1" },
      progress: { currentMicroLessonId: "1.1.1" },
    };

    // Return a successful lesson response with its current progress.
    api.getLesson.mockResolvedValue(payload);

    const { result } = renderHook(() =>
      useLessonContent({ moduleId: "cashFlow", lessonId: "1.1" }),
    );

    // Wait for the hook to finish loading before checking the returned lesson state.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      moduleData: payload.moduleData,
      lessonData: payload.lessonData,
      progress: payload.progress,
      error: "",
    });
    expect(api.getLesson).toHaveBeenCalledWith("cashFlow", "1.1");
  });

  it("supports disabled mode without making a request", async () => {
    // Disable loading so the hook should return its default state without calling the API.
    const { result } = renderHook(() => useLessonContent({ enabled: false }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      moduleId: null,
      lessonId: null,
      error: "",
    });
    expect(api.getLesson).not.toHaveBeenCalled();
  });

  it("returns a stable error when lesson loading fails", async () => {
    // Force the lesson request to fail so we can check the hook's error state.
    api.getLesson.mockRejectedValue(new Error("Lesson unavailable"));

    const { result } = renderHook(() =>
      useLessonContent({ moduleId: "cashFlow", lessonId: "1.1" }),
    );

    // Wait for the failed request to update the hook state.
    await waitFor(() => expect(result.current.error).toBe("Lesson unavailable"));

    expect(result.current.lessonData).toBe(null);
    expect(result.current.isLoading).toBe(false);
  });
});
