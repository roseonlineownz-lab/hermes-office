import { describe, expect, it } from "vitest";

import {
  buildLiveKitConnectionDetails,
  buildLiveKitPromptPayload,
  readLiveKitEnv,
} from "@/lib/office/livekit";

describe("office LiveKit helpers", () => {
  it("reads credentials from env text without exposing secret values", () => {
    const env = readLiveKitEnv({
      envText: "LIVEKIT_URL=wss://nova-livekit.example\nLIVEKIT_API_KEY=key123\nLIVEKIT_API_SECRET=secret456\n",
      processEnv: {},
    });

    expect(env.ok).toBe(true);
    expect(env.public.url).toBe("wss://nova-livekit.example");
    expect(env.public.api_key_present).toBe(true);
    expect(env.public.api_secret_present).toBe(true);
    expect(JSON.stringify(env.public)).not.toContain("secret456");
    expect(env.private.apiSecret).toBe("secret456");
  });

  it("builds a short-lived participant token with room metadata", async () => {
    const details = await buildLiveKitConnectionDetails({
      room: "voice_room",
      identity: "office-browser-test",
      name: "Office Browser Test",
      ttl: 300,
      env: {
        url: "wss://nova-livekit.example",
        apiKey: "key123",
        apiSecret: "secret456",
      },
    });

    expect(details.url).toBe("wss://nova-livekit.example");
    expect(details.room).toBe("voice_room");
    expect(details.identity).toBe("office-browser-test");
    expect(details.token.split(".")).toHaveLength(3);
    expect(JSON.stringify(details)).not.toContain("secret456");
  });

  it("normalizes prompt payloads for the existing voice worker", () => {
    expect(buildLiveKitPromptPayload(" zeg hallo ")).toEqual({
      type: "prompt",
      text: "zeg hallo",
    });
    expect(() => buildLiveKitPromptPayload("   ")).toThrow(/text/i);
  });
});
