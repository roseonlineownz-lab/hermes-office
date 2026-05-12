export type ComputerUseMode = "macos-cua" | "wsl-playwright" | "cloud-browser";

export type ComputerUseCapability = {
  id: string;
  label: string;
  status: "ready" | "fallback" | "blocked";
  detail: string;
};

export type ComputerUseRule = {
  id: string;
  label: string;
  detail: string;
};

export type ComputerUseRuntimeProfile = {
  mode: ComputerUseMode;
  label: string;
  status: "primary" | "available" | "mac-only";
  detail: string;
};

export const COMPUTER_USE_RUNTIME_PROFILES: ComputerUseRuntimeProfile[] = [
  {
    mode: "wsl-playwright",
    label: "WSL Playwright MCP",
    status: "primary",
    detail:
      "Best fit for NovaMaster now: isolated Chromium, localhost-safe routing, no macOS permissions, works inside WSL.",
  },
  {
    mode: "cloud-browser",
    label: "Cloud browser fallback",
    status: "available",
    detail:
      "Use Browserbase/Browser Use/Firecrawl only for public sites; private URLs stay local through auto-local routing.",
  },
  {
    mode: "macos-cua",
    label: "macOS cua-driver",
    status: "mac-only",
    detail:
      "Hermes native Computer Use can click/type/scroll/drag in background on macOS, but is not the WSL primary path.",
  },
];

export const COMPUTER_USE_CAPABILITIES: ComputerUseCapability[] = [
  {
    id: "capture-first",
    label: "Capture first",
    status: "ready",
    detail: "Start every UI task with a snapshot/accessibility tree before clicking.",
  },
  {
    id: "element-targets",
    label: "Element IDs over pixels",
    status: "ready",
    detail: "Prefer Playwright refs or SOM element IDs instead of brittle coordinates.",
  },
  {
    id: "verify-after-action",
    label: "Verify after actions",
    status: "ready",
    detail: "Re-snapshot or probe after click/type/key operations before declaring success.",
  },
  {
    id: "background-safe",
    label: "No focus stealing",
    status: "fallback",
    detail: "macOS cua-driver does true background input; WSL uses isolated browser sessions instead.",
  },
  {
    id: "app-scoped-context",
    label: "Scoped context",
    status: "ready",
    detail: "Limit captures to the target app/page to reduce noise and avoid leaking unrelated windows.",
  },
  {
    id: "destructive-approval",
    label: "Approval boundary",
    status: "ready",
    detail: "Keep destructive UI actions behind explicit command approval and post-action verification.",
  },
];

export const COMPUTER_USE_RULES: ComputerUseRule[] = [
  {
    id: "private-routing",
    label: "Private URLs stay local",
    detail: "Keep browser.auto_local_for_private_urls=true and browser.allow_private_urls=false.",
  },
  {
    id: "recording",
    label: "No default session recording",
    detail: "Keep browser.record_sessions=false unless a debugging session explicitly needs replay evidence.",
  },
  {
    id: "screenshots",
    label: "Minimize image payloads",
    detail: "Use accessibility snapshots first; screenshots only when visual state matters.",
  },
  {
    id: "driver-choice",
    label: "Use native drivers only on matching OS",
    detail: "Do not install macOS cua-driver on WSL; use Playwright MCP and browser toolsets here.",
  },
];
