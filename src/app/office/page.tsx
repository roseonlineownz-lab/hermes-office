import { Suspense } from "react";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { OfficeScreen } from "@/features/office/screens/OfficeScreen";

const ENABLED_RE = /^(1|true|yes|on)$/i;

const readDebugFlag = (value: string | undefined): boolean => {
  const normalized = (value ?? "").trim();
  if (!normalized) return true;
  return ENABLED_RE.test(normalized);
};

function OfficeLoadingFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-background"
      aria-label="Loading office"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <RunningAvatarLoader
          size={28}
          trackWidth={76}
          label="Loading..."
          labelClassName="text-muted-foreground"
        />
      </div>
    </div>
  );
}

const LOCAL_CLAW3D_BACKEND_URL =
  process.env.CLAW3D_BACKEND_URL?.trim() || "http://127.0.0.1:8095";

type LocalClaw3dRuntimeState = {
  ok?: boolean;
  runtime?: {
    name?: string | null;
    active_model?: string | null;
  } | null;
  agents?: Record<
    string,
    {
      name?: string | null;
      status?: string | null;
      room?: string | null;
      task?: string | null;
      model?: string | null;
    }
  > | null;
};

async function loadInitialLocalRuntimeState(): Promise<LocalClaw3dRuntimeState | null> {
  try {
    const [healthResponse, agentsResponse] = await Promise.all([
      fetch(`${LOCAL_CLAW3D_BACKEND_URL}/health`, {
        cache: "no-store",
      }),
      fetch(`${LOCAL_CLAW3D_BACKEND_URL}/agents`, {
        cache: "no-store",
      }),
    ]);
    if (!healthResponse.ok || !agentsResponse.ok) return null;
    const health = (await healthResponse.json()) as Record<string, unknown>;
    const agentsPayload = (await agentsResponse.json()) as {
      data?: Record<string, LocalClaw3dRuntimeState["agents"] extends Record<string, infer A> ? A : never>;
    };
    const agents = agentsPayload.data ?? null;
    if (!agents || Object.keys(agents).length === 0) return null;
    return {
      ok: true,
      runtime: {
        name: "NovaMaster Local Claw3D",
        active_model:
          typeof health.model === "string"
            ? health.model
            : typeof health.hermes_route === "object" && health.hermes_route !== null
              ? ((health.hermes_route as { primary?: { model?: string } }).primary?.model ?? null)
              : null,
      },
      agents,
    };
  } catch {
    return null;
  }
}

export default async function OfficePage() {
  const showOpenClawConsole = readDebugFlag(process.env.DEBUG);
  const initialLocalRuntimeState = await loadInitialLocalRuntimeState();

  return (
    <AgentStoreProvider>
      <Suspense fallback={<OfficeLoadingFallback />}>
        <OfficeScreen
          showOpenClawConsole={showOpenClawConsole}
          initialLocalRuntimeState={initialLocalRuntimeState}
        />
      </Suspense>
    </AgentStoreProvider>
  );
}
