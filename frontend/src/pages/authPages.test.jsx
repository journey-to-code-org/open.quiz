import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import OAuthCallbackPage from "./OAuthCallbackPage";
import RegisterPage from "./RegisterPage";

const { mockGetOAuthProviders } = vi.hoisted(() => ({
  mockGetOAuthProviders: vi.fn(),
}));

const mockAuth = {
  login: vi.fn(),
  register: vi.fn(),
  completeOAuthLogin: vi.fn(),
};

// Use mocked auth functions so these tests can focus on the page behavior.
vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => mockAuth,
}));

vi.mock("../services/api", () => ({
  getOAuthProviders: mockGetOAuthProviders,
  getOAuthUrl: (provider, tosAccepted = false, next) => {
    const query = new URLSearchParams();
    if (tosAccepted) query.set("tos", "true");
    if (next) query.set("next", next);
    return `/api/v1/auth/${provider}${query.size ? `?${query}` : ""}`;
  },
}));

describe("auth pages", () => {
  beforeEach(() => {
    // Reset the auth mocks before each test so calls do not carry over.
    vi.clearAllMocks();
    mockGetOAuthProviders.mockResolvedValue({ google: true, github: true });
  });

  it("logs in and redirects to the requested next page", async () => {
    const user = userEvent.setup();

    // Return a successful login response without making a real API request.
    mockAuth.login.mockResolvedValue({ user: { id: "u-1" }, csrfToken: "csrf-1" });

    // Start on login with a next URL so we can make sure the user is sent back there.
    render(
      <MemoryRouter initialEntries={["/login?next=%2Flearn%2FcashFlow%2F1.1"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/learn/cashFlow/1.1" element={<div>Lesson page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "learner@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    // Make sure the form sends the values entered by the user.
    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith({
        email: "learner@example.com",
        password: "SecurePass123!",
        remember: false,
      });
    });

    // A successful login should redirect to the page from the next query parameter.
    await waitFor(() => {
      expect(screen.getByText("Lesson page")).toBeInTheDocument();
    });
  });

  it("shows the login error returned by the server", async () => {
    const user = userEvent.setup();

    // Pretend the server rejected the login with an authentication error.
    mockAuth.login.mockRejectedValue(new Error("Invalid email or password."));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "learner@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    // The server error should be shown to the user instead of redirecting.
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    });
  });

  it("explains when an OAuth provider cannot supply a verified email", () => {
    render(
      <MemoryRouter initialEntries={["/login?error=oauth_email_required"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We need a verified email address from your sign-in provider",
    );
  });

  it("links the social sign-in buttons to their backend provider routes", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google?tos=true",
    );
    expect(screen.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
      "href",
      "/api/v1/auth/github?tos=true",
    );
    expect(screen.getByText(/By logging in, you agree/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("passes the requested destination into the real OAuth start URL", async () => {
    render(
      <MemoryRouter initialEntries={["/login?next=%2Flearn%2FcashFlow%2F1.1"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google?tos=true&next=%2Flearn%2FcashFlow%2F1.1",
    );
  });

  it("hydrates the OAuth session and redirects to the dashboard", async () => {
    mockAuth.completeOAuthLogin.mockResolvedValue({ id: "oauth-user" });

    render(
      <MemoryRouter initialEntries={["/oauth/callback"]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockAuth.completeOAuthLogin).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Dashboard page")).toBeInTheDocument();
    });
  });

  it("redirects an OAuth admin to the admin dashboard when next is absent", async () => {
    mockAuth.completeOAuthLogin.mockResolvedValue({ id: "admin-user", role: "admin" });

    render(
      <MemoryRouter initialEntries={["/oauth/callback"]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/admin/dashboard" element={<div>Admin dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Admin dashboard")).toBeInTheDocument();
  });

  it("falls back to the normal dashboard for an unsafe OAuth next destination", async () => {
    mockAuth.completeOAuthLogin.mockResolvedValue({ id: "learner-user", role: "learner" });

    render(
      <MemoryRouter initialEntries={["/oauth/callback?next=https%3A%2F%2Fexample.com"]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows an error when OAuth session hydration fails", async () => {
    mockAuth.completeOAuthLogin.mockRejectedValue(new Error("OAuth session expired."));

    render(
      <MemoryRouter initialEntries={["/oauth/callback"]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign-in didn't work" })).toBeInTheDocument();
    });
    expect(screen.getByText("OAuth session expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login");
  });

  it("registers a user and shows the verification message on success", async () => {
    const user = userEvent.setup();

    // Return a successful registration response without making a real API request.
    mockAuth.register.mockResolvedValue({
      verificationUrl: "http://localhost:5173/verify?token=test-token",
    });

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Test User");
    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(screen.getByLabelText(/^confirm password$/i), "SecurePass123!");
    expect(screen.getByText(/By signing up, you agree/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    // Make sure registration receives the values entered in the form.
    await waitFor(() => {
      expect(mockAuth.register).toHaveBeenCalledWith({
        name: "Test User",
        email: "new@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
        tos: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    });

    // Without configured email delivery, successful registration shows a direct verification link.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Verify your email address" })).toHaveAttribute(
      "href",
      "http://localhost:5173/verify?token=test-token",
    );
  });

  it("shows a field-level email error when registration conflicts", async () => {
    const user = userEvent.setup();

    // Pretend the server returned a conflict because the email is already registered.
    mockAuth.register.mockRejectedValue({ status: 409, message: "That email is already in use." });

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Test User");
    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(screen.getByLabelText(/^confirm password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    // The registration conflict should be shown as an error for the email field.
    await waitFor(() => {
      expect(screen.getByText("That email is already in use.")).toBeInTheDocument();
    });
  });

  it("OAuth preserves a valid next destination for learner users", async () => {
    mockAuth.completeOAuthLogin.mockResolvedValue({ id: "learner-user", role: "learner" });

    render(
      <MemoryRouter initialEntries={["/oauth/callback?next=%2Flearn%2FcashFlow%2F1.1"]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/learn/cashFlow/1.1" element={<div>Lesson page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockAuth.completeOAuthLogin).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Lesson page")).toBeInTheDocument();
    });
  });
});
