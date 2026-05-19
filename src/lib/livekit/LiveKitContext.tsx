"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Room,
  RoomEvent,
  type LocalParticipant,
  type RemoteParticipant,
} from "livekit-client";
import type {
  LiveKitConnectionState,
  LiveKitRoomState,
  RemoteAudioTrackInfo,
} from "@/lib/livekit/types";

// ── Context ──────────────────────────────────────────────────────────────────

interface LiveKitContextValue {
  /** Current LiveKit room state */
  roomState: LiveKitRoomState;
  /** Subscribed remote audio tracks, keyed by participant identity */
  remoteAudioTracks: Map<string, RemoteAudioTrackInfo>;
  /** Connect to a LiveKit room */
  connect: (roomName: string, participantName: string) => Promise<void>;
  /** Disconnect from the current room */
  disconnect: () => void;
}

const LiveKitContext = createContext<LiveKitContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

interface LiveKitProviderProps {
  children: React.ReactNode;
  /** LiveKit server URL (defaults to ws://72.62.237.198:7880) */
  serverUrl?: string;
}

export function LiveKitProvider({
  children,
  serverUrl = "ws://72.62.237.198:7880",
}: LiveKitProviderProps) {
  const [connectionState, setConnectionState] =
    useState<LiveKitConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [localParticipant, setLocalParticipant] =
    useState<LocalParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<
    Map<string, RemoteParticipant>
  >(new Map());
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<
    Map<string, RemoteAudioTrackInfo>
  >(new Map());

  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef(false);
  const listenerCleanupsRef = useRef<Array<() => void>>([]);

  // ── Connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(
    async (roomName: string, participantName: string) => {
      if (connectingRef.current || roomRef.current) return;
      connectingRef.current = true;
      setConnectionState("connecting");
      setError(null);

      try {
        // Fetch token from our API
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, participantName }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || "Failed to get token",
          );
        }

        const { token, url } = (await res.json()) as {
          token: string;
          url: string;
        };

        // Create and configure room
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Track remote participants
        newRoom.on(
          RoomEvent.ParticipantConnected,
          (participant: RemoteParticipant) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              next.set(participant.identity, participant);
              return next;
            });
          },
        );

        newRoom.on(
          RoomEvent.ParticipantDisconnected,
          (participant: RemoteParticipant) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              next.delete(participant.identity);
              return next;
            });
            setRemoteAudioTracks((prev) => {
              const next = new Map(prev);
              next.delete(participant.identity);
              return next;
            });
          },
        );

        // Track remote audio subscriptions
        newRoom.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (track.kind === "audio") {
              // Extract agentId from metadata set by the voice agent
              let agentId: string | null = null;
              try {
                const meta = JSON.parse(participant.metadata || "");
                if (meta.agentId) agentId = meta.agentId;
              } catch { /* metadata is not valid JSON */ }

              setRemoteAudioTracks((prev) => {
                const next = new Map(prev);
                next.set(participant.identity, {
                  participantIdentity: participant.identity,
                  participantName: participant.name || participant.identity,
                  track,
                  publication,
                  agentId,
                });
                return next;
              });
            }
          },
        );

        newRoom.on(RoomEvent.TrackUnsubscribed, (_, publication, participant) => {
          if (publication.kind === "audio") {
            setRemoteAudioTracks((prev) => {
              const next = new Map(prev);
              next.delete(participant.identity);
              return next;
            });
          }
        });

        // Handle disconnection
        newRoom.on(RoomEvent.Disconnected, () => {
          for (const cleanup of listenerCleanupsRef.current) {
            try { cleanup(); } catch { /* ignore */ }
          }
          listenerCleanupsRef.current = [];
          setConnectionState("disconnected");
          setRoom(null);
          setLocalParticipant(null);
          setRemoteParticipants(new Map());
          setRemoteAudioTracks(new Map());
          roomRef.current = null;
          connectingRef.current = false;
        });

        // Connect
        await newRoom.connect(url, token);
        roomRef.current = newRoom;
        setRoom(newRoom);
        setLocalParticipant(newRoom.localParticipant);
        setConnectionState("connected");
        connectingRef.current = false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setError(msg);
        setConnectionState("error");
        connectingRef.current = false;
      }
    },
    [],
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        // Remove all event listeners before disconnecting
        for (const cleanup of listenerCleanupsRef.current) {
          try { cleanup(); } catch { /* ignore */ }
        }
        listenerCleanupsRef.current = [];
        room.disconnect();
      }
    };
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo<LiveKitContextValue>(
    () => ({
      roomState: {
        connectionState,
        error,
        room,
        localParticipant,
        remoteParticipants,
      },
      remoteAudioTracks,
      connect,
      disconnect,
    }),
    [
      connectionState,
      error,
      room,
      localParticipant,
      remoteParticipants,
      remoteAudioTracks,
      connect,
      disconnect,
    ],
  );

  return (
    <LiveKitContext.Provider value={value}>{children}</LiveKitContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveKit() {
  const ctx = useContext(LiveKitContext);
  if (!ctx) {
    throw new Error("useLiveKit must be used within a <LiveKitProvider />");
  }
  return ctx;
}
