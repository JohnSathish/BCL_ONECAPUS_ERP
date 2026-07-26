'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';
import { getRealtimeOrigin } from '@/lib/http/env';
import type { SupportChatMessage } from '@/services/support-centre';

export type SupportRealtimeHandlers = {
  onMessage?: (payload: {
    threadId: string;
    message: SupportChatMessage & { senderRole?: string };
  }) => void;
  onTyping?: (payload: { threadId: string; userId: string; isTyping: boolean }) => void;
  onRead?: (payload: { threadId: string; userId: string }) => void;
  onAssigned?: (payload: { threadId: string; agentId: string }) => void;
  onInboxPing?: (payload: { threadId: string; category?: string; preview?: string }) => void;
};

/**
 * Prefer polling first so Firefox does not spam failed WebSocket attempts
 * when the Nest API is briefly restarting or WS upgrade is flaky.
 * Socket.IO will still upgrade to websocket after a successful handshake.
 */
export function useSupportRealtime(
  threadId: string | null | undefined,
  handlers?: SupportRealtimeHandlers,
) {
  const { session, isReady } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const joinedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady || !session?.accessToken) return;

    let cancelled = false;
    let socket: Socket | null = null;

    // Defer connect slightly so React Strict Mode remounts do not leave
    // half-open websockets that Firefox logs as "interrupted while loading".
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      socket = io(`${getRealtimeOrigin()}/realtime`, {
        auth: { token: session.accessToken },
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1200,
        timeout: 12_000,
        autoConnect: true,
      });
      socketRef.current = socket;

      socket.on('connect_error', () => {
        // Soft-fail: REST inbox still works; avoid console.error spam.
      });

      socket.on('support.message', (payload) => {
        handlersRef.current?.onMessage?.(payload);
      });
      socket.on('support.typing', (payload) => {
        handlersRef.current?.onTyping?.(payload);
      });
      socket.on('support.read', (payload) => {
        handlersRef.current?.onRead?.(payload);
      });
      socket.on('support.thread.assigned', (payload) => {
        handlersRef.current?.onAssigned?.(payload);
      });
      socket.on('support.inbox.ping', (payload) => {
        handlersRef.current?.onInboxPing?.(payload);
      });
      socket.on('support.message.updated', (payload) => {
        handlersRef.current?.onMessage?.(payload);
      });

      if (joinedThreadRef.current) {
        socket.emit('support:join-thread', {
          threadId: joinedThreadRef.current,
        });
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [isReady, session?.accessToken]);

  useEffect(() => {
    joinedThreadRef.current = threadId || null;
    const socket = socketRef.current;
    if (!socket || !threadId) return;
    socket.emit('support:join-thread', { threadId });
    return () => {
      socket.emit('support:leave-thread', { threadId });
    };
  }, [threadId]);

  return socketRef;
}
