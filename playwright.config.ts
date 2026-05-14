import { defineConfig } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const useExistingServer = ["1", "true", "yes"].includes(
  (process.env.PLAYWRIGHT_USE_EXISTING_SERVER ?? "").toLowerCase()
);
const webServerPort = Number(process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "3000");
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "npm run dev";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
  },
  ...(useExistingServer
    ? {}
    : {
        webServer: {
          command: webServerCommand,
          port: webServerPort,
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            OPENCLAW_STATE_DIR: path.resolve("./tests/fixtures/openclaw-empty-state"),
            NEXT_PUBLIC_GATEWAY_URL: "",
          },
        },
      }),
});
