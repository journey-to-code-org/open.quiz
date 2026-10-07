export const LANDING_LIMITS = Object.freeze({
  heading: 120,
  heroBody: 500,
  icon: 8,
  title: 80,
  body: 600,
  question: 200,
  answer: 1200,
  benefits: 6,
  steps: 6,
  faq: 10,
});

export const DEFAULT_LANDING = Object.freeze({
  hero: {
    heading: "Build a learning habit, one short lesson at a time.",
    body: "Short lessons and interactive quizzes help you make progress on topics that matter to you.",
    showAvatars: true,
  },
  benefits: {
    heading: "Why Choose Our App",
    items: [
      { icon: "⚡", title: "Clear lessons", body: "Break complex topics into manageable ideas." },
      {
        icon: "📱",
        title: "Gamified Progress",
        body: "Track streaks and earn badges as you progress.",
      },
      {
        icon: "🔒",
        title: "100% Free",
        body: "Learn at your own pace, with progress saved automatically.",
      },
    ],
  },
  steps: {
    heading: "How It Works",
    items: [
      {
        title: "Choose a topic",
        body: "Explore learning modules built around a subject you care about.",
      },
      {
        title: "5-Min Daily Lesson",
        body: "Read interactive, simplified concepts designed to fit straight into a busy schedule.",
      },
      {
        title: "Test Your Knowledge",
        body: "Complete quick summary checkpoints to solidify your learning and lock in streaks.",
      },
    ],
  },
  faq: {
    heading: "Frequently Asked Questions",
    items: [
      {
        question: "Is it free?",
        answer: "Lessons, quizzes, and progress tracking are available in one place.",
      },
      {
        question: "How long does it take?",
        answer:
          "Most lessons take three to five minutes, and a full topic runs about a week at one lesson a day. You can go faster or slower — your progress saves automatically.",
      },
      {
        question: "Who is it for?",
        answer:
          "Anyone can use the learning modules configured for this instance. No prior experience is assumed.",
      },
    ],
  },
});

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value, fallback) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

function resolveList(section, fallback, fields) {
  if (!isObject(section)) return fallback;
  const items = Array.isArray(section.items)
    ? section.items
        .filter(isObject)
        .map((item) => Object.fromEntries(fields.map((field) => [field, text(item[field], "")])))
        .filter((item) => fields.some((field) => field !== "icon" && item[field]))
    : fallback.items;
  return { heading: text(section.heading, fallback.heading), items };
}

export function resolveLanding(landing) {
  const source = isObject(landing) ? landing : {};
  const hero = isObject(source.hero) ? source.hero : {};
  return {
    hero: {
      heading: text(hero.heading, DEFAULT_LANDING.hero.heading),
      body: text(hero.body, DEFAULT_LANDING.hero.body),
      showAvatars: hero.showAvatars !== false,
    },
    benefits: resolveList(source.benefits, DEFAULT_LANDING.benefits, ["icon", "title", "body"]),
    steps: resolveList(source.steps, DEFAULT_LANDING.steps, ["title", "body"]),
    faq: resolveList(source.faq, DEFAULT_LANDING.faq, ["question", "answer"]),
  };
}

export function toPortableLanding(landing) {
  const resolved = resolveLanding(landing);
  const compact = (items) =>
    items.map((item) => Object.fromEntries(Object.entries(item).filter(([, value]) => value)));
  return {
    hero: resolved.hero,
    benefits: { heading: resolved.benefits.heading, items: compact(resolved.benefits.items) },
    steps: { heading: resolved.steps.heading, items: compact(resolved.steps.items) },
    faq: { heading: resolved.faq.heading, items: compact(resolved.faq.items) },
  };
}
