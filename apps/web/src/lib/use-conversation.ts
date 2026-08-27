'use client';

import { ServerFrame, type Message } from '@lm/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Status = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type Pending = {
  id: string;
  body: string;
  state: 'sending' | 'failed';
};

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;
const HELLO_TIMEOUT_MS = 10_000;
const OFFLINE_AFTER_ATTEMPTS = 4;

function socketOrigin() {
  return process.env.NEXT_PUBLIC_WS_URL ?? 'ws://127.0.0.1:3001';
}

function backoff(attempt: number) {
  const capped = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return capped / 2 + Math.random() * (capped / 2);
}

export function useConversation(collaborationId: string, side: 'brand' | 'creator') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let cursor = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let helloTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (helloTimer) clearTimeout(helloTimer);
      retryTimer = null;
      helloTimer = null;
    };

    const retryLater = () => {
      if (stopped) return;
      setStatus(attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting');
      const delay = backoff(attempt);
      attempt += 1;
      retryTimer = setTimeout(open, delay);
    };

    async function open() {
      if (stopped) return;
      clearTimers();
      setStatus((current) => (current === 'live' ? 'reconnecting' : current));

      let ticket: string;
      try {
        const response = await fetch(`/bff/${side}/collaborations/${collaborationId}/ws-ticket`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!response.ok) throw new Error(String(response.status));
        ticket = ((await response.json()) as { ticket: string }).ticket;
      } catch {
        retryLater();
        return;
      }

      if (stopped) return;

      const url =
        `${socketOrigin()}/ws/collaborations/${collaborationId}` +
        `?after=${cursor}&ticket=${encodeURIComponent(ticket)}`;

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        retryLater();
        return;
      }

      socketRef.current = socket;

      helloTimer = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) socket.close();
      }, HELLO_TIMEOUT_MS);

      socket.onmessage = (event) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(event.data));
        } catch {
          return;
        }

        const parsed = ServerFrame.safeParse(raw);
        if (!parsed.success) return;
        const frame = parsed.data;

        switch (frame.t) {
          case 'ready': {
            if (helloTimer) clearTimeout(helloTimer);
            helloTimer = null;
            attempt = 0;
            setStatus('live');
            setError(null);
            return;
          }
          case 'message': {
            cursor = Math.max(cursor, frame.message.seq);
            setMessages((current) =>
              current.some((m) => m.id === frame.message.id)
                ? current
                : [...current, frame.message].sort((a, b) => a.seq - b.seq)
            );
            setPending((current) => current.filter((p) => p.id !== frame.message.id));
            return;
          }
          case 'ack': {
            cursor = Math.max(cursor, frame.seq);
            setPending((current) => current.filter((p) => p.id !== frame.id));
            return;
          }
          case 'error': {
            setError(frame.message);
            if (frame.id) {
              const failedId = frame.id;
              setPending((current) =>
                current.map((p) => (p.id === failedId ? { ...p, state: 'failed' } : p))
              );
            }
            return;
          }
          case 'pong':
            return;
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stopped) return;
        retryLater();
      };

      socket.onerror = () => socket.close();
    }

    reconnectRef.current = () => {
      if (stopped) return;
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      attempt = 0;
      void open();
    };

    void open();

    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      reconnectRef.current?.();
    };

    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    return () => {
      stopped = true;
      clearTimers();
      reconnectRef.current = null;
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);

      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [collaborationId, side]);

  const send = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;

    const id = crypto.randomUUID();
    const socket = socketRef.current;
    const reachable = socket?.readyState === WebSocket.OPEN;

    setPending((current) => [
      ...current,
      { id, body: trimmed, state: reachable ? 'sending' : 'failed' }
    ]);

    if (reachable) socket!.send(JSON.stringify({ t: 'send', id, body: trimmed }));
  }, []);

  const retry = useCallback((id: string) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      reconnectRef.current?.();
      return;
    }

    setPending((current) => {
      const target = current.find((p) => p.id === id);
      if (!target) return current;
      socket.send(JSON.stringify({ t: 'send', id, body: target.body }));
      return current.map((p) => (p.id === id ? { ...p, state: 'sending' } : p));
    });
  }, []);

  return { messages, pending, status, error, send, retry };
}
