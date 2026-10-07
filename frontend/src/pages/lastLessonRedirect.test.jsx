import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LastLessonRedirect from "./LastLessonRedirect";

// Hoist the API mock so it is available when Vitest moves vi.mock to the top of the file.
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getLastLesson: vi.fn(),
  },
}));

// Mock the API so these tests can control which lesson path is returned.
vi.mock("../services/api", () => ({
  getLastLesson: mockApi.getLastLesson,
}));

describe("last lesson redirect", () => {
  beforeEach(() => {
    // Start each test with fresh mocks and no saved lesson path.
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("redirects to the saved last lesson path when the API returns one", async () => {
    // Return a saved lesson path without making a real API request.
    mockApi.getLastLesson.mockResolvedValue({ lastLessonPath: "/learn/cashFlow/1.2" });

    render(
      <MemoryRouter initialEntries={["/learn/last-lesson"]}>
        <Routes>
          <Route path="/learn/last-lesson" element={<LastLessonRedirect />} />
          <Route path="/learn/cashFlow/1.2" element={<div>Resume lesson</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // The learner should be redirected to the lesson returned by the API.
    await waitFor(() => {
      expect(screen.getByText("Resume lesson")).toBeInTheDocument();
    });

    // Save the returned path locally so it can be used as a fallback later.
    expect(localStorage.getItem("lastLessonPath")).toBe("/learn/cashFlow/1.2");
  });

  it("falls back to the cached path when the API request fails", async () => {
    // Pretend a previous lesson path was already saved in the browser.
    localStorage.setItem("lastLessonPath", "/learn/cashFlow/3.1");

    // Force the API request to fail so the cached path is used instead.
    mockApi.getLastLesson.mockRejectedValue(new Error("Failed to fetch"));

    render(
      <MemoryRouter initialEntries={["/learn/last-lesson"]}>
        <Routes>
          <Route path="/learn/last-lesson" element={<LastLessonRedirect />} />
          <Route path="/learn/cashFlow/3.1" element={<div>Cached resume</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // The learner should still be redirected using the locally saved lesson path.
    await waitFor(() => {
      expect(screen.getByText("Cached resume")).toBeInTheDocument();
    });
  });

  it("returns to the learning path when the learner has no lesson history", async () => {
    mockApi.getLastLesson.mockResolvedValue({ lastLessonPath: null });

    render(
      <MemoryRouter initialEntries={["/learn/last-lesson"]}>
        <Routes>
          <Route path="/learn/last-lesson" element={<LastLessonRedirect />} />
          <Route path="/learn" element={<div>Learning path</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learning path")).toBeInTheDocument();
    });
  });
});
