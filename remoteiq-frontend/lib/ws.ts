// lib/ws.ts
type Listener = (msg: any) => void;

let socket: WebSocket | null = null;
const listeners = new Set<Listener>();

export function ensureSocket(): WebSocket {
  const base = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:3001/ws";
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }
  socket = new WebSocket(base);
  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      for (const cb of Array.from(listeners)) cb(data);
    } catch {
      // ignore malformed frames
    }
  };
  return socket;
}

export function onWsMessage(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
