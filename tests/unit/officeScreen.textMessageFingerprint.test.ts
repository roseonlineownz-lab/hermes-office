import { describe, expect, it } from "vitest";
import { buildTextMessageFingerprint } from "@/features/office/screens/officeScreenHelpers";
import type { OfficeTextMessageRequest } from "@/lib/office/eventTriggers";

const makeTextRequest = (key: string, phase: OfficeTextMessageRequest["phase"]): OfficeTextMessageRequest => ({
  key,
  phase,
  recipient: "alice",
  message: "hello",
  requestedAt: 1,
});

describe("officeScreenHelpers.buildTextMessageFingerprint", () => {
  it("builds a deterministic fingerprint from agentId -> request.key pairs", () => {
    const textMessageByAgentId = {
      "agent-2": makeTextRequest("msg-b", "ready_to_send"),
      "agent-1": makeTextRequest("msg-a", "ready_to_send"),
    };

    const fingerprint = buildTextMessageFingerprint(textMessageByAgentId);

    expect(fingerprint).toBe("agent-1:msg-a|agent-2:msg-b");
  });

  it("is stable for equivalent content with different object references", () => {
    const first = {
      "agent-1": makeTextRequest("msg-a", "ready_to_send"),
      "agent-2": makeTextRequest("msg-b", "needs_message"),
    };
    const second = {
      "agent-1": makeTextRequest("msg-a", "ready_to_send"),
      "agent-2": makeTextRequest("msg-b", "needs_message"),
    };

    expect(buildTextMessageFingerprint(first)).toBe(
      buildTextMessageFingerprint(second),
    );
  });

  it("changes when message keys change", () => {
    const original = {
      "agent-1": makeTextRequest("msg-a", "ready_to_send"),
    };
    const changed = {
      "agent-1": makeTextRequest("msg-b", "ready_to_send"),
    };

    expect(buildTextMessageFingerprint(original)).not.toBe(
      buildTextMessageFingerprint(changed),
    );
  });
});
