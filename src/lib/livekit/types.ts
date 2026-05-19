import type { Room, LocalParticipant, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from "livekit-client";

// ── Configuration ────────────────────────────────────────────────────────────

export interface LiveKitConfig {
  /** WebSocket URL of the LiveKit server (ws://host:7880) */
  url: string;
  /** API key for token generation */
  apiKey: string;
  /** Secret for token generation */
  secret: string;
}

// ── Token API ────────────────────────────────────────────────────────────────

export interface LiveKitTokenRequest {
  /** Room name to join */
  roomName: string;
  /** Display name / identity of the participant */
  participantName: string;
}

export interface LiveKitTokenResponse {
  /** JWT access token for LiveKit room connection */
  token: string;
  /** WebSocket URL of the LiveKit server */
  url: string;
}

// ── Room State ───────────────────────────────────────────────────────────────

export type LiveKitConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface LiveKitRoomState {
  connectionState: LiveKitConnectionState;
  error: string | null;
  room: Room | null;
  localParticipant: LocalParticipant | null;
  remoteParticipants: Map<string, RemoteParticipant>;
}

// ── Audio Tracks ─────────────────────────────────────────────────────────────

/** Maps a remote participant identity to their subscribed audio track */
export interface RemoteAudioTrackInfo {
  participantIdentity: string;
  participantName: string;
  track: RemoteTrack;
  publication: RemoteTrackPublication;
  /** Agent ID this track maps to (for spatial positioning) */
  agentId: string | null;
}

// ── Spatial Audio ────────────────────────────────────────────────────────────

export interface SpatialAudioSource {
  /** Agent ID associated with this audio source */
  agentId: string;
  /** World X position for audio panning */
  x: number;
  /** World Y position (height) for audio panning */
  y: number;
  /** World Z position for audio panning */
  z: number;
}
