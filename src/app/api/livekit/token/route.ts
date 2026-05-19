import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import type { LiveKitTokenRequest, LiveKitTokenResponse } from "@/lib/livekit/types";

// ── Configuration ────────────────────────────────────────────────────────────

/** Default LiveKit server URL — override with LIVEKIT_URL env var */
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://72.62.237.198:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET;

/** Token time-to-live in seconds (24 hours) */
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

// ── POST /api/livekit/token ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LiveKitTokenRequest;

    if (!body.roomName || !body.participantName) {
      return NextResponse.json(
        { error: "roomName and participantName are required" },
        { status: 400 },
      );
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { error: "LiveKit credentials are not configured server-side" },
        { status: 503 },
      );
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: body.participantName,
      name: body.participantName,
      ttl: TOKEN_TTL_SECONDS,
    });

    at.addGrant({
      room: body.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    const response: LiveKitTokenResponse = {
      token,
      url: LIVEKIT_URL,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[livekit/token] Failed to generate token:", error);
    return NextResponse.json(
      { error: "Failed to generate LiveKit token" },
      { status: 500 },
    );
  }
}
