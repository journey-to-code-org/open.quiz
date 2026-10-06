import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuthContext } from "../context/AuthContext";
import { ROUTES } from "../app/router/routes";
import { useAppName, useInstanceAssets, useLanding } from "../app/instanceAssets";
import { loadContentPackage } from "../contentPackages";
import { getPublicLessonModules } from "../services/api";
import Button from "../shared/Button/Button.component";
import Card from "../shared/Card/Card.component";

export default function HomePage() {
  const { isAuthenticated } = useAuthContext();
  const { hero: heroImageUrl, avatars } = useInstanceAssets();
  const landing = useLanding();
  const appName = useAppName();
  const heroAvatars = useMemo(() => selectHeroAvatars(avatars), [avatars]);
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

  const { hero, benefits, steps, faq } = landing;
  const showAvatars = !heroImageUrl && hero.showAvatars && heroAvatars.length > 0;

  return (
    <>
      <section
        className="flex flex-col items-center justify-between py-12 md:py-3 lg:flex-row"
        aria-label="Introduction"
      >
        <div className="flex max-w-2xl flex-col space-y-5">
          <h1 className="font-heading text-h1 font-bold tracking-tight text-heading">
            {hero.heading}
          </h1>
          <p className="max-w-2xl whitespace-pre-line text-body leading-normal text-foreground">
            {hero.body}
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
          {!showAvatars && lessonCharacters.length ? (
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
        ) : showAvatars ? (
          <div
            aria-label={`${appName} lesson guides`}
            className="mt-8 flex w-full max-w-md items-center justify-center gap-4 md:py-3 lg:max-w-xl"
            data-hero-avatars
          >
            {heroAvatars.map((avatar) => (
              <img
                key={avatar.key}
                src={avatar.url}
                alt={avatar.name}
                title={avatar.name}
                className="h-auto w-1/5 object-contain"
                loading="eager"
              />
            ))}
          </div>
        ) : null}
      </section>

      {benefits.items.length ? (
        <section id="benefits" className="py-12 md:py-20" aria-labelledby="benefits-title">
          <div className="mb-12 text-center">
            <h2
              id="benefits-title"
              className="font-heading text-h2 font-bold tracking-tight text-heading"
            >
              {benefits.heading}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {benefits.items.map((item) => (
              <Card
                key={`${item.title}|${item.body}`}
                className="flex flex-col items-center p-6 text-center"
              >
                {item.icon ? (
                  <div className="mb-4 text-3xl" aria-hidden="true">
                    {item.icon}
                  </div>
                ) : null}
                <h3 className="mb-2 text-xl font-semibold text-heading">{item.title}</h3>
                <p className="whitespace-pre-line leading-normal text-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {steps.items.length ? (
        <section
          id="how-it-works"
          className="border-t border-neutral-200 py-12 md:py-20"
          aria-labelledby="how-title"
        >
          <div className="mb-12 text-center">
            <h2
              id="how-title"
              className="font-heading text-h2 font-bold tracking-tight text-heading"
            >
              {steps.heading}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {steps.items.map((item, index) => (
              <Card
                key={`${item.title}|${item.body}`}
                className="relative flex flex-col items-center p-6 text-center"
              >
                <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  {index + 1}
                </span>
                <h3 className="mb-2 mt-2 text-xl font-semibold text-heading">{item.title}</h3>
                <p className="whitespace-pre-line leading-normal text-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {faq.items.length ? (
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
              {faq.heading}
            </h2>
            <div className="space-y-6">
              {faq.items.map((item, index) => (
                <Card key={`${item.question}|${item.answer}`} className="p-6">
                  <h3 className="mb-2 text-lg font-semibold text-heading">
                    {index + 1}. {item.question}
                  </h3>
                  <p className="whitespace-pre-line leading-normal text-foreground">
                    {item.answer}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function selectHeroAvatars(avatars) {
  const entries = Object.entries(avatars || {})
    .filter(([, avatar]) => avatar?.url)
    .sort(([a], [b]) => (a === "guide" ? -1 : b === "guide" ? 1 : 0));
  const seen = new Set();
  const selected = [];
  for (const [key, avatar] of entries) {
    if (seen.has(avatar.url)) continue;
    seen.add(avatar.url);
    selected.push({ key, name: avatar.name || key, url: avatar.url });
    if (selected.length === 3) break;
  }
  return selected;
}
