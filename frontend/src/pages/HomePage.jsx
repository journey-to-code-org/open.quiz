import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuthContext } from "../context/AuthContext";
import { ROUTES } from "../app/router/routes";
import { useInstanceAssets } from "../app/instanceAssets";
import { loadContentPackage } from "../contentPackages";
import { getPublicLessonModules } from "../services/api";
import Button from "../shared/Button/Button.component";
import Card from "../shared/Card/Card.component";

export default function HomePage() {
  const { isAuthenticated } = useAuthContext();
  const { hero: heroImageUrl } = useInstanceAssets();
  const [sampleLessonPath, setSampleLessonPath] = useState(null);
  const [lessonCharacters, setLessonCharacters] = useState([]);

  useEffect(() => {
    let isActive = true;

    if (isAuthenticated) return undefined;

    void getPublicLessonModules()
      .then(({ modules = [] }) => {
        const firstModule = modules.find((module) => module.firstLessonId);
        if (isActive && firstModule) {
          setSampleLessonPath(
            `/learn/${encodeURIComponent(firstModule.id)}/${encodeURIComponent(firstModule.firstLessonId)}?sample=true`,
          );
        }
      })
      .catch(() => {
        if (isActive) setSampleLessonPath(null);
      });

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let isActive = true;
    const packageId = import.meta.env.VITE_CONTENT_PACKAGE?.trim();
    if (!packageId) return undefined;

    void loadContentPackage(packageId)
      .then((contentPackage) => {
        if (isActive) {
          setLessonCharacters(Object.entries(contentPackage?.characterImages ?? {}));
        }
      })
      .catch(() => {
        if (isActive) setLessonCharacters([]);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <>
      <section
        className="flex flex-col items-center justify-between py-12 md:py-3 lg:flex-row"
        aria-label="Introduction"
      >
        <div className="flex max-w-2xl flex-col space-y-5">
          <h1 className="font-heading text-h1 font-bold tracking-tight text-heading">
            Build a learning habit, one short lesson at a time.
          </h1>
          <p className="max-w-2xl text-body leading-normal text-foreground">
            Short lessons and interactive quizzes help you make progress on topics that matter to
            you.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              as={Link}
              to={isAuthenticated ? ROUTES.LEARN : ROUTES.REGISTER}
              id="primary-cta"
              variant="primary"
              className="px-6 py-2.5"
            >
              {isAuthenticated ? "Start learning" : "Register to start learning"}
            </Button>
            {isAuthenticated ? (
              <Button as={Link} to={ROUTES.LAST_LESSON} variant="secondary" className="px-6 py-2.5">
                Jump Back in
              </Button>
            ) : sampleLessonPath ? (
              <Button as={Link} to={sampleLessonPath} variant="secondary" className="px-6 py-2.5">
                Explore lessons
              </Button>
            ) : (
              <Button variant="secondary" className="px-6 py-2.5" disabled>
                No lessons available
              </Button>
            )}
          </div>
          {lessonCharacters.length ? (
            <div aria-label="Lesson characters" className="mt-3 flex items-center gap-3">
              {lessonCharacters.map(([characterId, imageUrl]) => (
                <img
                  key={characterId}
                  src={imageUrl}
                  alt={characterId.charAt(0).toUpperCase() + characterId.slice(1)}
                  title={characterId.charAt(0).toUpperCase() + characterId.slice(1)}
                  className="h-14 w-14 rounded-full border-2 border-surface-raised object-cover shadow-sm"
                />
              ))}
              <span className="text-sm font-semibold text-heading">Meet your lesson guides</span>
            </div>
          ) : null}
        </div>
        {heroImageUrl ? (
          <div className="mt-8 flex w-full justify-center lg:mt-0 lg:w-2/5">
            <img
              src={heroImageUrl}
              alt=""
              className="aspect-[4/3] max-h-80 w-full max-w-md object-contain"
            />
          </div>
        ) : null}
      </section>

      <section id="benefits" className="py-12 md:py-20" aria-labelledby="benefits-title">
        <div className="mb-12 text-center">
          <h2
            id="benefits-title"
            className="font-heading text-h2 font-bold tracking-tight text-heading"
          >
            Why Choose Our App
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 text-3xl" aria-hidden="true">
              ⚡
            </div>
            <h3 className="mb-2 text-xl font-semibold text-heading">Clear lessons</h3>
            <p className="leading-normal text-foreground">
              Break complex topics into manageable ideas.
            </p>
          </Card>
          <Card className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 text-3xl" aria-hidden="true">
              📱
            </div>
            <h3 className="mb-2 text-xl font-semibold text-heading">Gamified Progress</h3>
            <p className="leading-normal text-foreground">
              Track streaks and earn badges as you progress.
            </p>
          </Card>
          <Card className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 text-3xl" aria-hidden="true">
              🔒
            </div>
            <h3 className="mb-2 text-xl font-semibold text-heading">100% Free</h3>
            <p className="leading-normal text-foreground">
              Learn at your own pace, with progress saved automatically.
            </p>
          </Card>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-neutral-200 py-12 md:py-20"
        aria-labelledby="how-title"
      >
        <div className="mb-12 text-center">
          <h2 id="how-title" className="font-heading text-h2 font-bold tracking-tight text-heading">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              step: 1,
              title: "Choose a topic",
              body: "Explore learning modules built around a subject you care about.",
            },
            {
              step: 2,
              title: "5-Min Daily Lesson",
              body: "Read interactive, simplified concepts designed to fit straight into a busy schedule.",
            },
            {
              step: 3,
              title: "Test Your Knowledge",
              body: "Complete quick summary checkpoints to solidify your learning and lock in streaks.",
            },
          ].map((s) => (
            <Card key={s.step} className="relative flex flex-col items-center p-6 text-center">
              <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                {s.step}
              </span>
              <h3 className="mb-2 mt-2 text-xl font-semibold text-heading">{s.title}</h3>
              <p className="leading-normal text-foreground">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="faq"
        className="border-t border-neutral-200 py-12 md:py-20"
        aria-labelledby="faq-title"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            id="faq-title"
            className="mb-12 text-center font-heading text-h2 font-bold tracking-tight text-heading"
          >
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card className="p-6">
              <h4 className="mb-2 text-lg font-semibold text-heading">1. Is it free?</h4>
              <p className="leading-normal text-foreground">
                Lessons, quizzes, and progress tracking are available in one place.
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="mb-2 text-lg font-semibold text-heading">2. How long does it take?</h4>
              <p className="leading-normal text-foreground">
                Most lessons take three to five minutes, and a full topic runs about a week at one
                lesson a day. You can go faster or slower — your progress saves automatically.
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="mb-2 text-lg font-semibold text-heading">3. Who is it for?</h4>
              <p className="leading-normal text-foreground">
                Anyone can use the learning modules configured for this instance. No prior
                experience is assumed.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
