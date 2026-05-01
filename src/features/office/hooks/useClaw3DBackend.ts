"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BACKEND_URL = "http://127.0.0.1:8095";

export type BackendAgent = {
  id: string;
  name: string;
  role: string;
  room: string;
  status: "online" | "idle" | "running" | "offline" | "error";
  model: string;
  icon: string;
  cluster?: string;
  rank?: string;
  tasksCompleted?: number;
  profitImpact?: number;
  statusColor?: string;
};

export type BackendCluster = {
  id: string;
  name: string;
  color: string;
  agents: BackendAgent[];
  onlineCount: number;
  totalTasks: number;
};

export type BackendSuggestion = {
  id: string;
  priority: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  actions: string[];
  agent: string;
  profitImpact: number;
};

export type BackendTask = {
  id: number;
  title: string;
  status: string;
  agent: string;
  cluster?: string;
  priority?: string;
};

export type BackendEvent = {
  ts: string;
  agent: string;
  type: string;
  message: string;
};

export type BackendOverview = {
  totalAgents: number;
  onlineAgents: number;
  activeTasks: number;
  completedToday: number;
  totalClusters: number;
  systemStatus: string;
  mode: "manual" | "autopilot";
  money: {
    revenueToday: number;
    leadsToday: number;
    outreachSent: number;
    responsesReceived: number;
    conversionRate: number;
    pipelineValue: number;
    errorsActive: number;
    slaUptime: number;
  };
  trends?: {
    revenueDelta: number;
    leadsDelta: number;
    uptime: number;
  };
};

export type BackendService = {
  name: string;
  url: string;
  status: "online" | "offline";
  code: number | null;
  critical: boolean;
};

export type BackendResources = {
  cpu: number;
  memory: number;
  memoryUsed: number;
  memoryTotal: number;
  storage: number;
  gpu: {
    utilization: number;
    memoryUtil: number;
    temperature: number;
    memoryUsed: number;
    memoryTotal: number;
    powerDraw: number;
    available: boolean;
  } | null;
};

export type BackendGlobalStatus = {
  revenue: number;
  leads: number;
  errors: number;
  slaUptime: number;
  topAction: string;
  mode: string;
  agentsOnline: number;
  agentsTotal: number;
  cpu: number;
  memory: number;
  gpuTemp: number | null;
};

export type BackendWSMessage = {
  type: "tick";
  time: string;
  mode: "manual" | "autopilot";
  resources: BackendResources;
  overview: BackendOverview;
  agents: BackendAgent[];
  clusters: BackendCluster[];
  tasks: BackendTask[];
  events: BackendEvent[];
  suggestions: BackendSuggestion[];
  money: BackendOverview["money"];
  globalStatus: BackendGlobalStatus;
};

export type Claw3DBackendState = {
  connected: boolean;
  overview: BackendOverview | null;
  agents: BackendAgent[];
  clusters: BackendCluster[];
  tasks: BackendTask[];
  events: BackendEvent[];
  services: BackendService[];
  resources: BackendResources | null;
  suggestions: BackendSuggestion[];
  globalStatus: BackendGlobalStatus | null;
  sendCommand: (command: string, agent?: string) => Promise<{ ok: boolean; action?: string }>;
};

export function useClaw3DBackend(): Claw3DBackendState {
  const [connected, setConnected] = useState(false);
  const [overview, setOverview] = useState<BackendOverview | null>(null);
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [clusters, setClusters] = useState<BackendCluster[]>([]);
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [services, setServices] = useState<BackendService[]>([]);
  const [resources, setResources] = useState<BackendResources | null>(null);
  const [suggestions, setSuggestions] = useState<BackendSuggestion[]>([]);
  const [globalStatus, setGlobalStatus] = useState<BackendGlobalStatus | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`ws://127.0.0.1:8095/ws`);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: BackendWSMessage = JSON.parse(event.data);
          if (data.overview) setOverview(data.overview);
          if (data.agents) setAgents(data.agents);
          if (data.clusters) setClusters(data.clusters);
          if (data.tasks) setTasks(data.tasks);
          if (data.events) setEvents(data.events);
          if (data.resources) setResources(data.resources);
          if (data.suggestions) setSuggestions(data.suggestions);
          if (data.globalStatus) setGlobalStatus(data.globalStatus);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connectWS, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connectWS, 5000);
    }
  }, []);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [overviewRes, agentsRes, clustersRes, tasksRes, eventsRes, servicesRes, resourcesRes, suggestionsRes, globalStatusRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/overview`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/agents`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/clusters`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/tasks`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/events`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/services`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/resources`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/suggestions`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/global-status`, { signal: AbortSignal.timeout(5000) }),
        ]);

        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (agentsRes.ok) { const d = await agentsRes.json(); setAgents(d.agents ?? []); }
        if (clustersRes.ok) { const d = await clustersRes.json(); setClusters(d.clusters ?? []); }
        if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks ?? []); }
        if (eventsRes.ok) { const d = await eventsRes.json(); setEvents(d.events ?? []); }
        if (servicesRes.ok) { const d = await servicesRes.json(); setServices(d.services ?? []); }
        if (resourcesRes.ok) setResources(await resourcesRes.json());
        if (suggestionsRes.ok) { const d = await suggestionsRes.json(); setSuggestions(d.suggestions ?? []); }
        if (globalStatusRes.ok) setGlobalStatus(await globalStatusRes.json());

        setConnected(true);
      } catch {
        // Backend not reachable yet, WS will retry
      }
    };

    fetchInitial();
    connectWS();

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWS]);

  const sendCommand = useCallback(async (command: string, agent = "nova-commander") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, agent }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      return { ok: data.ok ?? false, action: data.action };
    } catch {
      return { ok: false };
    }
  }, []);

  return { connected, overview, agents, clusters, tasks, events, services, resources, suggestions, globalStatus, sendCommand };
}