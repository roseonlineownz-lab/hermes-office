import type { MockTextMessageScenario } from "@/lib/office/text/types";
import type { OfficeTextMessageRequest } from "@/lib/office/eventTriggers";

type TextMessageByAgentMap = Record<string, OfficeTextMessageRequest>;

type PreparedTextMessageState = {
  requestKey: string;
  scenario: MockTextMessageScenario;
};

export const buildTextMessageFingerprint = (
  textMessageByAgentId: TextMessageByAgentMap,
): string => {
  return Object.entries(textMessageByAgentId)
    .map(([agentId, request]) => `${agentId}:${request.key}`)
    .sort()
    .join("|");
};

export const shouldSkipPreparedTextMessageUpdate = (
  current: PreparedTextMessageState | undefined,
  requestKey: string,
  scenario: MockTextMessageScenario,
): boolean => {
  if (!current) return false;
  if (current.requestKey !== requestKey) return false;
  if (current.scenario === scenario) return true;
  return JSON.stringify(current.scenario) === JSON.stringify(scenario);
};

export const shouldKeepPreparedTextMessageMap = (
  previous: Record<string, PreparedTextMessageState>,
  next: Record<string, PreparedTextMessageState>,
): boolean => {
  return (
    Object.keys(previous).length === Object.keys(next).length &&
    Object.keys(previous).every((agentId) => previous[agentId] === next[agentId])
  );
};
