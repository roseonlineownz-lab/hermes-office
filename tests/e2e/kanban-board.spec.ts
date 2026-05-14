import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

type SharedTaskPayload = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  source?: string;
  isInferred?: boolean;
  [key: string]: unknown;
};

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

test.skip(
  process.env.CLAW3D_E2E_GATEWAY !== "1",
  "Requires a reachable gateway-backed office shell."
);

const stubTaskStoreRoute = async (page: Parameters<typeof stubStudioRoute>[0]) => {
  const tasks = new Map<string, SharedTaskPayload>();

  await page.route("**/api/task-store", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tasks: Array.from(tasks.values()) }),
      });
      return;
    }

    if (request.method() === "PUT") {
      const body = JSON.parse(request.postData() ?? "{}") as {
        task?: SharedTaskPayload;
      };
      const now = new Date().toISOString();
      const incoming = body.task;
      if (!incoming?.id || !incoming.title?.trim()) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Task id and title are required." }),
        });
        return;
      }
      const existing = tasks.get(incoming.id);
      const task = {
        ...existing,
        ...incoming,
        id: incoming.id,
        title: incoming.title.trim(),
        createdAt: existing?.createdAt ?? incoming.createdAt ?? now,
        updatedAt: now,
        status: incoming.status ?? existing?.status ?? "todo",
        source: incoming.source ?? existing?.source ?? "claw3d_manual",
        isInferred: false,
      };
      tasks.set(task.id, task);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ task }),
      });
      return;
    }

    if (request.method() === "DELETE") {
      const body = JSON.parse(request.postData() ?? "{}") as { id?: string };
      if (body.id && tasks.has(body.id)) {
        const task = { ...tasks.get(body.id), isArchived: true };
        tasks.set(body.id, task as SharedTaskPayload);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ task }),
        });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Task not found." }),
      });
      return;
    }

    await route.fallback();
  });
};

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page, {
    version: 1,
    gateway: CONNECTED_GATEWAY,
    focused: {},
    avatars: {},
    taskBoard: {},
  });
  await stubTaskStoreRoute(page);
});

test("creates and edits a kanban card from HQ", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open headquarters sidebar" }).click();
  await page.getByRole("tab", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "New Task" }).click();

  const titleInput = page.getByLabel("Title");
  await expect(titleInput).toHaveValue("New task");
  await titleInput.fill("Create marketing website");
  await page.getByLabel("Description").fill("Landing page for the spring campaign.");
  await page
    .locator("label")
    .filter({ has: page.locator("span", { hasText: /^Status$/ }) })
    .locator("select")
    .selectOption("in_progress");

  await expect(
    page.getByRole("button", { name: /Create marketing website.*In Progress/ }).first()
  ).toBeVisible();
  await expect(titleInput).toHaveValue("Create marketing website");
});

test("persists kanban cards to the shared task store", async ({ page }) => {
  const title = `Persistent task card ${Date.now()}`;
  await page.goto("/");

  await page.getByRole("button", { name: "Open headquarters sidebar" }).click();
  await page.getByRole("tab", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "New Task" }).click();

  const taskStoreUpdate = page.waitForRequest((req) => {
    if (!req.url().includes("/api/task-store") || req.method() !== "PUT") {
      return false;
    }
    const payload = JSON.parse(req.postData() ?? "{}") as {
      task?: { title?: string };
    };
    return payload.task?.title === title;
  });
  await page.getByLabel("Title").fill(title);
  const request = await taskStoreUpdate;

  const payload = JSON.parse(request.postData() ?? "{}") as {
    task?: { title?: string };
  };
  expect(payload.task?.title).toBe(title);
  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
});
