import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

const MAXIMUM_UPDATE_DEPTH_PATTERN = /maximum update depth exceeded/i;

test("office does not trigger Maximum update depth exceeded", async ({ page }) => {
  const errors: string[] = [];

  await stubStudioRoute(page);

  page.on("console", (msg) => {
    if (msg.type() === "error" && MAXIMUM_UPDATE_DEPTH_PATTERN.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    if (MAXIMUM_UPDATE_DEPTH_PATTERN.test(error.message)) {
      errors.push(error.message);
    }
  });

  await page.goto("/office", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(6000);

  expect(errors).toHaveLength(0);
});
