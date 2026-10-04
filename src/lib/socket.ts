declare const process: any;

import { authStorage, api, getApiBaseUrl } from './api';
import { Message, Reaction, User } from '@/types/chat';

export type SocketEventMap = {
  connected: { status: string; userId: string; name?: string; channels?: string[] };
  channel_message: Message;
  direct_message: Message;
  message_reaction_updated: { messageId: string; reactions: Reaction[] };
  message_deleted: { messageId: string; channelId?: string };
  typing: { userId: string; userName?: string; channelId?: string; recipientId?: string };
  stop_typing: { userId: string; channelId?: string; recipientId?: string };
  user_status: { userId: string; status: 'online' | 'offline' };
  connection_change: { isConnected: boolean; reconnectAttempts: number };
  error: { message: string };
};

type EventCallback<K extends keyof SocketEventMap> = (data: SocketEventMap[K]) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private baseReconnectDelay = 1500;
  private isExplicitlyClosed = false;
  private listeners: { [K in keyof SocketEventMap]?: Set<EventCallback<K>> } = {};

  public isConnected = false;

  constructor() {
    this.listeners = {};
  }

  /**
   * Connect or reconnect to the WebSocket server with the current JWT token
   */
  public connect() {
    if (typeof window === 'undefined') return;

    const token = authStorage.getAccessToken();
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      const apiUrl = getApiBaseUrl();
      const isHttps = apiUrl.startsWith('https') || (window.location.protocol === 'https:');
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const cleanHost = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${cleanHost}/ws?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connection_change', { isConnected: true, reconnectAttempts: 0 });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event) {
            this.emit(parsed.event as keyof SocketEventMap, parsed.data);
          }
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = async (event) => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('connection_change', { isConnected: false, reconnectAttempts: this.reconnectAttempts });

        if (!this.isExplicitlyClosed) {
          if (event.code === 4001) {
            // Authentication token expired or rejected by server - try refreshing token once
            try {
              const refreshed = await api.refreshSession();
              if (refreshed?.accessToken) {
                this.reconnectAttempts = 0;
                this.connect();
                return;
              }
            } catch (e) {
              console.warn('Could not refresh token after socket auth error:', e);
            }
            console.warn('WebSocket unauthorized (code 4001) and session refresh failed. Pausing reconnection.');
            return;
          }
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        if (this.reconnectAttempts < 3) {
          console.warn('WebSocket connection error:', err);
        }
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket connection:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule exponential backoff reconnection
   */
  private scheduleReconnect() {
    if (this.isExplicitlyClosed || typeof window === 'undefined') return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached');
      return;
    }

    clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      15000,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat ping/pong to keep connection alive
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', {});
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Disconnect cleanly
   */
  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('connection_change', { isConnected: false, reconnectAttempts: 0 });
  }

  /**
   * Subscribe to channel room
   */
  public joinChannel(channelId: string) {
    this.send('join_channel', { channelId });
  }

  /**
   * Leave channel room
   */
  public leaveChannel(channelId: string) {
    this.send('leave_channel', { channelId });
  }

  /**
   * Send typing indicator
   */
  public sendTyping(channelId?: string, recipientId?: string) {
    this.send('typing', { channelId, recipientId });
  }

  /**
   * Send stop typing indicator
   */
  public sendStopTyping(channelId?: string, recipientId?: string) {
    this.send('stop_typing', { channelId, recipientId });
  }

  /**
   * Generic sender with event payload
   */
  public send(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  /**
   * Register event listener
   */
  public on<K extends keyof SocketEventMap>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<EventCallback<K>>).add(callback);

    // Return cleanup unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Remove event listener
   */
  public off<K extends keyof SocketEventMap>(event: K, callback: EventCallback<K>) {
    const set = this.listeners[event];
    if (set) {
      (set as Set<EventCallback<K>>).delete(callback);
    }
  }

  /**
   * Emit event internally to registered listeners
   */
  private emit<K extends keyof SocketEventMap>(event: K, data: SocketEventMap[K]) {
    const set = this.listeners[event];
    if (set) {
      for (const cb of set) {
        try {
          (cb as EventCallback<K>)(data);
        } catch (err) {
          console.error(`Error in WebSocket listener for event "${event}":`, err);
        }
      }
    }
  }
}

// Global singleton instance
export const socketClient = new WebSocketClient();
