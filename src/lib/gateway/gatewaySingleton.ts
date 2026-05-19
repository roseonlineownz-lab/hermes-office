export type GatewayClientStateRef = {
  client: unknown;
  refs: number;
  stopTimer: ReturnType<typeof setTimeout> | null;
  dispose: null | ((client: unknown) => void);
};

const globalKey = "__OPENCLAW_GATEWAY_CLIENT_SINGLETON__";

const globalStore =
  globalThis as typeof globalThis & { [globalKey]?: GatewayClientStateRef };

const state: GatewayClientStateRef =
  globalStore[globalKey] ??
  (globalStore[globalKey] = {
    client: null,
    refs: 0,
    stopTimer: null,
    dispose: null,
  });

export const acquireGatewayClient = <T>(
  createClient: () => T,
  options?: { dispose?: (client: T) => void },
): T => {
  if (state.stopTimer) {
    clearTimeout(state.stopTimer);
    state.stopTimer = null;
  }

  if (!state.client) {
    state.client = createClient();
    if (options?.dispose) {
      state.dispose = (client) => options.dispose?.(client as T);
    } else {
      state.dispose = null;
    }
  }

  state.refs += 1;
  return state.client as T;
};

export const releaseGatewayClient = (forceImmediate = false): void => {
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs > 0) {
    return;
  }

  const delayMs = forceImmediate || process.env.NODE_ENV !== "development" ? 0 : 1500;
  state.stopTimer = setTimeout(() => {
    if (state.refs > 0) {
      return;
    }

    const client = state.client;
    if (client && state.dispose) {
      state.dispose(client);
    }
    state.client = null;
    state.dispose = null;
    state.stopTimer = null;
  }, delayMs);
};

export const getGatewayClientDebugState = () => ({
  hasClient: Boolean(state.client),
  refs: state.refs,
  hasStopTimer: Boolean(state.stopTimer),
  nodeEnv: process.env.NODE_ENV ?? "unknown",
});
