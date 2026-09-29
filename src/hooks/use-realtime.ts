// ─── AISMH Real-Time React Hooks ────────────────────────────────────────────────
// useRealtime(event, handler) — subscribe to a real-time event with auto-cleanup
// useRealtimeConnection() — get connection status of the WebSocket client
// ──────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";
import { getRealtimeClientInstance } from "@/lib/realtime/client";
import type {
  RealtimeEventType,
  RealtimeSystemEventType,
  RealtimeEventDataMap,
} from "@/lib/realtime/events";

type AllEventTypes = RealtimeEventType | RealtimeSystemEventType;

// ─── Module-level subscription for useSyncExternalStore ────────────────────────────

let connectionListeners = new Set<() => void>();
let clientSubscribeCount = 0;

function subscribeToConnection(listener: () => void): () => void {
  connectionListeners.add(listener);
  clientSubscribeCount++;

  if (clientSubscribeCount === 1) {
    const client = getRealtimeClientInstance();
    if (client) {
      client.onConnect(() => {
        for (const l of connectionListeners) l();
      });
      client.onDisconnect(() => {
        for (const l of connectionListeners) l();
      });
    }
  }

  return () => {
    connectionListeners.delete(listener);
    clientSubscribeCount--;
  };
}

function getConnectionSnapshot(): { isConnected: boolean; isConnecting: boolean; socketId: string | null } {
  const client = getRealtimeClientInstance();
  return {
    isConnected: client?.isConnected ?? false,
    isConnecting: client?.isConnecting ?? false,
    socketId: client?.socketId ?? null,
  };
}

function getServerSnapshot(): { isConnected: boolean; isConnecting: boolean; socketId: string | null } {
  return { isConnected: false, isConnecting: false, socketId: null };
}

// ─── useRealtime ──────────────────────────────────────────────────────────────────
/**
 * Subscribe to a real-time event.
 *
 * @param event - The event name to listen for
 * @param handler - Callback invoked when the event fires
 * @param deps - Optional dependency array; re-subscribes when deps change
 *
 * @example
 * ```tsx
 * useRealtime('message:new', (data) => {
 *   toast({ title: 'New message', description: data.content });
 * });
 * ```
 */
export function useRealtime<K extends AllEventTypes>(
  event: K,
  handler: (data: RealtimeEventDataMap[K]) => void,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    const client = getRealtimeClientInstance();
    if (!client) return;

    const unsubscribe = client.on(event, handler);

    return () => {
      unsubscribe();
    };
  }, [event, ...deps]);
}

// ─── useRealtimeConnection ────────────────────────────────────────────────────────
/**
 * Get the connection status of the real-time WebSocket client.
 *
 * @returns Object with connection state and controls
 *
 * @example
 * ```tsx
 * const { isConnected, isConnecting, socketId, reconnect } = useRealtimeConnection();
 * ```
 */
export function useRealtimeConnection(): {
  isConnected: boolean;
  isConnecting: boolean;
  socketId: string | null;
  reconnect: () => void;
} {
  const state = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerSnapshot,
  );

  const reconnect = useCallback(() => {
    const client = getRealtimeClientInstance();
    if (client) {
      client.disconnect();
      client.connect();
    }
  }, []);

  return { ...state, reconnect };
}