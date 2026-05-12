import {
  COMPUTER_USE_CAPABILITIES,
  COMPUTER_USE_RULES,
  COMPUTER_USE_RUNTIME_PROFILES,
} from "@/lib/automation/computerUseStrategy";

const statusClasses = {
  available: "border-sky-400/25 bg-sky-500/10 text-sky-100",
  blocked: "border-rose-400/25 bg-rose-500/10 text-rose-100",
  fallback: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  "mac-only": "border-purple-400/25 bg-purple-500/10 text-purple-100",
  primary: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
  ready: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
} as const;

export function ComputerUseOpsPanel() {
  return (
    <div className="mt-3 rounded-lg border border-cyan-500/10 bg-black/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium text-white">Computer Use ops</div>
          <div className="mt-1 text-[10px] text-white/75">
            Injects Hermes Computer Use patterns into NovaMaster without forcing macOS-only drivers on WSL.
          </div>
        </div>
        <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-100">
          WSL tuned
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {COMPUTER_USE_RUNTIME_PROFILES.map((profile) => (
          <div
            key={profile.mode}
            className="rounded-lg border border-cyan-500/10 bg-black/15 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-100">
                {profile.label}
              </div>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusClasses[profile.status]}`}
              >
                {profile.status}
              </span>
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/60">
              {profile.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {COMPUTER_USE_CAPABILITIES.map((capability) => (
          <div
            key={capability.id}
            className="rounded-lg border border-cyan-500/10 bg-black/15 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-white">{capability.label}</span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] ${statusClasses[capability.status]}`}
              >
                {capability.status}
              </span>
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/55">
              {capability.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-cyan-500/10 bg-cyan-500/5 px-3 py-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-100/80">
          Active guardrails
        </div>
        <div className="mt-2 grid gap-1.5">
          {COMPUTER_USE_RULES.map((rule) => (
            <div key={rule.id} className="text-[10px] leading-relaxed text-white/60">
              <span className="text-cyan-100/80">{rule.label}:</span> {rule.detail}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
