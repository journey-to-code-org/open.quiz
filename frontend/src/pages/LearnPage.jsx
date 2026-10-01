import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router";
import { useAuthContext } from "../context/AuthContext";
import useLessonContent from "../hooks/useLessonContent";
import { ROUTES } from "../app/router/routes";
import { loadContentPackage } from "../contentPackages";
import { normalizeLearnData, selectRandomLesson } from "../features/learn/normalizeLesson";
import LearnFlow from "../features/learn/LearnFlow/LearnFlow.component";
import Card from "../shared/Card/Card.component";
import Skeleton from "../shared/Skeleton/Skeleton.component";

const configuredPackageId = import.meta.env.VITE_CONTENT_PACKAGE?.trim();

export default function LearnPage() {
  const { isAuthenticated, isHydrating, csrfToken, refreshProfile } = useAuthContext();
  const { moduleId, lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const setCurrentModuleResources = useOutletContext();
  const [contentPackage, setContentPackage] = useState(null);

  const selectedMicroLessonId = location.state?.microLessonId;
  const isSamplePreview = searchParams.get("sample") === "true";

  useEffect(() => {
    let isActive = true;
    if (!configuredPackageId) return undefined;

    void loadContentPackage(configuredPackageId)
      .then((loadedPackage) => {
        if (isActive) setContentPackage(loadedPackage);
      })
      .catch(() => {
        if (isActive) setContentPackage(null);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const {
    moduleData: fetchedModuleData,
    lessonData: fetchedLessonData,
    progress,
    isLoading,
    error,
  } = useLessonContent({
    moduleId,
    lessonId,
    enabled: isAuthenticated || isSamplePreview,
    isPublic: !isAuthenticated && isSamplePreview,
  });

  const learnData = useMemo(
    () =>
      normalizeLearnData({
        moduleData: fetchedModuleData,
        lessonData: fetchedLessonData,
      }),
    [fetchedLessonData, fetchedModuleData],
  );
  const sampleLearnData = useMemo(() => {
    if (!learnData || isAuthenticated) return learnData;

    const randomStep = selectRandomLesson(learnData.lessonSteps);
    return randomStep
      ? {
          ...learnData,
          lessonSteps: [randomStep],
          questions: learnData.questions.filter(
            (question) => question.lessonStepId === randomStep.id,
          ),
        }
      : learnData;
  }, [isAuthenticated, learnData]);

  useEffect(() => {
    if (typeof setCurrentModuleResources !== "function") {
      return undefined;
    }

    setCurrentModuleResources({
      glossary: Array.isArray(learnData?.module?.glossary) ? learnData.module.glossary : [],
      worksCited: Array.isArray(learnData?.module?.worksCited) ? learnData.module.worksCited : [],
    });

    return () => setCurrentModuleResources({ glossary: [], worksCited: [] });
  }, [learnData?.module, setCurrentModuleResources]);

  // Wait for storage hydration before deciding to redirect
  if (isHydrating) {
    return (
      <section className="mx-auto max-w-2xl px-2 py-12 sm:px-4 sm:py-16">
        <Skeleton />
      </section>
    );
  }

  if (!isAuthenticated && !isSamplePreview) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.LOGIN}?next=${next}`} replace />;
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-2 py-12 sm:px-4 sm:py-16">
        <Skeleton />
      </section>
    );
  }

  if (!learnData) {
    return (
      <section className="mx-auto max-w-2xl px-2 py-12 sm:px-4 sm:py-16">
        <Card className="space-y-5 p-7 sm:p-10">
          <h1 className="font-heading text-h3 font-bold text-heading">Lesson unavailable</h1>
          <p role="alert">{error || "This learning content could not be loaded."}</p>
          <Link to={ROUTES.LAST_LESSON} className="text-primary underline">
            Current Lesson
          </Link>
        </Card>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <p className="mx-auto mb-4 max-w-5xl rounded-xl border border-primary/20 bg-danger/5 px-4 py-3 text-sm font-medium text-primary sm:px-6">
          This is a sample of a lesson.
        </p>
        <LearnFlow
          key={`${learnData.moduleId}:${learnData.id}`}
          learnData={sampleLearnData}
          blockRenderers={contentPackage?.lessonBlockRenderers}
          characterImages={contentPackage?.characterImages}
          guideImage={contentPackage?.guideImage}
          isReadOnly
        />
      </>
    );
  }

  return (
    <LearnFlow
      key={`${learnData.moduleId}:${learnData.id}:${selectedMicroLessonId ?? "resume"}`}
      learnData={learnData}
      blockRenderers={contentPackage?.lessonBlockRenderers}
      characterImages={contentPackage?.characterImages}
      guideImage={contentPackage?.guideImage}
      savedProgress={progress}
      selectedMicroLessonId={selectedMicroLessonId}
      csrfToken={csrfToken}
      refreshProfile={refreshProfile}
    />
  );
}
