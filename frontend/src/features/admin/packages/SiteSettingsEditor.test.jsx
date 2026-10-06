import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SiteSettingsEditor from "./SiteSettingsEditor";
import { updateAdminSiteSettings } from "../../../services/api";
import { applyInstanceTheme } from "../../../app/instanceTheme";
import { DEFAULT_LANDING } from "../../../app/landingContent";

vi.mock("../../../services/api", () => ({ updateAdminSiteSettings: vi.fn() }));
vi.mock("../../../app/instanceTheme", () => ({
  applyInstanceTheme: vi.fn().mockResolvedValue(undefined),
  DEFAULT_APP_NAME: "open.quiz",
}));

describe("SiteSettingsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAdminSiteSettings.mockImplementation(async ({ appName, landing }) => ({
      appName: appName ?? null,
      landing: landing ?? null,
    }));
  });

  it("saves only the app name", async () => {
    const onSaved = vi.fn();
    render(
      <SiteSettingsEditor
        csrfToken="csrf"
        settings={{ appName: null, landing: null }}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("App name"), { target: { value: "Garden" } });
    fireEvent.click(screen.getByRole("button", { name: "Save app name" }));
    await waitFor(() =>
      expect(updateAdminSiteSettings).toHaveBeenCalledWith({
        appName: "Garden",
        csrfToken: "csrf",
      }),
    );
    expect(applyInstanceTheme).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ appName: "Garden", landing: null });
    expect(await screen.findByRole("status")).toHaveTextContent("App name saved.");
  });

  it("saves edited landing copy and drops blank items", async () => {
    render(<SiteSettingsEditor csrfToken="csrf" settings={{ appName: null, landing: null }} />);
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Learn money" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    fireEvent.click(screen.getByRole("button", { name: "Save landing page" }));
    await waitFor(() => expect(updateAdminSiteSettings).toHaveBeenCalled());
    const { landing } = updateAdminSiteSettings.mock.calls[0][0];
    expect(landing.hero.heading).toBe("Learn money");
    expect(landing.faq.items).toEqual(DEFAULT_LANDING.faq.items.slice(1));
    expect(landing.benefits.items).toEqual(DEFAULT_LANDING.benefits.items);
  });

  it("resets a customized landing page", async () => {
    render(
      <SiteSettingsEditor
        csrfToken="csrf"
        settings={{ appName: "Garden", landing: { hero: { heading: "Custom" } } }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    await waitFor(() =>
      expect(updateAdminSiteSettings).toHaveBeenCalledWith({ landing: null, csrfToken: "csrf" }),
    );
  });
});
