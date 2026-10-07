import { useCallback, useEffect, useMemo, useState } from "react";
import { getLesson, getPublicLesson } from "../services/api";

export default function useLessonContent({ moduleId, lessonId, enabled = true, isPublic = false }) {
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled && Boolean(moduleId && lessonId));
  const [error, setError] = useState("");
  const resolvedModuleId = moduleId ?? null;
  const resolvedLessonId = lessonId ?? null;
  const fetchLesson = useCallback(async () => {
    if (!enabled || !resolvedModuleId || !resolvedLessonId) {
      setPayload(null);
      setIsLoading(false);
      setError("");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const fetchLessonContent = isPublic ? getPublicLesson : getLesson;
      const lessonPayload = await fetchLessonContent(resolvedModuleId, resolvedLessonId);
      setPayload(lessonPayload);
    } catch (requestError) {
      setPayload(null);
      setError(requestError.message || "We could not load this lesson right now.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, isPublic, resolvedLessonId, resolvedModuleId]);

  useEffect(() => {
    // If the hook is enabled, fetch the lesson content and progress when the component mounts or when the resolved moduleId or lessonId changes.
    void Promise.resolve().then(fetchLesson);
  }, [fetchLesson]);
  return useMemo(
    () => ({
      moduleId: resolvedModuleId,
      lessonId: resolvedLessonId,
      moduleData: payload?.moduleData ?? null,
      lessonData: payload?.lessonData ?? null,
      progress: payload?.progress ?? null,
      isLoading,
      error,
      refresh: fetchLesson,
    }),
    [error, fetchLesson, isLoading, payload, resolvedLessonId, resolvedModuleId],
  );
}
