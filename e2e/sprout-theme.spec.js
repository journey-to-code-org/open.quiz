import { expect, test } from "./fixtures/network.js";
import sproutPackage from "../shared/packages/examples/sprout.openquiz.json" with { type: "json" };

const assetData = Object.fromEntries(
  sproutPackage.assets.map((asset) => [asset.key, asset.data]),
);
const moduleData = structuredClone(sproutPackage.content.modules[0]);
for (const character of moduleData.characters) {
  character.imagePath = assetData[character.assetKey];
  delete character.assetKey;
}
const lessonData = {
  ...moduleData.lessons[0],
  microLessons: moduleData.lessons[0].microLessons.slice(0, 1),
};
const theme = {
  id: sproutPackage.package.id,
  name: sproutPackage.package.name,
  tokens: sproutPackage.theme.tokens,
  assets: {
    logo: assetData[sproutPackage.theme.assets.logo],
    progressBar: assetData[sproutPackage.theme.assets.progressBar],
    progressFrame: assetData[sproutPackage.theme.assets.progressFrame],
    avatars: Object.fromEntries(
      sproutPackage.theme.assets.avatars.map((avatar) => [
        avatar.key,
        { name: avatar.name, url: assetData[avatar.assetKey] },
      ]),
    ),
  },
};

for (const viewport of [
  { width: 1280, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`Sprout artwork renders as a track, moving flower, and guide at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    let activeTheme = theme;
    await page.setViewportSize(viewport);
    await page.route("**/api/v1/theme", (route) =>
      route.fulfill({ json: { theme: activeTheme } }),
    );
    await page.route(
      `**/api/v1/lessons/public/${moduleData.id}/${lessonData.id}`,
      (route) =>
        route.fulfill({ json: { moduleData, lessonData, progress: null } }),
    );
    await page.goto(`/learn/${moduleData.id}/${lessonData.id}?sample=true`);

    await expect(
      page.getByRole("heading", { name: lessonData.title, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(
      page.getByText(
        "Meet Abigail! Abigail is a single mom with twin 14-year-olds.",
      ),
    ).toBeVisible();
    const progress = page.getByRole("progressbar", {
      name: "Learning progress",
    });
    const frame = progress.locator("img").nth(0);
    const flower = progress.locator("img").nth(1);
    await expect(frame).toHaveAttribute("src", theme.assets.progressFrame);
    await expect(flower).toHaveAttribute("src", theme.assets.progressBar);
    await expect(
      page.getByRole("img", { name: "Abigail", exact: true }),
    ).toHaveAttribute("src", theme.assets.avatars.abigail.url);
    await expect
      .poll(() =>
        page
          .getByRole("img", { name: "Abigail", exact: true })
          .evaluate((image) => image.naturalWidth),
      )
      .toBe(400);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.images).every(
            (image) => image.complete && image.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);

    const frameBox = await frame.boundingBox();
    const flowerBox = await flower.boundingBox();
    expect(frameBox.width / frameBox.height).toBeGreaterThan(6);
    expect(frameBox.width / frameBox.height).toBeLessThan(6.2);
    expect(flowerBox.width).toBeLessThan(180);
    expect(flowerBox.height / flowerBox.width).toBeCloseTo(1, 1);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    if (viewport.width > 640) {
      const avatarBox = await page
        .getByRole("img", { name: "Abigail", exact: true })
        .boundingBox();
      expect(avatarBox.width).toBe(176);
    }

    const initialPosition = await flower
      .locator("..")
      .evaluate((element) => element.style.left);
    await page.screenshot({
      path: testInfo.outputPath("sprout-lesson.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect
      .poll(() =>
        flower.locator("..").evaluate((element) => element.style.left),
      )
      .not.toBe(initialPosition);

    activeTheme = null;
    await page.reload();
    await expect(progress.locator("img")).toHaveCount(1);
    const star = progress.locator('svg[viewBox="0 0 128 128"]');
    await expect(star).toBeVisible();
    const starBox = await star.boundingBox();
    expect(starBox.width).toBeCloseTo(flowerBox.width, 0);
    expect(
      Math.abs(starBox.height - flowerBox.height) / flowerBox.height,
    ).toBeLessThan(0.05);
    const starStart = await star
      .locator("..")
      .evaluate((element) => element.style.left);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect
      .poll(() => star.locator("..").evaluate((element) => element.style.left))
      .not.toBe(starStart);
    expect(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue(
          "--instance-progress-start",
        ),
      ),
    ).toBe("");
  });
}

test("a missing character image is removed from a production lesson without hiding its content", async ({
  page,
}) => {
  await page.route("**/api/v1/theme", (route) =>
    route.fulfill({
      json: {
        theme: {
          ...theme,
          assets: {
            ...theme.assets,
            avatars: {
              ...theme.assets.avatars,
              abigail: { name: "Abigail", url: "/missing-character.webp" },
            },
          },
        },
      },
    }),
  );
  await page.route("**/missing-character.webp", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route(
    `**/api/v1/lessons/public/${moduleData.id}/${lessonData.id}`,
    (route) =>
      route.fulfill({ json: { moduleData, lessonData, progress: null } }),
  );
  const failedImage = page.waitForResponse("**/missing-character.webp");
  await page.goto(`/learn/${moduleData.id}/${lessonData.id}?sample=true`);
  await failedImage;
  await expect(
    page.getByRole("img", { name: "Abigail", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Meet Abigail! Abigail is a single mom with twin 14-year-olds.",
    ),
  ).toBeVisible();
});
