import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppRouter from "./AppRouter";
import { useAuthContext } from "../../context/AuthContext";
import { ROUTES } from "./routes";

vi.mock("../../context/AuthContext", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("../../shared/MainLayout/MainLayout.component", () => ({
  default: () => (
    <div>
      Application layout
      <Outlet />
    </div>
  ),
}));

vi.mock("../../pages/AdminDashboardPage", () => ({
  default: () => <h1>Admin dashboard page</h1>,
}));

describe("AppRouter", () => {
  beforeEach(() => {
    useAuthContext.mockReturnValue({
      isHydrating: false,
      isAuthenticated: true,
      user: { role: "admin" },
    });
  });

  it("waits for auth hydration before rendering the application layout", () => {
    useAuthContext.mockReturnValue({ isHydrating: true });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("Application layout")).not.toBeInTheDocument();

    useAuthContext.mockReturnValue({ isHydrating: false });
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByText("Application layout")).toBeInTheDocument();
  });

  it("renders the admin dashboard at /admin/dashboard", () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.ADMIN_DASHBOARD]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Admin dashboard page" })).toBeInTheDocument();
  });

  it("renders the not-found page at /admin", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
