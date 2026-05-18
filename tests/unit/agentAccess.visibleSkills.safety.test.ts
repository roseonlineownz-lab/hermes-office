import { describe, expect, it } from "vitest";
import { resolveVisibleAgentSkillNames } from "@/lib/skills/agentAccess";
import type { SkillStatusEntry } from "@/lib/skills/types";

const emptyRequirements = {
  bins: [],
  anyBins: [],
  env: [],
  config: [],
  os: [],
};

const makeSkill = (name: unknown): SkillStatusEntry =>
  ({
    name: name as string,
    description: "",
    source: "openclaw-extra",
    bundled: false,
    filePath: "",
    baseDir: "",
    skillKey: String(name ?? "unknown"),
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: true,
    requirements: { ...emptyRequirements },
    missing: { ...emptyRequirements },
    configChecks: [],
    install: [],
  }) as SkillStatusEntry;

describe("resolveVisibleAgentSkillNames", () => {
  it("ignores malformed skill entries without crashing", () => {
    const result = resolveVisibleAgentSkillNames([
      makeSkill(" task-manager "),
      makeSkill(undefined),
      makeSkill(null),
      makeSkill(""),
      makeSkill("task-manager"),
      makeSkill(" soundclaw "),
    ]);

    expect(result).toEqual(["task-manager", "soundclaw"]);
  });
});
