const STORAGE_KEY = "openquiz-consent-preference";

// Helper function to resolve the storage object. If storage is provided, use it. If not, check if window.localStorage is available. If neither is available, return null.
function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

// Retrieve the consent preference from storage. If it's not set, return null.
export function getConsentPreference(storage = null) {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return null;
  const value = resolvedStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

// Store the consent preference in storage. If storage is not available, do nothing.
export function setConsentPreference(value, storage = null) {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return null;
  resolvedStorage.setItem(STORAGE_KEY, value);
  return value;
}

// Determine if analytics should be tracked based on the consent preference. Only track if the preference is 'accepted'.
export function shouldTrackAnalytics(preference) {
  return preference === "accepted";
}

// Track an analytics event if the user has given consent.
export function trackAnalyticsEvent(eventName, payload = {}, options = {}) {
  const preference = getConsentPreference(options.storage);
  if (!shouldTrackAnalytics(preference)) return false;

  if (typeof options.logger === "function") {
    // If a logger function is provided, use it to log the event with the given name and payload.
    options.logger(eventName, payload);
    return true;
  }
  // Otherwise, just return true if tracking is allowed.
  return true;
}

export { STORAGE_KEY };
