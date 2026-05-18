"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { readGatewayAgentSkillsAllowlist } from "@/lib/gateway/agentConfig";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { setAgentSkillEnabled } from "@/lib/skills/agentAccess";
import {
  appendPackagedSkillsToMarketplace,
  getPackagedSkillBySkillKey,
  listPackagedSkills,
} from "@/lib/skills/catalog";
import { installPackagedSkillViaGatewayAgent } from "@/lib/skills/install-gateway";
import { resolvePreferredInstallOption } from "@/lib/skills/presentation";
import { removeSkillFromGateway } from "@/lib/skills/remove";
import {
  installSkill,
  loadAgentSkillStatus,
  updateSkill,
  type SkillStatusEntry,
  type SkillStatusReport,
} from "@/lib/skills/types";

type MarketplaceMessage = {
  kind: "success" | "error";
  text: string;
};

const trimOrEmpty = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const skillLabel = (value: unknown, fallback = "this skill"): string =>
  trimOrEmpty(value) || fallback;

export const useOfficeSkillsMarketplace = ({
  client,
  status,
  enabled = true,
  agents,
  preferredAgentId,
  onSkillActivityStart,
  onSkillActivityEnd,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  enabled?: boolean;
  agents: AgentState[];
  preferredAgentId?: string | null;
  onSkillActivityStart?: (agentId: string) => void;
  onSkillActivityEnd?: (agentId: string) => void;
}) => {
  const requestIdRef = useRef(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    preferredAgentId ?? null,
  );
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(
    null,
  );
  const [skillsAllowlist, setSkillsAllowlist] = useState<string[] | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null);
  const [message, setMessage] = useState<MarketplaceMessage | null>(null);
  const packagedSkillsByKey = useMemo(
    () => new Map(listPackagedSkills().map((skill) => [skill.skillKey, skill])),
    []
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const marketplaceSkills = useMemo(
    () => appendPackagedSkillsToMarketplace(skillsReport?.skills ?? []),
    [skillsReport]
  );

  useEffect(() => {
    const preferred = trimOrEmpty(preferredAgentId);
    const current = trimOrEmpty(selectedAgentId);
    const hasCurrent =
      current.length > 0 && agents.some((agent) => agent.agentId === current);
    if (hasCurrent) {
      return;
    }
    if (preferred && agents.some((agent) => agent.agentId === preferred)) {
      setSelectedAgentId(preferred);
      return;
    }
    setSelectedAgentId(agents[0]?.agentId ?? null);
  }, [agents, preferredAgentId, selectedAgentId]);

  const loadMarketplace = useCallback(
    async (agentId: unknown) => {
      const resolvedAgentId = trimOrEmpty(agentId);
      if (!enabled || !resolvedAgentId || status !== "connected") {
        setSkillsReport(null);
        setSkillsAllowlist(undefined);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(null);
      try {
        const [report, allowlist] = await Promise.all([
          loadAgentSkillStatus(client, resolvedAgentId),
          readGatewayAgentSkillsAllowlist({
            client,
            agentId: resolvedAgentId,
          }),
        ]);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSkillsReport(report);
        setSkillsAllowlist(allowlist);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const nextMessage =
          err instanceof Error
            ? err.message
            : "Failed to load skills marketplace data.";
        setSkillsReport(null);
        setSkillsAllowlist(undefined);
        setError(nextMessage);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(nextMessage);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [client, enabled, status],
  );

  useEffect(() => {
    if (!enabled || !selectedAgentId || status !== "connected") {
      requestIdRef.current += 1;
      setSkillsReport(null);
      setSkillsAllowlist(undefined);
      setLoading(false);
      return;
    }
    void loadMarketplace(selectedAgentId);
  }, [enabled, loadMarketplace, selectedAgentId, status]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!selectedAgentId) {
      return;
    }
    await loadMarketplace(selectedAgentId);
  }, [enabled, loadMarketplace, selectedAgentId]);

  const runSkillMutation = useCallback(
    async (params: {
      skillKey: unknown;
      successMessage: string;
      run: (agentId: string, report: SkillStatusReport) => Promise<void>;
    }) => {
      const agentId = trimOrEmpty(selectedAgentId);
      const report = skillsReport;
      const normalizedSkillKey = trimOrEmpty(params.skillKey);
      if (!enabled) {
        setMessage({
          kind: "error",
          text: "This runtime does not expose skill management.",
        });
        return;
      }
      if (!agentId || !report) {
        setMessage({
          kind: "error",
          text: "Select an agent before managing marketplace skills.",
        });
        return;
      }

      setBusySkillKey(normalizedSkillKey || null);
      setError(null);
      setMessage(null);
      onSkillActivityStart?.(agentId);
      try {
        await params.run(agentId, report);
        await loadMarketplace(agentId);
        setMessage({
          kind: "success",
          text: params.successMessage,
        });
      } catch (err) {
        const nextMessage =
          err instanceof Error
            ? err.message
            : "Failed to update the skill.";
        setError(nextMessage);
        setMessage({
          kind: "error",
          text: nextMessage,
        });
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(nextMessage);
        }
      } finally {
        onSkillActivityEnd?.(agentId);
        setBusySkillKey((current) =>
          current === normalizedSkillKey ? null : current,
        );
      }
    },
    [enabled, loadMarketplace, onSkillActivityEnd, onSkillActivityStart, selectedAgentId, skillsReport],
  );

  const handleSetSkillEnabled = useCallback(
    async (skillName: string, enabled: boolean) => {
      const normalizedSkillName = trimOrEmpty(skillName);
      const entry =
        skillsReport?.skills?.find(
          (skill) => skillLabel(skill.name) === normalizedSkillName,
        ) ?? null;
      await runSkillMutation({
        skillKey: entry?.skillKey ?? normalizedSkillName,
        successMessage: enabled
          ? `Enabled ${normalizedSkillName || "this skill"} for ${selectedAgent?.name ?? "the selected agent"}.`
          : `Removed ${normalizedSkillName || "this skill"} from ${selectedAgent?.name ?? "the selected agent"}.`,
        run: async (agentId, report) => {
          await setAgentSkillEnabled({
            client,
            agentId,
            skillName: normalizedSkillName,
            enabled,
            visibleSkills: report.skills,
          });
        },
      });
    },
    [client, runSkillMutation, selectedAgent?.name, skillsReport],
  );

  const handleInstallSkill = useCallback(
    async (skill: SkillStatusEntry) => {
      const installOption = resolvePreferredInstallOption(skill);
      if (!installOption) {
        setMessage({
          kind: "error",
          text: `No guided install is available for ${skillLabel(skill.name)}.`,
        });
        return;
      }
      await runSkillMutation({
        skillKey: skill.skillKey,
        successMessage: `Installed dependencies for ${skillLabel(skill.name)}.`,
        run: async () => {
          await installSkill(client, {
            name: skillLabel(skill.name),
            installId: installOption.id,
            timeoutMs: 120_000,
          });
        },
      });
    },
    [client, runSkillMutation],
  );

  const handleInstallPackagedSkill = useCallback(
    async (skillKey: unknown) => {
      const normalizedSkillKey = trimOrEmpty(skillKey);
      const packagedSkill = getPackagedSkillBySkillKey(normalizedSkillKey);
      if (!packagedSkill) {
        setMessage({
          kind: "error",
          text: `No packaged marketplace skill was found for ${skillLabel(normalizedSkillKey, "that entry")}.`,
        });
        return;
      }

      await runSkillMutation({
        skillKey: packagedSkill.skillKey,
        successMessage: `Successfully installed ${skillLabel(packagedSkill.name)} in the selected workspace. Enable it for the agent from the CLAW3D tab.`,
        run: async (_agentId, report) => {
          await installPackagedSkillViaGatewayAgent({
            client,
            request: {
              packageId: packagedSkill.packageId,
              source: packagedSkill.installSource,
              workspaceDir: report.workspaceDir,
              managedSkillsDir: report.managedSkillsDir,
              agentId: selectedAgent?.agentId ?? undefined,
              agentName: selectedAgent?.name ?? undefined,
            },
          });
        },
      });
    },
    [client, runSkillMutation, selectedAgent]
  );

  const handleInstallPackagedSkillAndEnable = useCallback(
    async (params: {
      skillKey: unknown;
      agentId?: string | null;
      onProgress?: (progress: { percent: number; message: string }) => void;
    }) => {
      const normalizedSkillKey = trimOrEmpty(params.skillKey);
      const packagedSkill = getPackagedSkillBySkillKey(normalizedSkillKey);
      if (!packagedSkill) {
        setMessage({
          kind: "error",
          text: `No packaged marketplace skill was found for ${skillLabel(normalizedSkillKey, "that entry")}.`,
        });
        return;
      }

      const targetAgentId =
        trimOrEmpty(params.agentId) || trimOrEmpty(selectedAgentId) || "";
      if (!targetAgentId) {
        setMessage({
          kind: "error",
          text: "Select an agent before installing marketplace skills.",
        });
        return;
      }

      setSelectedAgentId(targetAgentId);
      setBusySkillKey(packagedSkill.skillKey);
      setError(null);
      setMessage(null);
      onSkillActivityStart?.(targetAgentId);
      try {
        params.onProgress?.({
          percent: 12,
          message: "Preparing the workspace skill install.",
        });
        const initialReport = await loadAgentSkillStatus(client, targetAgentId);
        let installedIntoWorkspace = false;
        params.onProgress?.({
          percent: 38,
          message: "Installing task-manager into the workspace.",
        });
        try {
          await installPackagedSkillViaGatewayAgent({
            client,
            request: {
              packageId: packagedSkill.packageId,
              source: packagedSkill.installSource,
              workspaceDir: initialReport.workspaceDir,
              managedSkillsDir: initialReport.managedSkillsDir,
              agentId: targetAgentId,
              agentName:
                agents.find((agent) => agent.agentId === targetAgentId)?.name ?? undefined,
            },
          });
          installedIntoWorkspace = true;
        } catch (installError) {
          const installMessage =
            installError instanceof Error ? installError.message : String(installError);
          if (!installMessage.includes("workspaceDir is required")) {
            throw installError;
          }
          // Some gateways don't return workspace paths on skills.status.
          // In that case, continue with enable-only recovery instead of hard-failing.
          console.warn(
            "[skills] workspace path unavailable; proceeding with enable-only recovery"
          );
          params.onProgress?.({
            percent: 46,
            message: "Workspace path unavailable; applying enable-only recovery.",
          });
        }
        params.onProgress?.({
          percent: 62,
          message: "Enabling task-manager for this gateway.",
        });
        await updateSkill(client, { skillKey: packagedSkill.skillKey, enabled: true });
        params.onProgress?.({
          percent: 78,
          message: "Enabling task-manager for the main agent.",
        });
        const refreshedReport = await loadAgentSkillStatus(client, targetAgentId);
        await setAgentSkillEnabled({
          client,
          agentId: targetAgentId,
          skillName: packagedSkill.name,
          enabled: true,
          visibleSkills: refreshedReport.skills,
        });
        params.onProgress?.({
          percent: 92,
          message: "Refreshing skill state in Claw3D.",
        });
        await loadMarketplace(targetAgentId);
        params.onProgress?.({
          percent: 100,
          message: installedIntoWorkspace
            ? "Task-manager installed and enabled."
            : "Task-manager enabled (workspace fallback mode).",
        });
        const agentName =
          agents.find((agent) => agent.agentId === targetAgentId)?.name ?? "the main agent";
        setMessage({
          kind: "success",
          text: `Installed and enabled ${skillLabel(packagedSkill.name)} for ${agentName}.`,
        });
      } catch (err) {
        const nextMessage =
          err instanceof Error
            ? err.message
            : "Failed to install and enable the skill.";
        setError(nextMessage);
        setMessage({
          kind: "error",
          text: nextMessage,
        });
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(nextMessage);
        }
        throw err instanceof Error ? err : new Error(nextMessage);
      } finally {
        onSkillActivityEnd?.(targetAgentId);
        setBusySkillKey((current) =>
          current === packagedSkill.skillKey ? null : current,
        );
      }
    },
    [
      agents,
      client,
      loadMarketplace,
      onSkillActivityEnd,
      onSkillActivityStart,
      selectedAgentId,
    ],
  );

  const handleSetSkillGlobalEnabled = useCallback(
    async (skillKey: string, enabled: boolean) => {
      await runSkillMutation({
        skillKey,
        successMessage: enabled
          ? "Skill enabled for this gateway."
          : "Skill disabled for this gateway.",
        run: async () => {
          await updateSkill(client, { skillKey, enabled });
        },
      });
    },
    [client, runSkillMutation],
  );

  const handleRemoveSkill = useCallback(
    async (skill: SkillStatusEntry) => {
      await runSkillMutation({
        skillKey: skill.skillKey,
        successMessage: `${skillLabel(skill.name)} removed from gateway files.`,
        run: async (_agentId, report) => {
          await removeSkillFromGateway({
            client,
            skillKey: skill.skillKey,
            source: skill.source as
              | "openclaw-managed"
              | "openclaw-workspace",
            baseDir: skill.baseDir,
            workspaceDir: report.workspaceDir,
            managedSkillsDir: report.managedSkillsDir,
          });
        },
      });
    },
    [client, runSkillMutation],
  );

  return {
    agents,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    skillsReport,
    marketplaceSkills,
    packagedSkillsByKey,
    skillsAllowlist,
    loading,
    error,
    busySkillKey,
    message,
    refresh,
    handleSetSkillEnabled,
    handleInstallSkill,
    handleInstallPackagedSkill,
    handleInstallPackagedSkillAndEnable,
    handleSetSkillGlobalEnabled,
    handleRemoveSkill,
  };
};

export type OfficeSkillsMarketplaceController = ReturnType<
  typeof useOfficeSkillsMarketplace
>;
