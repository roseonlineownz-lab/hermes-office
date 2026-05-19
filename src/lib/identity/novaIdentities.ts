export type NovaIdentityId =
  | "hermes"
  | "openclaw"
  | "office"
  | "jarvis"
  | "qa"
  | "scout"
  | "media"
  | "publisher"
  | "freebuff"
  | "ops";

export type NovaIdentity = {
  id: NovaIdentityId;
  label: string;
  aliases: string[];
  pet: string;
  voiceProfile: string;
  claw3dAvatar: string;
  color: string;
  livekitIdentity: string;
  priority: "low" | "normal" | "high";
  speakPolicy: "silent" | "complete-only" | "errors-and-complete" | "important" | "always";
};

export const NOVA_IDENTITIES: Record<NovaIdentityId, NovaIdentity> = {
  hermes: {
    id: "hermes",
    label: "Hermes",
    aliases: ["hermes", "hermes-gateway", "hermes-office", "office-adapter", "codex", "orchestrator", "planner"],
    pet: "hermes-trismegistus",
    voiceProfile: "hermes",
    claw3dAvatar: "orchestrator",
    color: "#b785ff",
    livekitIdentity: "agent:hermes",
    priority: "high",
    speakPolicy: "important",
  },
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    aliases: ["openclaw", "goclaw", "metaclaw", "clawmem", "claw"],
    pet: "openclaw",
    voiceProfile: "openclaw",
    claw3dAvatar: "runtime-claw",
    color: "#ff4d6d",
    livekitIdentity: "agent:openclaw",
    priority: "high",
    speakPolicy: "important",
  },
  office: {
    id: "office",
    label: "Claw3D Office",
    aliases: ["office", "claw3d", "studio", "cockpit"],
    pet: "cartman",
    voiceProfile: "office",
    claw3dAvatar: "office-host",
    color: "#38bdf8",
    livekitIdentity: "agent:office",
    priority: "normal",
    speakPolicy: "important",
  },
  jarvis: {
    id: "jarvis",
    label: "Jarvis",
    aliases: ["jarvis", "mark", "mark-xxx", "aion", "core", "command"],
    pet: "alien-x-pet",
    voiceProfile: "jarvis",
    claw3dAvatar: "core-console",
    color: "#60a5fa",
    livekitIdentity: "agent:jarvis",
    priority: "normal",
    speakPolicy: "important",
  },
  qa: {
    id: "qa",
    label: "QA",
    aliases: ["qa", "test", "tester", "testing", "smoke", "typecheck", "review", "coder", "code"],
    pet: "acidling",
    voiceProfile: "qa",
    claw3dAvatar: "qa-desk",
    color: "#facc15",
    livekitIdentity: "agent:qa",
    priority: "normal",
    speakPolicy: "errors-and-complete",
  },
  scout: {
    id: "scout",
    label: "Scout / LeadGen",
    aliases: ["leadgen", "lead", "sales", "outreach", "scout", "research"],
    pet: "wisp",
    voiceProfile: "leadgen",
    claw3dAvatar: "scout-desk",
    color: "#22c55e",
    livekitIdentity: "agent:scout",
    priority: "normal",
    speakPolicy: "important",
  },
  media: {
    id: "media",
    label: "Media / LiveKit",
    aliases: ["media", "publisher", "publish", "viral", "video", "voice", "livekit", "soundclaw"],
    pet: "null-wisp",
    voiceProfile: "media",
    claw3dAvatar: "media-studio",
    color: "#a855f7",
    livekitIdentity: "agent:media",
    priority: "normal",
    speakPolicy: "important",
  },
  publisher: {
    id: "publisher",
    label: "Publisher",
    aliases: ["publisher", "publish", "content", "post"],
    pet: "bitty",
    voiceProfile: "media",
    claw3dAvatar: "publisher-desk",
    color: "#fb923c",
    livekitIdentity: "agent:publisher",
    priority: "normal",
    speakPolicy: "complete-only",
  },
  freebuff: {
    id: "freebuff",
    label: "Freebuff / Gordon",
    aliases: ["freebuff", "gordon", "remote", "windows", "win32"],
    pet: "buff-patrick",
    voiceProfile: "freebuff",
    claw3dAvatar: "windows-remote",
    color: "#ef4444",
    livekitIdentity: "agent:freebuff",
    priority: "high",
    speakPolicy: "important",
  },
  ops: {
    id: "ops",
    label: "VPS / Ops Guard",
    aliases: ["vps", "ops", "security", "firewall", "server", "error", "incident"],
    pet: "seraphic-error-cube",
    voiceProfile: "ops",
    claw3dAvatar: "ops-guard",
    color: "#f43f5e",
    livekitIdentity: "agent:ops",
    priority: "high",
    speakPolicy: "errors-and-complete",
  },
};

export const resolveNovaIdentity = (input?: string | null): NovaIdentity => {
  const normalized = (input ?? "").trim().toLowerCase();
  if (!normalized) return NOVA_IDENTITIES.office;
  for (const identity of Object.values(NOVA_IDENTITIES)) {
    if (identity.id === normalized || identity.aliases.some((alias) => normalized.includes(alias))) {
      return identity;
    }
  }
  return NOVA_IDENTITIES.office;
};
