import { useEffect, useId, useState } from "react";
import { NavLink } from "react-router";
import Button from "../../../Button/Button.component";
import { ROUTES } from "../../../../app/router/routes";
import { resolveAssetUrl } from "../../../../services/api";

const primaryNavLinks = [
  { label: "Home", href: "/" },
  { label: "Leaderboard", href: ROUTES.LEADERBOARD },
];

export default function NavBar({
  signedIn = false,
  isAdmin = false,
  avatarLabel = "A",
  avatarUrl = null,
  xp = 0,
  streak = 0,
  onLogout,
  isSigningOut = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mobileMenuId = useId();
  const menuToggleLabel = isOpen ? "Close navigation menu" : "Open navigation menu";

  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const showAvatarImage = Boolean(signedIn && avatarUrl && failedAvatarUrl !== avatarUrl);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const authNavLinks = signedIn
    ? [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Learn", href: "/learn" },
        ...(isAdmin ? [{ label: "Admin", href: "/admin/dashboard" }] : []),
      ]
    : [];

  const combinedNavLinks = [...primaryNavLinks, ...authNavLinks];

  const mobileNavLinks = signedIn
    ? combinedNavLinks
    : [...combinedNavLinks, { label: "Login", href: "/login" }];

  return (
    <nav aria-label="Primary navigation" className="relative">
      <menu className="hidden items-center gap-1 md:flex">
        {combinedNavLinks.map((link) => (
          <li key={link.label}>
            {link.href.startsWith("http") ? (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-heading transition-colors hover:bg-surface-inset"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                to={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-heading transition-colors hover:bg-surface-inset"
              >
                {link.label}
              </NavLink>
            )}
          </li>
        ))}

        {!signedIn ? (
          <>
            <li>
              <Button as={NavLink} to="/login" variant="secondary">
                Login
              </Button>
            </li>
            <li>
              <Button as={NavLink} to="/register" variant="primary">
                Signup
              </Button>
            </li>
          </>
        ) : (
          <>
            <li>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-surface-raised px-3 py-2 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-surface-inset font-semibold text-heading">
                  <NavLink to="/profile">
                    {showAvatarImage ? (
                      <img
                        src={resolveAssetUrl(avatarUrl)}
                        alt={`${avatarLabel} avatar`}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedAvatarUrl(avatarUrl)}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      avatarLabel
                    )}
                  </NavLink>
                </span>
                <span className="text-sm font-semibold text-heading">{xp} XP</span>
                <span className="text-sm text-neutral-600">{streak} day streak</span>
              </div>
            </li>

            <li>
              <Button
                type="button"
                onClick={onLogout}
                disabled={isSigningOut}
                variant="ghost"
                className="px-3 py-2"
              >
                {isSigningOut ? "Signing out..." : "Logout"}
              </Button>
            </li>
          </>
        )}
      </menu>

      <Button
        type="button"
        aria-label={menuToggleLabel}
        aria-controls={mobileMenuId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        title={menuToggleLabel}
        variant="secondary"
        className="h-11 w-11 rounded-lg p-0 text-heading md:hidden"
      >
        <span aria-hidden="true" className="relative block h-5 w-5">
          <span
            className={`absolute left-0 top-0.5 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
              isOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${
              isOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute bottom-0.5 left-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
              isOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </Button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-40 h-screen w-screen cursor-default bg-foreground/10 backdrop-blur-[1px] md:hidden"
          />
          <div
            id={mobileMenuId}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-neutral-200 bg-surface-raised shadow-xl md:hidden"
          >
            {signedIn ? (
              <NavLink
                to="/profile"
                aria-label="Profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 border-b border-neutral-200 bg-surface-inset px-4 py-3 text-heading transition-colors hover:bg-surface-app"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-surface-raised font-semibold">
                  {showAvatarImage ? (
                    <img
                      src={resolveAssetUrl(avatarUrl)}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setFailedAvatarUrl(avatarUrl)}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    avatarLabel
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Profile</span>
                  <span className="mt-0.5 block text-xs text-neutral-600">
                    {xp} XP | {streak} day streak
                  </span>
                </span>
              </NavLink>
            ) : null}
            <ul className="space-y-1 p-2">
              {mobileNavLinks.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsOpen(false)}
                      className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-heading transition-colors hover:bg-surface-inset"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <NavLink
                      to={link.href}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                          isActive
                            ? "bg-surface-inset text-primary"
                            : "text-heading hover:bg-surface-inset"
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-neutral-200 p-3">
              {signedIn ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onLogout?.();
                  }}
                  disabled={isSigningOut}
                  variant="ghost"
                  className="w-full justify-start px-3 py-2"
                >
                  {isSigningOut ? "Signing out..." : "Logout"}
                </Button>
              ) : (
                <Button
                  as={NavLink}
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  variant="primary"
                  className="w-full"
                >
                  Create account
                </Button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}
