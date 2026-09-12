/**
 * Pulse — WebSocket Client
 * Auto-reconnecting WebSocket client for live event streaming.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/live";

type EventHandler = (event: any) => void;

let socket: WebSocket | null = null;
let listeners: Set<EventHandler> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let lastMessageTime = 0;
const MAX_RECONNECT_DELAY = 10000;

function connect() {
  if (typeof window === "undefined") return; // SSR guard

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log("🔌 WebSocket connected");
      reconnectAttempts = 0;
      lastMessageTime = Date.now();
      
      pingInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 15000);

      watchdog = setInterval(() => {
        if (Date.now() - lastMessageTime > 5000) {
          console.warn("⚠️ WebSocket watchdog triggered, closing zombie connection");
          socket?.close();
        }
      }, 1000);
    };

    socket.onmessage = (msg) => {
      lastMessageTime = Date.now();
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "pong") return;
        listeners.forEach((fn) => fn(data));
      } catch {
        // ignore parse errors
      }
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket disconnected");
      if (pingInterval) clearInterval(pingInterval);
      if (watchdog) clearInterval(watchdog);
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function subscribeLiveEvents(handler: EventHandler): () => void {
  listeners.add(handler);

  // Connect on first subscriber
  if (listeners.size === 1 && !socket) {
    connect();
  }

  // Return unsubscribe function
  return () => {
    listeners.delete(handler);
    if (listeners.size === 0 && socket) {
      socket.close();
      socket = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }
  };
}

export function getConnectionState(): "connecting" | "open" | "closed" {
  if (!socket) return "closed";
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "open";
    default:
      return "closed";
  }
}
