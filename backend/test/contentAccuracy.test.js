const fs = require("node:fs");
const path = require("node:path");

const contentDirectory = path.resolve(
  __dirname,
  "../../shared/content/examples/openquiz-introduction",
);

// Discover content files dynamically so new lesson modules are covered automatically.
const contentFiles = fs
  .readdirSync(contentDirectory)
  .filter((fileName) => fileName.endsWith(".json"));

const isValidReviewDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  // The round-trip rejects dates with valid formatting but invalid calendar values.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

describe("Lesson accuracy metadata", () => {
  test.each(contentFiles)("%s has accuracy review metadata for every lesson", (fileName) => {
    const filePath = path.join(contentDirectory, fileName);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

    for (const lesson of content.lessons || []) {
      expect(lesson.accuracy_reviewed_by).toEqual(expect.any(String));
      expect(lesson.accuracy_reviewed_by).not.toHaveLength(0);
      expect(isValidReviewDate(lesson.accuracy_reviewed_at)).toBe(true);
    }
  });
});
