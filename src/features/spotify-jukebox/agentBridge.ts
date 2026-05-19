"use client";

import { useJukeboxStore } from "./store";
import { searchTracks } from "./spotifyApi";

type BrowserJukeboxCommand =
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "play"; query: string | null }
  | { kind: "generate"; prompt: string | null };

export type BrowserJukeboxExecutionResult =
  | { ok: false }
  | { ok: true; reply: string };

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const stripPlayPrefix = (normalizedMessage: string): string => {
  let value = normalizedMessage;
  value = value.replace(/\b(play|queue|put on|start|generate|create|make)\b/g, " ");
  value = value.replace(/\b(on spotify|from spotify|on suno|with suno|on the jukebox|with the jukebox)\b/g, " ");
  value = value.replace(/\b(the )?(jukebox|spotify|suno|ai music|music|song|songs|track|tracks|beat|beats)\b/g, " ");
  value = value.replace(/\s+/g, " ").trim();
  return value;
};

const isSunoGenerationRequest = (normalizedMessage: string): boolean =>
  /\b(suno|generate|create|make|compose)\b/.test(normalizedMessage) &&
  /\b(song|music|track|beat|jingle|soundtrack|suno)\b/.test(normalizedMessage);

export const parseBrowserJukeboxCommand = (
  message: string | null | undefined,
): BrowserJukeboxCommand | null => {
  const normalized = normalize(message ?? "");
  if (!normalized) return null;

  if (/\b(pause|stop music|stop playback|stop song)\b/.test(normalized)) {
    return { kind: "pause" };
  }
  if (/\b(resume|continue|unpause)\b/.test(normalized)) {
    return { kind: "resume" };
  }
  if (/\b(next|skip)\b/.test(normalized)) {
    return { kind: "next" };
  }
  if (/\b(previous|prev|back)\b/.test(normalized)) {
    return { kind: "previous" };
  }
  if (isSunoGenerationRequest(normalized)) {
    const prompt = stripPlayPrefix(normalized);
    return { kind: "generate", prompt: prompt.length > 0 ? prompt : null };
  }
  if (/\b(play|queue|put on|start)\b/.test(normalized)) {
    const query = stripPlayPrefix(normalized);
    return { kind: "play", query: query.length > 0 ? query : null };
  }

  return null;
};

export const executeBrowserJukeboxCommand = async (
  message: string | null | undefined,
): Promise<BrowserJukeboxExecutionResult> => {
  const command = parseBrowserJukeboxCommand(message);
  if (!command) return { ok: false };

  const store = useJukeboxStore.getState();
  store.init();

  switch (command.kind) {
    case "generate": {
      if (!command.prompt) {
        return { ok: false };
      }
      const response = await fetch("/api/office/jukebox/suno", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: command.prompt,
          tags: "office jukebox, electronic, cinematic, instrumental",
          makeInstrumental: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; payload?: { data?: Array<{ id?: string; audio_url?: string; title?: string }> }; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        return { ok: true, reply: payload?.error ?? "Suno jukebox route is not configured yet." };
      }
      const clips = Array.isArray(payload.payload?.data) ? payload.payload.data : [];
      const firstAudio = clips.find((clip) => clip.audio_url)?.audio_url;
      const ids = clips.map((clip) => clip.id).filter(Boolean).join(", ");
      return {
        ok: true,
        reply: firstAudio
          ? `Generated Suno jukebox track: ${firstAudio}`
          : `Queued Suno jukebox generation${ids ? ` (${ids})` : ""}.`,
      };
    }
    case "pause":
      if (!useJukeboxStore.getState().token) return { ok: false };
      await useJukeboxStore.getState().pause();
      return { ok: true, reply: "Paused the office jukebox." };
    case "resume":
      if (!useJukeboxStore.getState().token) return { ok: false };
      await useJukeboxStore.getState().resume();
      return { ok: true, reply: "Resumed the office jukebox." };
    case "next":
      if (!useJukeboxStore.getState().token) return { ok: false };
      await useJukeboxStore.getState().next();
      return { ok: true, reply: "Skipped to the next track on the office jukebox." };
    case "previous":
      if (!useJukeboxStore.getState().token) return { ok: false };
      await useJukeboxStore.getState().previous();
      return { ok: true, reply: "Went back to the previous track on the office jukebox." };
    case "play": {
      const { token } = useJukeboxStore.getState();
      if (!token) return { ok: false };
      if (!command.query) {
        await useJukeboxStore.getState().resume();
        return { ok: true, reply: "Started the office jukebox." };
      }
      const results = await searchTracks(token, command.query);
      useJukeboxStore.setState({
        searchQuery: command.query,
        searchResults: results,
      });
      if (results.length === 0) {
        return { ok: false };
      }
      await useJukeboxStore.getState().play(results[0].uri);
      const top = results[0];
      const artist = top.artists[0]?.name ?? "Unknown artist";
      return {
        ok: true,
        reply: `Playing ${artist} - "${top.name}" on the office jukebox.`,
      };
    }
  }
};
