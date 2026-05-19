import { describe, expect, it } from "vitest";

import { parseEventLine } from "@/app/api/office/nova-events/route";

describe("parseEventLine", () => {
  it("preserves agent and requestedPet fields for Claw3D per-agent event sync", () => {
    const event = parseEventLine(
      JSON.stringify({
        time: "2026-05-19T07:00:00Z",
        mode: "testing",
        message: "QA smoke",
        pet: true,
        eventbus: true,
        agent: "qa",
        requestedPet: "acidling",
      }),
    );

    expect(event).toEqual({
      mode: "testing",
      message: "QA smoke",
      time: "2026-05-19T07:00:00Z",
      pet: true,
      eventbus: true,
      agent: "qa",
      requestedPet: "acidling",
    });
  });
});
