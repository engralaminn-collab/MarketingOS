/**
 * Realtime Client — singleton WebSocket client for MarketingOS.
 *
 * Provides:
 * - WebSocket connection management with auto-reconnect
 * - Event subscription/unsubscription
 * - Connection state tracking
 * - Authentication via JWT token
 *
 * Usage:
 *   const client = getRealtimeClientInstance();
 *   client.connect();
 *   const unsub = client.on('lead:created', (data) => { ... });
 *   // later: unsub();
 */

import type { AllRealtimeEvents, RealtimeEventDataMap } from './events';

type EventHandler = (data: unknown) => void;

export interface RealtimeClient {
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly socketId: string | null;
  connect(): void;
  disconnect(): void;
  on<K extends AllRealtimeEvents>(event: K, handler: (data: RealtimeEventDataMap[K]) => void): () => void;
  onConnect(handler: () => void): () => void;
  onDisconnect(handler: () => void): () => void;
  emit(event: string, data: unknown): void;
}

class MarketingOSRealtimeClient implements RealtimeClient {
  private ws: WebSocket | null = null;
  private _isConnected = false;
  private _isConnecting = false;
  private _socketId: string | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private connectHandlers = new Set<() => void>();
  private disconnectHandlers = new Set<() => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isConnecting(): boolean {
    return this._isConnecting;
  }

  get socketId(): string | null {
    return this._socketId;
  }

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this._isConnected || this._isConnecting) return;

    this._isConnecting = true;

    // Get auth token from localStorage
    this.token = localStorage.getItem('mos_token');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._isConnected = true;
        this._isConnecting = false;
        this.reconnectAttempts = 0;

        // Authenticate
        if (this.token) {
          this.ws?.send(JSON.stringify({ type: 'auth', token: this.token }));
        }

        for (const handler of this.connectHandlers) {
          try { handler(); } catch (e) { console.error('[realtime] connect handler error:', e); }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (type === 'socket_id') {
            this._socketId = data.socketId;
            return;
          }

          // Dispatch to handlers
          const eventHandlers = this.handlers.get(type);
          if (eventHandlers) {
            for (const handler of eventHandlers) {
              try { handler(data); } catch (e) { console.error(`[realtime] handler error for ${type}:`, e); }
            }
          }
        } catch (e) {
          console.error('[realtime] message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this._isConnecting = false;
        this._socketId = null;

        for (const handler of this.disconnectHandlers) {
          try { handler(); } catch (e) { console.error('[realtime] disconnect handler error:', e); }
        }

        // Auto-reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this._isConnecting = false;
            this.connect();
          }, delay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[realtime] WebSocket error:', error);
        this._isConnecting = false;
      };
    } catch (e) {
      console.error('[realtime] connection failed:', e);
      this._isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
    this._isConnecting = false;
    this._socketId = null;
  }

  on<K extends AllRealtimeEvents>(
    event: K,
    handler: (data: RealtimeEventDataMap[K]) => void
  ): () => void {
    const eventKey = event as string;
    if (!this.handlers.has(eventKey)) {
      this.handlers.set(eventKey, new Set());
    }
    const wrappedHandler = handler as EventHandler;
    this.handlers.get(eventKey)!.add(wrappedHandler);

    return () => {
      this.handlers.get(eventKey)?.delete(wrappedHandler);
    };
  }

  onConnect(handler: () => void): () => void {
    this.connectHandlers.add(handler);
    return () => {
      this.connectHandlers.delete(handler);
    };
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  emit(event: string, data: unknown): void {
    if (!this._isConnected || !this.ws) return;
    this.ws.send(JSON.stringify({ type: event, data }));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let instance: RealtimeClient | null = null;

export function getRealtimeClientInstance(): RealtimeClient | null {
  if (typeof window === 'undefined') return null;
  if (!instance) {
    instance = new MarketingOSRealtimeClient();
  }
  return instance;
}
