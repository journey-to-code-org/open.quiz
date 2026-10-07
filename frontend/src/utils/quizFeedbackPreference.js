const STORAGE_KEY = "openquiz-quiz-feedback-preference";

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export const getQuizFeedbackPreference = (storage = null) => {
  const resolvedStorage = resolveStorage(storage);
  // "immediate" reveals correctness per question; "end" withholds it until the quiz is submitted.
  if (!resolvedStorage) return "immediate";
  const value = resolvedStorage.getItem(STORAGE_KEY);
  return value === "end" ? "end" : "immediate";
};

export const setQuizFeedbackPreference = (value, storage = null) => {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return value;
  resolvedStorage.setItem(STORAGE_KEY, value);
  return value;
};
