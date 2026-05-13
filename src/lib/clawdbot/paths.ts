import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LEGACY_STATE_DIRNAMES = [".clawdbot", ".moltbot"] as const;
const NEW_STATE_DIRNAME = ".openclaw";
const CONFIG_FILENAME = "openclaw.json";
const LEGACY_CONFIG_FILENAMES = ["clawdbot.json", "moltbot.json"] as const;

const resolveDefaultHomeDir = (homedir: () => string = os.homedir): string => {
  const home = homedir();
  if (home) {
    try {
      if (fs.existsSync(home)) {
        return home;
      }
    } catch {
      // ignore
    }
  }
  return os.tmpdir();
};

export const resolveUserPath = (
  input: string,
  homedir: () => string = os.homedir
): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, homedir());
    return path.resolve(/* turbopackIgnore: true */ expanded);
  }
  return path.resolve(/* turbopackIgnore: true */ trimmed);
};

export const resolveStateDir = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string => {
  const override =
    env.OPENCLAW_STATE_DIR?.trim() ||
    env.MOLTBOT_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, homedir);
  const defaultHome = resolveDefaultHomeDir(homedir);
  const newDir = path.join(/* turbopackIgnore: true */ defaultHome, NEW_STATE_DIRNAME);
  const legacyDirs = LEGACY_STATE_DIRNAMES.map((dir) =>
    path.join(/* turbopackIgnore: true */ defaultHome, dir)
  );
  const hasNew = fs.existsSync(newDir);
  if (hasNew) return newDir;
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
  return existingLegacy ?? newDir;
};

export const resolveConfigPathCandidates = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string[] => {
  const explicit =
    env.OPENCLAW_CONFIG_PATH?.trim() ||
    env.MOLTBOT_CONFIG_PATH?.trim() ||
    env.CLAWDBOT_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit, homedir)];

  const defaultHome = resolveDefaultHomeDir(homedir);
  const candidates: string[] = [];
  const stateDir =
    env.OPENCLAW_STATE_DIR?.trim() ||
    env.MOLTBOT_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim();
  if (stateDir) {
    const resolved = resolveUserPath(stateDir, homedir);
    candidates.push(path.join(/* turbopackIgnore: true */ resolved, CONFIG_FILENAME));
    candidates.push(
      ...LEGACY_CONFIG_FILENAMES.map((name) => path.join(/* turbopackIgnore: true */ resolved, name))
    );
  }

  const defaultDirs = [
    path.join(/* turbopackIgnore: true */ defaultHome, NEW_STATE_DIRNAME),
    ...LEGACY_STATE_DIRNAMES.map((dir) => path.join(/* turbopackIgnore: true */ defaultHome, dir)),
  ];
  for (const dir of defaultDirs) {
    candidates.push(path.join(/* turbopackIgnore: true */ dir, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path.join(/* turbopackIgnore: true */ dir, name)));
  }
  return candidates;
};
