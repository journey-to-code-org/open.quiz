import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { getPublicLessonModules } from "../services/api";
import { loadContentPackage } from "../contentPackages";

vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => ({ isAuthenticated: false }),
}));

vi.mock("../services/api", () => ({
  getPublicLessonModules: vi.fn(),
}));

vi.mock("../contentPackages", () => ({
  loadContentPackage: vi.fn(),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("links guests to the first installed lesson preview", async () => {
    getPublicLessonModules.mockResolvedValue({
      modules: [{ id: "finance-basics", firstLessonId: "lesson 1" }],
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const previewLink = await screen.findByRole("link", { name: "Explore lessons" });
    expect(previewLink).toHaveAttribute("href", "/learn/finance-basics/lesson%201?sample=true");
  });

  it("disables lesson exploration when the instance has no previewable modules", async () => {
    getPublicLessonModules.mockResolvedValue({ modules: [] });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No lessons available" })).toBeDisabled();
    });
  });

  it("shows avatar graphics supplied by the selected content package", async () => {
    vi.stubEnv("VITE_CONTENT_PACKAGE", "openquiz-introduction");
    getPublicLessonModules.mockResolvedValue({ modules: [] });
    loadContentPackage.mockResolvedValue({
      characterImages: { nova: "/nova.svg", kit: "/kit.svg" },
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("img", { name: "Nova" })).toHaveAttribute("src", "/nova.svg");
    expect(screen.getByRole("img", { name: "Kit" })).toHaveAttribute("src", "/kit.svg");
  });
});
