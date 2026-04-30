"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const BACKEND_URL = "http://127.0.0.1:8095";

export type BackendAgent = {
  id: string;
  name: string;
  role: string;
  room: string;
  status: "online" | "idle" | "running" | "offline";
  model: string;
  icon: string;
};

export type BackendTask = {
  id: number;
  title: string;
  time: string;
  status: string;
  agent: string;
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
  systemStatus: string;
  mode: "manual" | "autopilot";
  money: {
    revenueToday: number;
    leadsToday: number;
    outreachSent: number;
    responsesReceived: number;
    conversionRate: number;
    pipelineValue: number;
  };
};

export type BackendService = {
  name: string;
  url: string;
  status: "online" | "offline";
  code: number | null;
};

export type BackendResources = {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  gpu: number | null;
};

export type BackendWSMessage = {
  type: "tick";
  time: string;
  mode: "manual" | "autopilot";
  resources: BackendResources;
  overview: BackendOverview;
  agents: BackendAgent[];
  tasks: BackendTask[];
  events: BackendEvent[];
  money: BackendOverview["money"];
};

export type Claw3DBackendState = {
  connected: boolean;
  overview: BackendOverview | null;
  agents: BackendAgent[];
  tasks: BackendTask[];
  events: BackendEvent[];
  services: BackendService[];
  resources: BackendResources | null;
  sendCommand: (command: string, agent?: string) => Promise<{ ok: boolean; action?: string }>;
};

export function useClaw3DBackend(): Claw3DBackendState {
  const [connected, setConnected] = useState(false);
  const [overview, setOverview] = useState<BackendOverview | null>(null);
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [services, setServices] = useState<BackendService[]>([]);
  const [resources, setResources] = useState<BackendResources | null>(null);
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
          if (data.tasks) setTasks(data.tasks);
          if (data.events) setEvents(data.events);
          if (data.resources) setResources(data.resources);
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

  // Initial REST fetch + WebSocket
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [overviewRes, agentsRes, tasksRes, eventsRes, servicesRes, resourcesRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/overview`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/agents`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/tasks`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/events`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/services`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${BACKEND_URL}/api/resources`, { signal: AbortSignal.timeout(5000) }),
        ]);

        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (agentsRes.ok) { const d = await agentsRes.json(); setAgents(d.agents ?? []); }
        if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks ?? []); }
        if (eventsRes.ok) { const d = await eventsRes.json(); setEvents(d.events ?? []); }
        if (servicesRes.ok) { const d = await servicesRes.json(); setServices(d.services ?? []); }
        if (resourcesRes.ok) setResources(await resourcesRes.json());

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

  const sendCommand = useCallback(async (command: string, agent = "hermes") => {
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

  return { connected, overview, agents, tasks, events, services, resources, sendCommand };
}