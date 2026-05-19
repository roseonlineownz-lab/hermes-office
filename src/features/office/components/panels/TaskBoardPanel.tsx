"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import type { AgentState } from "@/features/agents/state/store";
import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";
import type { CronJobSummary } from "@/lib/cron/types";

type OrchestratorStatus = "triage" | "ready" | "running" | "blocked" | "review" | "done";

type OrchestratorSummary = {
  ok: boolean;
  total: number;
  active_count: number;
  artifacts: number;
  updated_at: string | null;
  statuses: Record<OrchestratorStatus, number>;
};

type OrchestratorTask = {
  id: string;
  title: string;
  status: OrchestratorStatus;
  priority?: number;
  assigned_agent_id?: string | null;
  parent_ids?: string[];
  children?: string[];
  comments?: unknown[];
  artifacts?: Array<{ path?: string; title?: string }>;
  updated_at?: string;
};

type OrchestratorResponse = {
  ok: boolean;
  summary: OrchestratorSummary;
  tasks: OrchestratorTask[];
};

type DuplicateReport = {
  ok: boolean;
  total_groups: number;
  total_duplicate_tasks: number;
};

type BrowserToolsStatus = {
  ok: boolean;
  browser?: {
    ok?: boolean;
    cdpUrl?: string;
    browser?: string | null;
    error?: string;
  };
  tools?: {
    computerUse?: boolean;
    crawl4ai?: boolean;
  };
};

const STATUS_ORDER: OrchestratorStatus[] = ["triage", "ready", "running", "blocked", "review", "done"];

const fetchOrchestrator = async (): Promise<OrchestratorResponse> => {
  const response = await fetch("/api/office/orchestrator", { cache: "no-store" });
  if (!response.ok) throw new Error(`Orchestrator probe failed: ${response.status}`);
  return (await response.json()) as OrchestratorResponse;
};

const fetchDuplicateReport = async (): Promise<DuplicateReport> => {
  const response = await fetch("/api/office/orchestrator?report=duplicates", { cache: "no-store" });
  if (!response.ok) throw new Error(`Duplicate report failed: ${response.status}`);
  return (await response.json()) as DuplicateReport;
};

const fetchBrowserTools = async (): Promise<BrowserToolsStatus> => {
  const response = await fetch("/api/office/browser-tools", { cache: "no-store" });
  if (!response.ok) throw new Error(`Browser tools probe failed: ${response.status}`);
  return (await response.json()) as BrowserToolsStatus;
};

export function TaskBoardPanel({
  agents,
  cardsByStatus,
  selectedCard,
  activeRuns,
  cronJobs,
  cronLoading,
  cronError,
  taskCaptureDebug,
  onCreateCard,
  onMoveCard,
  onSelectCard,
  onUpdateCard,
  onDeleteCard,
  onRefreshCronJobs,
}: {
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  taskCaptureDebug?: ComponentProps<typeof TaskBoardView>["taskCaptureDebug"];
  onCreateCard: () => void;
  onMoveCard: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCard: (cardId: string | null) => void;
  onUpdateCard: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onRefreshCronJobs: () => void;
}) {
  const [orchestrator, setOrchestrator] = useState<OrchestratorResponse | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<DuplicateReport | null>(null);
  const [browserTools, setBrowserTools] = useState<BrowserToolsStatus | null>(null);
  const [orchestratorError, setOrchestratorError] = useState<string | null>(null);
  const [orchestratorLoading, setOrchestratorLoading] = useState(false);

  const refreshOrchestrator = useCallback(async () => {
    setOrchestratorLoading(true);
    setOrchestratorError(null);
    try {
      const [nextOrchestrator, nextDuplicateReport, nextBrowserTools] = await Promise.all([
        fetchOrchestrator(),
        fetchDuplicateReport().catch(() => null),
        fetchBrowserTools().catch(() => null),
      ]);
      setOrchestrator(nextOrchestrator);
      setDuplicateReport(nextDuplicateReport);
      setBrowserTools(nextBrowserTools);
    } catch (error) {
      setOrchestratorError(error instanceof Error ? error.message : "Failed to load orchestrator.");
    } finally {
      setOrchestratorLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrchestrator();
    const intervalId = window.setInterval(() => {
      void refreshOrchestrator();
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, [refreshOrchestrator]);

  const activeOrchestratorTasks = useMemo(
    () => (orchestrator?.tasks ?? []).filter((task) => task.status !== "done").slice(0, 5),
    [orchestrator],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-400/10 bg-black/20 px-4 py-3 font-mono text-[11px] text-white/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="uppercase tracking-[0.18em] text-cyan-200/80">Nova Orchestrator</span>
            {orchestrator?.summary ? (
              <>
                <span>active {orchestrator.summary.active_count}</span>
                <span>total {orchestrator.summary.total}</span>
                <span>artifacts {orchestrator.summary.artifacts}</span>
              </>
            ) : (
              <span>{orchestratorLoading ? "loading" : "not loaded"}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refreshOrchestrator()}
            className="rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100 hover:border-cyan-400/50"
          >
            {orchestratorLoading ? "Syncing" : "Sync"}
          </button>
        </div>
        {orchestrator?.summary ? (
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-white/50">
            {STATUS_ORDER.map((status) => (
              <span key={status} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                {status.replaceAll("_", " ")}: {orchestrator.summary.statuses[status] ?? 0}
              </span>
            ))}
            {duplicateReport ? (
              <span className="rounded border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-violet-100/75">
                dupes {duplicateReport.total_duplicate_tasks}/{duplicateReport.total_groups}
              </span>
            ) : null}
            {browserTools ? (
              <span className={`rounded border px-2 py-1 ${browserTools.browser?.ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100/75" : "border-amber-400/20 bg-amber-500/10 text-amber-100/75"}`}>
                browser {browserTools.browser?.ok ? "cdp" : "offline"} · cu {browserTools.tools?.computerUse ? "yes" : "no"} · crawl {browserTools.tools?.crawl4ai ? "yes" : "no"}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeOrchestratorTasks.length > 0 ? (
          <div className="mt-2 grid gap-1 text-[10px] text-white/55">
            {activeOrchestratorTasks.map((task) => (
              <div key={task.id} className="truncate">
                <span className="text-cyan-200/70">{task.status}</span> · {task.title} · {task.assigned_agent_id ?? "unassigned"}
              </div>
            ))}
          </div>
        ) : null}
        {orchestratorError ? <div className="mt-2 text-rose-200">{orchestratorError}</div> : null}
      </div>
      <div className="min-h-0 flex-1">
        <TaskBoardView
          title="Kanban"
          subtitle="Manual tasks, inferred requests, and scheduled playbooks."
          agents={agents}
          cardsByStatus={cardsByStatus}
          selectedCard={selectedCard}
          activeRuns={activeRuns}
          cronJobs={cronJobs}
          cronLoading={cronLoading}
          cronError={cronError}
          taskCaptureDebug={taskCaptureDebug}
          onCreateCard={onCreateCard}
          onMoveCard={onMoveCard}
          onSelectCard={onSelectCard}
          onUpdateCard={onUpdateCard}
          onDeleteCard={onDeleteCard}
          onRefreshCronJobs={onRefreshCronJobs}
        />
      </div>
    </div>
  );
}
