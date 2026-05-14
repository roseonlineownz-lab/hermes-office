import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

const CONNECTED_GATEWAY = {
  url: "ws://localhost:18789",
  token: "",
  adapterType: "hermes" as const,
  lastKnownGood: {
    url: "ws://localhost:18789",
    token: "",
    adapterType: "hermes" as const,
  },
};

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page, {
    version: 1,
    gateway: CONNECTED_GATEWAY,
    focused: {},
    avatars: {},
    taskBoard: {},
  });
});

test("office settings panel reflects current gateway state", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Voice reply settings").click();
  await expect(page.getByRole("button", { name: "Disconnect gateway" })).toBeVisible();
  await expect(page.getByText("Selected backend: hermes")).toBeVisible();
  await expect(page.getByText("Active backend: hermes")).toBeVisible();
});
