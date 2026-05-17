import { describe, expect, it } from "vitest";
import { buildTextMessageFingerprint } from "@/features/office/screens/officeScreenHelpers";

describe("officeScreenHelpers.buildTextMessageFingerprint", () => {
  it("builds a deterministic fingerprint from agentId -> request.key pairs", () => {
    const textMessageByAgentId = {
      "agent-2": { key: "msg-b", phase: "ready_to_send" },
      "agent-1": { key: "msg-a", phase: "ready_to_send" },
    } as const;

    const fingerprint = buildTextMessageFingerprint(textMessageByAgentId);

    expect(fingerprint).toBe("agent-1:msg-a|agent-2:msg-b");
  });

  it("is stable for equivalent content with different object references", () => {
    const first = {
      "agent-1": { key: "msg-a", phase: "ready_to_send" },
      "agent-2": { key: "msg-b", phase: "needs_message" },
    } as const;
    const second = {
      "agent-1": { key: "msg-a", phase: "ready_to_send" },
      "agent-2": { key: "msg-b", phase: "needs_message" },
    } as const;

    expect(buildTextMessageFingerprint(first)).toBe(
      buildTextMessageFingerprint(second),
    );
  });

  it("changes when message keys change", () => {
    const original = {
      "agent-1": { key: "msg-a", phase: "ready_to_send" },
    } as const;
    const changed = {
      "agent-1": { key: "msg-b", phase: "ready_to_send" },
    } as const;

    expect(buildTextMessageFingerprint(original)).not.toBe(
      buildTextMessageFingerprint(changed),
    );
  });
});

