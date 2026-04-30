export const OFFICE_INTERACTION_TARGETS = [
  "desk",
  "server_room",
  "meeting_room",
  "gym",
  "jukebox",
  "qa_lab",
  "sms_booth",
  "phone_booth",
  "coffee_machine",
] as const;

export type OfficeInteractionTargetId =
  (typeof OFFICE_INTERACTION_TARGETS)[number];

export const OFFICE_SKILL_TRIGGER_MOVEMENT_TARGETS = [
  "desk",
  "github",
  "gym",
  "jukebox",
  "qa_lab",
  "coffee_machine",
] as const;

export type OfficeSkillTriggerMovementTarget =
  (typeof OFFICE_SKILL_TRIGGER_MOVEMENT_TARGETS)[number];

type OfficeSkillTriggerAnimationHoldKey =
  | "deskHoldByAgentId"
  | "githubHoldByAgentId"
  | "gymHoldByAgentId"
  | "jukeboxHoldByAgentId"
  | "qaHoldByAgentId"
  | "coffeeMachineHoldByAgentId";

export const OFFICE_SKILL_TRIGGER_PLACE_REGISTRY: Record<
  OfficeSkillTriggerMovementTarget,
  {
    label: string;
    interactionTarget: OfficeInteractionTargetId;
    animationHoldKey: OfficeSkillTriggerAnimationHoldKey;
    alsoSetsSkillGymHold?: boolean;
  }
> = {
  desk: {
    label: "Desk",
    interactionTarget: "desk",
    animationHoldKey: "deskHoldByAgentId",
  },
  github: {
    label: "GitHub / Server Room",
    interactionTarget: "server_room",
    animationHoldKey: "githubHoldByAgentId",
  },
  gym: {
    label: "Gym",
    interactionTarget: "gym",
    animationHoldKey: "gymHoldByAgentId",
    alsoSetsSkillGymHold: true,
  },
  jukebox: {
    label: "Jukebox",
    interactionTarget: "jukebox",
    animationHoldKey: "jukeboxHoldByAgentId",
  },
  qa_lab: {
    label: "QA Lab",
    interactionTarget: "qa_lab",
    animationHoldKey: "qaHoldByAgentId",
  },
  coffee_machine: {
    label: "Voice Station",
    interactionTarget: "coffee_machine",
    animationHoldKey: "coffeeMachineHoldByAgentId",
  },
};

export const isOfficeSkillTriggerMovementTarget = (
  value: unknown,
): value is OfficeSkillTriggerMovementTarget =>
  typeof value === "string" && value in OFFICE_SKILL_TRIGGER_PLACE_REGISTRY;

export type DefaultSkillTriggerFallback = {
  anyPhrases: string[];
  movementTarget: OfficeSkillTriggerMovementTarget;
  skipIfAlreadyThere?: boolean;
};

export const DEFAULT_SKILL_TRIGGER_FALLBACKS_BY_SKILL_KEY: Record<
  string,
  DefaultSkillTriggerFallback
> = {
  "todo-board": {
    anyPhrases: [
      "todo",
      "todo list",
      "blocked task",
      "blocked tasks",
      "add to my todo",
      "show my todo",
    ],
    movementTarget: "desk",
    skipIfAlreadyThere: true,
  },
  "task-manager": {
    anyPhrases: [
      "add a task",
      "create a task",
      "track this task",
      "task status",
      "mark this done",
      "block this task",
      "what tasks do we have",
    ],
    movementTarget: "desk",
    skipIfAlreadyThere: true,
  },
  soundclaw: {
    anyPhrases: [
      "spotify",
      "play a song",
      "play this song",
      "play music",
      "play a playlist",
      "find a song",
      "queue this song",
      "music link",
    ],
    movementTarget: "jukebox",
    skipIfAlreadyThere: true,
  },
  "voice-nova": {
    anyPhrases: [
      "speak",
      "say it",
      "read it out",
      "voice reply",
      "talk to me",
      "transcribe",
      "luister",
      "spreek",
      "zeg het",
      "lees voor",
    ],
    movementTarget: "coffee_machine",
    skipIfAlreadyThere: true,
  },
};

export const buildOfficeSkillTriggerHoldMaps = (
  movementTargetByAgentId: Record<string, OfficeSkillTriggerMovementTarget>,
): {
  deskHoldByAgentId: Record<string, boolean>;
  githubHoldByAgentId: Record<string, boolean>;
  gymHoldByAgentId: Record<string, boolean>;
  jukeboxHoldByAgentId: Record<string, boolean>;
  qaHoldByAgentId: Record<string, boolean>;
  skillGymHoldByAgentId: Record<string, boolean>;
} => {
  const next = {
    deskHoldByAgentId: {} as Record<string, boolean>,
    githubHoldByAgentId: {} as Record<string, boolean>,
    gymHoldByAgentId: {} as Record<string, boolean>,
    jukeboxHoldByAgentId: {} as Record<string, boolean>,
    qaHoldByAgentId: {} as Record<string, boolean>,
    coffeeMachineHoldByAgentId: {} as Record<string, boolean>,
    skillGymHoldByAgentId: {} as Record<string, boolean>,
  };

  for (const [agentId, target] of Object.entries(movementTargetByAgentId)) {
    const place = OFFICE_SKILL_TRIGGER_PLACE_REGISTRY[target];
    next[place.animationHoldKey][agentId] = true;
    if (place.alsoSetsSkillGymHold) {
      next.skillGymHoldByAgentId[agentId] = true;
    }
  }

  return next;
};
