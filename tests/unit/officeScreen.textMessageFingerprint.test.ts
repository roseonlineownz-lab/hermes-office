import { describe, expect, it } from "vitest";
import { buildTextMessageFingerprint } from "@/features/office/screens/officeScreenHelpers";
import type { OfficeTextMessageRequest } from "@/lib/office/eventTriggers";

const makeRequest = (
  key: string,
  phase: OfficeTextMessageRequest["phase"] = "ready_to_send",
): OfficeTextMessageRequest => ({
  key,
  phase,
  recipient: "agent",
  message: "hello",
  requestedAt: 1,
});

describe("officeScreenHelpers.buildTextMessageFingerprint", () => {
  it("builds a deterministic fingerprint from agentId -> request.key pairs", () => {
    const textMessageByAgentId = {
      "agent-2": makeRequest("msg-b"),
      "agent-1": makeRequest("msg-a"),
    };

    const fingerprint = buildTextMessageFingerprint(textMessageByAgentId);

    expect(fingerprint).toBe("agent-1:msg-a|agent-2:msg-b");
  });

  it("is stable for equivalent content with different object references", () => {
    const first = {
      "agent-1": makeRequest("msg-a"),
      "agent-2": makeRequest("msg-b", "needs_message"),
    };
    const second = {
      "agent-1": makeRequest("msg-a"),
      "agent-2": makeRequest("msg-b", "needs_message"),
    };

    expect(buildTextMessageFingerprint(first)).toBe(
      buildTextMessageFingerprint(second),
    );
  });

  it("changes when message keys change", () => {
    const original = {
      "agent-1": makeRequest("msg-a"),
    };
    const changed = {
      "agent-1": makeRequest("msg-b"),
    };

    expect(buildTextMessageFingerprint(original)).not.toBe(
      buildTextMessageFingerprint(changed),
    );
  });
});
