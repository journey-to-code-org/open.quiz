const fs = require("node:fs");
const path = require("node:path");
const { validateOpenQuizPackage } = require("../src/services/openQuizPackage");

const pngData = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64")}`;

function makePackage(overrides = {}) {
  return {
    schemaVersion: 1,
    package: { id: "sample", name: "Sample", version: "1.0.0" },
    theme: { tokens: { primary: "#123456" }, assets: {} },
    assets: [],
    ...overrides,
  };
}

describe("open.quiz package validation", () => {
  test("ships a valid Sprout theme with embedded logo, progress, and avatar assets", () => {
    const fixturePath = path.join(__dirname, "../../shared/packages/examples/sprout.openquiz.json");
    const packageData = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const result = validateOpenQuizPackage(packageData);

    expect(result.manifest).toMatchObject({
      includes: { theme: true, content: true },
      counts: { assets: 8, avatars: 3, modules: 1 },
    });
    expect(result.theme.assets.progressBar).toBe("progress.flower");
    expect(result.theme.assets.progressFrame).toBe("progress.frame");
    expect(result.theme.tokens.progressStart).toBe("#ffbf1f");
  });

  test("accepts a theme package without content and calculates a manifest", () => {
    const result = validateOpenQuizPackage(makePackage());

    expect(result.manifest).toEqual({
      includes: { theme: true, content: false },
      counts: { assets: 0, avatars: 0, modules: 0, lessons: 0, knowledgeChecks: 0 },
    });
  });

  test("validates progress color tokens and separate frame and marker slots", () => {
    const result = validateOpenQuizPackage(
      makePackage({
        theme: {
          tokens: { progressStart: "#ffbf1f", progressCompleteEnd: "#c989f7" },
          assets: { progressBar: "marker", progressFrame: "marker" },
        },
        assets: [{ key: "marker", filename: "marker.png", mimeType: "image/png", data: pngData }],
      }),
    );
    expect(result.theme.assets).toEqual({ progressBar: "marker", progressFrame: "marker" });
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          theme: { tokens: { progressStart: "url(evil)" } },
        }),
      ),
    ).toThrow(/hex color/);
  });

  test("accepts minimal package metadata and content-only packages", () => {
    const minimalTheme = validateOpenQuizPackage({ schemaVersion: 1, package: {}, theme: {} });
    const contentOnly = validateOpenQuizPackage({
      schemaVersion: 1,
      package: {},
      content: { modules: [] },
    });

    expect(minimalTheme.package).toMatchObject({
      id: expect.stringMatching(/^imported-/),
      name: "Imported open.quiz package",
      version: "1.0.0",
    });
    expect(contentOnly.manifest.includes).toEqual({ theme: false, content: true });
  });

  test("preserves canonical modules and counts lesson knowledge checks", () => {
    const module = {
      id: "basics",
      title: "Basics",
      lessons: [
        {
          id: "lesson-1",
          microLessons: [
            {
              id: "step-1",
              microLessonContent: [
                {
                  type: "knowledgeCheck",
                  id: "q1",
                  questionType: "multipleChoice",
                  question: "Ready?",
                  answerChoices: [
                    { key: "yes", text: "Yes" },
                    { key: "no", text: "No" },
                  ],
                  correctResponse: "yes",
                },
              ],
            },
          ],
        },
      ],
      glossary: [
        { term: "module field remains canonical", definition: "This remains a module field." },
      ],
    };
    const result = validateOpenQuizPackage(makePackage({ content: { modules: [module] } }));

    expect(result.content.modules[0]).toEqual(module);
    expect(result.manifest.counts).toMatchObject({ modules: 1, lessons: 1, knowledgeChecks: 1 });
  });

  test("rejects unsupported schemas, invalid image signatures, and private data", () => {
    expect(() => validateOpenQuizPackage(makePackage({ schemaVersion: 2 }))).toThrow(
      /Unsupported package schemaVersion/,
    );
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          assets: [
            {
              key: "logo",
              filename: "logo.png",
              mimeType: "image/png",
              data: "data:image/png;base64,YWJj",
            },
          ],
        }),
      ),
    ).toThrow(/does not match its declared image type/);
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          package: {
            id: "sample",
            name: "Sample",
            version: "1.0.0",
            email: "private@example.test",
          },
        }),
      ),
    ).toThrow(/private operational data/);
  });

  test("validates stable asset keys for theme avatars", () => {
    const result = validateOpenQuizPackage(
      makePackage({
        assets: [
          { key: "avatar.guide", filename: "guide.png", mimeType: "image/png", data: pngData },
        ],
        theme: {
          tokens: {},
          assets: { avatars: [{ key: "guide", name: "Guide", assetKey: "avatar.guide" }] },
        },
      }),
    );

    expect(result.manifest.counts).toMatchObject({ assets: 1, avatars: 1 });
    expect(result._assetBuffers["avatar.guide"]).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  test("rejects unbounded typography and installation-specific character URLs", () => {
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          theme: { tokens: { fontSizeH1: "97px" }, assets: {} },
        }),
      ),
    ).toThrow(/outside the supported font-size range/);
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          content: {
            modules: [
              {
                id: "course",
                title: "Course",
                characters: [{ characterId: "guide", imagePath: "/api/v1/assets/database-id" }],
                lessons: [],
              },
            ],
          },
        }),
      ),
    ).toThrow(/package-local assetKey/);
    expect(() =>
      validateOpenQuizPackage(
        makePackage({
          content: {
            modules: [{ id: "course", title: "Course", lessons: [], _id: "database-id" }],
          },
        }),
      ),
    ).toThrow(/database fields/);
  });
});
