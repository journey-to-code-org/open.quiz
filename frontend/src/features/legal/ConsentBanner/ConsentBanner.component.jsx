import { useState } from "react";
import { useAppName } from "../../../app/instanceAssets";
import Button from "../../../shared/Button/Button.component";
import { getConsentPreference, setConsentPreference } from "../../../utils/legalConsent";

export default function ConsentBanner() {
  const appName = useAppName();
  // Read the saved preference once so the banner stays hidden after a choice.
  const [consent, setConsent] = useState(() => getConsentPreference());

  const setPreference = (value) => {
    // Persist the choice and update local state so the banner disappears immediately.
    setConsentPreference(value);
    setConsent(value);
  };

  if (consent) return null;

  return (
    <section
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-surface-raised/80 px-4 py-4 shadow-lg backdrop-blur sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface-app p-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-heading">Help us improve {appName}</p>
          <p className="mt-1 text-sm text-neutral-600">
            We use optional analytics to understand how learners use the app. You can accept or
            decline this at any time.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPreference("accepted")}>Accept</Button>
          <Button variant="secondary" onClick={() => setPreference("declined")}>
            Decline
          </Button>
        </div>
      </div>
    </section>
  );
}
