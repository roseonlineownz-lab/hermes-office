import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gateway/agentConfig", () => ({
  readGatewayAgentSkillsAllowlist: vi.fn(async () => undefined),
}));

vi.mock("@/lib/skills/agentAccess", () => ({
  setAgentSkillEnabled: vi.fn(async () => undefined),
}));

vi.mock("@/lib/skills/catalog", () => ({
  appendPackagedSkillsToMarketplace: vi.fn((skills: unknown[]) => skills),
  getPackagedSkillBySkillKey: vi.fn(() => null),
  listPackagedSkills: vi.fn(() => []),
}));

vi.mock("@/lib/skills/install-gateway", () => ({
  installPackagedSkillViaGatewayAgent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/skills/presentation", () => ({
  resolvePreferredInstallOption: vi.fn(() => null),
}));

vi.mock("@/lib/skills/remove", () => ({
  removeSkillFromGateway: vi.fn(async () => ({ removed: false })),
}));

vi.mock("@/lib/skills/types", () => ({
  installSkill: vi.fn(async () => ({ ok: true })),
  loadAgentSkillStatus: vi.fn(async () => ({
    workspaceDir: "/tmp/workspace-main",
    managedSkillsDir: "/tmp/skills",
    skills: [],
  })),
  updateSkill: vi.fn(async () => ({ ok: true })),
}));

import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { getPackagedSkillBySkillKey } from "@/lib/skills/catalog";
import { installPackagedSkillViaGatewayAgent } from "@/lib/skills/install-gateway";
import { useOfficeSkillsMarketplace } from "@/features/office/hooks/useOfficeSkillsMarketplace";

describe("useOfficeSkillsMarketplace safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles missing packaged skill keys without trim crashes", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const agents = [{ agentId: "main", name: "Main" }] as unknown as AgentState[];

    const { result } = renderHook(() =>
      useOfficeSkillsMarketplace({
        client,
        status: "connected",
        enabled: true,
        agents,
        preferredAgentId: "main",
      })
    );

    await act(async () => {
      await result.current.handleInstallPackagedSkill(undefined as unknown as string);
      await result.current.handleInstallPackagedSkillAndEnable({
        skillKey: undefined as unknown as string,
      });
    });

    await waitFor(() => {
      expect(result.current.message?.kind).toBe("error");
      expect(result.current.message?.text).toContain("that entry");
    });

    expect(getPackagedSkillBySkillKey).toHaveBeenCalledWith("");
    expect(installPackagedSkillViaGatewayAgent).not.toHaveBeenCalled();
  });
});
