import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import NavBar from "./NavBar.component";

describe("NavBar", () => {
  it.each([false, true])("links to the public leaderboard when signedIn is %s", (signedIn) => {
    render(
      <MemoryRouter>
        <NavBar signedIn={signedIn} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
  });
  it("uses the authenticated user's avatar label after hydration", () => {
    const { rerender } = render(
      <MemoryRouter>
        <NavBar signedIn avatarLabel="A" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "A" })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NavBar signedIn avatarLabel="M" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "M" })).toBeInTheDocument();
  });

  it("renders a saved avatar URL and falls back to initials when the image fails", () => {
    render(
      <MemoryRouter>
        <NavBar signedIn avatarLabel="M" avatarUrl="https://example.com/maya.png" />
      </MemoryRouter>,
    );

    const image = screen.getByAltText("M avatar");
    expect(image).toHaveAttribute("src", "https://example.com/maya.png");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");

    fireEvent.error(image);

    expect(screen.getByRole("link", { name: "M" })).toBeInTheDocument();
  });

  it("opens the signed-out mobile menu and closes it after link activation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls");
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();

    const loginLinks = screen.getAllByRole("link", { name: "Login" });
    await user.click(loginLinks.at(-1));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("supports keyboard activation for the menu toggle", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NavBar signedIn />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
