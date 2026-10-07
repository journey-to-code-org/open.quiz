import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useAppName } from "../../../app/instanceAssets";
import ColorModeToggle from "../../ColorModeToggle/ColorModeToggle.component";
import GlossaryModal from "../../../features/learn/GlossaryModal/GlossaryModal.component.jsx";
import glossaryIcon from "../../../assets/glossary_icon.svg";

const footerNavLinks = [
  { label: "Home", to: "/" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  {
    label: "GitHub",
    href: "https://github.com/journey-to-code-org/open.quiz",
  },
];

export default function Footer({ glossary = [], worksCited = [] }) {
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [copyrightYear] = useState(() => new Date().getFullYear());
  const location = useLocation();
  const appName = useAppName();

  const showGlossary = /^\/learn\/[^/]+\/[^/]+/.test(location.pathname);
  const glossaryList = Array.isArray(glossary) ? glossary : [];
  const worksCitedList = Array.isArray(worksCited) ? worksCited : [];

  return (
    <footer className="border-t border-neutral-200 bg-surface-app/90 px-4 py-8 text-sm text-neutral-600 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-center">
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          {footerNavLinks.map((link) =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 font-semibold text-heading transition-colors hover:bg-surface-inset hover:text-primary"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.label}
                to={link.to}
                className="rounded-lg px-3 py-2 font-semibold text-heading transition-colors hover:bg-surface-inset hover:text-primary"
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <p className="max-w-3xl rounded-2xl border border-neutral-200 bg-surface-raised px-4 py-3 text-sm leading-6 text-neutral-700 shadow-sm">
          Learning materials are provided for educational purposes.
        </p>

        {showGlossary && (
          <button
            type="button"
            onClick={() => setIsGlossaryOpen(true)}
            aria-label="Open glossary and references"
            title="Open glossary and references"
            className="fixed right-3 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-heading bg-surface-raised shadow-md transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:right-6"
          >
            <img src={glossaryIcon} alt="" aria-hidden="true" className="h-6 w-6" />
          </button>
        )}

        {showGlossary && (
          <GlossaryModal
            isOpen={isGlossaryOpen}
            onClose={() => setIsGlossaryOpen(false)}
            glossary={glossaryList}
            worksCited={worksCitedList}
          />
        )}

        <ColorModeToggle placement="footer" />

        <p className="text-xs text-neutral-400">
          &copy; {copyrightYear} {appName}
        </p>
      </div>
    </footer>
  );
}
