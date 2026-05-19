import { NextResponse } from "next/server";

interface SpeakRequest {
  text: string;
  roomName: string;
  agentId: string;
  voice?: string;
  speed?: string;
}

const VOICE_AGENT_URL =
  process.env.LIVEKIT_VOICE_AGENT_URL || "http://127.0.0.1:8765";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SpeakRequest;

    if (!body.text || !body.roomName || !body.agentId) {
      return NextResponse.json(
        { error: "Missing required fields: text, roomName, agentId" },
        { status: 400 }
      );
    }

    const url = VOICE_AGENT_URL + "/speak";
    const agentResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.text,
        room_name: body.roomName,
        agent_id: body.agentId,
        voice: body.voice || "en-US-AriaNeural",
        speed: body.speed || "+0%",
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      return NextResponse.json(
        { error: "Voice agent error: " + errorText },
        { status: agentResponse.status }
      );
    }

    const data = await agentResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to process speak request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
