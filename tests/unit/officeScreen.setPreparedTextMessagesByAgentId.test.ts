import { describe, expect, it } from "vitest";
import {
  shouldKeepPreparedTextMessageMap,
  shouldSkipPreparedTextMessageUpdate,
} from "@/features/office/screens/officeScreenHelpers";

describe("officeScreenHelpers.shouldSkipPreparedTextMessageUpdate", () => {
  const makeScenario = (recipient: string, messageText: string) => ({
    recipient,
    messageText,
  });

  it("skips update when both request key and scenario are unchanged", () => {
    const current = {
      requestKey: "msg-1",
      scenario: makeScenario("alice", "hello"),
    };

    expect(
      shouldSkipPreparedTextMessageUpdate(current, "msg-1", makeScenario("alice", "hello")),
    ).toBe(true);
  });

  it("updates when request key changes", () => {
    const current = {
      requestKey: "msg-1",
      scenario: makeScenario("alice", "hello"),
    };

    expect(
      shouldSkipPreparedTextMessageUpdate(current, "msg-2", makeScenario("alice", "hello")),
    ).toBe(false);
  });

  it("updates when scenario changes", () => {
    const current = {
      requestKey: "msg-1",
      scenario: makeScenario("alice", "hello"),
    };

    expect(
      shouldSkipPreparedTextMessageUpdate(current, "msg-1", makeScenario("alice", "changed")),
    ).toBe(false);
  });

  it("updates when no previous state exists", () => {
    expect(
      shouldSkipPreparedTextMessageUpdate(undefined, "msg-1", makeScenario("alice", "hello")),
    ).toBe(false);
  });
});

describe("officeScreenHelpers.shouldKeepPreparedTextMessageMap", () => {
  it("returns true when map is unchanged by identity", () => {
    const state: Record<string, { requestKey: string; scenario: { x: string } }> = {
      "agent-1": { requestKey: "msg-1", scenario: { x: "a" } },
    };

    expect(shouldKeepPreparedTextMessageMap(state, state)).toBe(true);
  });

  it("returns false when map shape changed", () => {
    const previous: Record<string, { requestKey: string; scenario: { x: string } }> = {
      "agent-1": { requestKey: "msg-1", scenario: { x: "a" } },
    };
    const next: Record<string, { requestKey: string; scenario: { x: string } }> = {
      "agent-1": { requestKey: "msg-2", scenario: { x: "a" } },
    };

    expect(shouldKeepPreparedTextMessageMap(previous, next)).toBe(false);
  });
});

