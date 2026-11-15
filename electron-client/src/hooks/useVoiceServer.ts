import { useEffect, useRef, useState } from 'react';

const URL = import.meta.env.VITE_VOICE_SERVER_URL;
const TOKEN = import.meta.env.VITE_CLIENT_TOKEN;
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

export type ServerStatus = 'connecting' | 'connected' | 'disconnected';
export type ServerMessage = { type: string; [key: string]: unknown };

export function useVoiceServer(onMessage: (message: ServerMessage) => void) {
  const [status, setStatus] = useState<ServerStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout>;
    let retryMs = FIRST_RETRY_MS;

    function connect() {
      setStatus('connecting');
      socket = new WebSocket(URL);
      const current = socket;
      current.onopen = () => {
        current.send(
          JSON.stringify({
            type: 'hello',
            id: crypto.randomUUID(),
            client_id: 'electron',
            kind: 'electron',
            token: TOKEN,
          }),
        );
        socketRef.current = current;
        retryMs = FIRST_RETRY_MS;
        setStatus('connected');
      };
      current.onmessage = (event) => {
        if (typeof event.data === 'string') {
          onMessageRef.current(JSON.parse(event.data));
        }
      };
      current.onclose = (event) => {
        socketRef.current = null;
        if (stopped) return;
        console.warn(`voice server closed: ${event.code} ${event.reason}`);
        setStatus('disconnected');
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  function send(clip: Blob) {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(clip);
    return true;
  }

  return { status, send };
}
