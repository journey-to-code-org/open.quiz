import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { resolveLanding } from "../app/landingContent";

const site = vi.hoisted(() => ({ assets: {}, landing: null, appName: "open.quiz" }));

vi.mock("../app/instanceAssets", () => ({
  useInstanceAssets: () => site.assets,
  useLanding: () => resolveLanding(site.landing),
  useAppName: () => site.appName,
}));
vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => ({ isAuthenticated: false }),
}));
vi.mock("../services/api", () => ({
  getPublicLessonModules: vi.fn().mockResolvedValue({ modules: [] }),
}));
vi.mock("../contentPackages", () => ({ loadContentPackage: vi.fn() }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

describe("HomePage landing content", () => {
  beforeEach(() => {
    site.assets = {};
    site.landing = null;
    site.appName = "open.quiz";
  });

  it("renders admin-configured copy and hides empty sections", async () => {
    site.appName = "Sprout";
    site.landing = {
      hero: { heading: "Grow your money", body: "Tiny lessons." },
      benefits: { heading: "Why Sprout", items: [{ icon: "🌱", title: "Small", body: "Bits" }] },
      steps: { heading: "Steps", items: [] },
      faq: { heading: "Questions", items: [{ question: "Free?", answer: "Yes." }] },
    };
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Grow your money" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tiny lessons.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why Sprout" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Steps" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "1. Free?" })).toBeInTheDocument();
  });

  it("shows up to three theme avatars with the guide first", async () => {
    site.assets = {
      avatars: {
        ramona: { url: "/ramona.png", name: "Ramona" },
        guide: { url: "/beaver.png", name: "Beaver" },
        abigail: { url: "/abigail.png", name: "Abigail" },
        extra: { url: "/extra.png", name: "Extra" },
      },
    };
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 1 });
    const hero = container.querySelector("[data-hero-avatars]");
    const images = within(hero).getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("alt", "Beaver");
  });

  it("hides theme avatars when the landing page turns them off", async () => {
    site.assets = { avatars: { guide: { url: "/beaver.png", name: "Beaver" } } };
    site.landing = { hero: { showAvatars: false } };
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelector("[data-hero-avatars]")).toBeNull();
  });
});
