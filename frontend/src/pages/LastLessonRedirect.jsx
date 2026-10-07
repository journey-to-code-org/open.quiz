import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { getLastLesson } from "../services/api";
import { ROUTES } from "../app/router/routes";
import Skeleton from "../shared/Skeleton/Skeleton.component";
const STORAGE_KEY = "lastLessonPath";

export default function LastLessonRedirect() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const data = await getLastLesson();
        const path = data?.lastLessonPath;
        if (!isMounted) return;
        if (path) localStorage.setItem(STORAGE_KEY, path);
        setTarget(path || ROUTES.LEARN);
      } catch {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (isMounted) setTarget(cached || ROUTES.LEARN);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);
  if (target) {
    return <Navigate to={target} replace />;
  }
  return (
    <section className="mx-auto max-w-2xl px-2 py-12 sm:px-4 sm:py-16">
      <Skeleton />
    </section>
  );
}
