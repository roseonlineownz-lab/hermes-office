import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

const MAXIMUM_UPDATE_DEPTH_PATTERN = /maximum update depth exceeded/i;

test("office text-message cleanup is stable and does not loop", async ({ page }) => {
  const errors: string[] = [];
  const textMessageLogs: string[] = [];

  await stubStudioRoute(page);

  page.on("console", (msg) => {
    const msgText = msg.text();
    if (msg.type() === "error" && MAXIMUM_UPDATE_DEPTH_PATTERN.test(msgText)) {
      errors.push(msgText);
    }
    if (msgText.includes("setPreparedTextMessagesByAgentId") || msgText.includes("textMessage")) {
      textMessageLogs.push(msgText);
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
  expect(textMessageLogs.length).toBeLessThan(120);
});

