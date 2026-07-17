'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/hooks/use-auth';
import { getRealtimeOrigin } from '@/lib/http/env';

export type CompetitionRealtimeHandlers = {
  onLeaderboard?: (payload: Record<string, unknown>) => void;
  onResult?: (payload: Record<string, unknown>) => void;
  onMedals?: (payload: Record<string, unknown>) => void;
  onAnnouncement?: (payload: Record<string, unknown>) => void;
  onLiveEvent?: (payload: Record<string, unknown>) => void;
};

export function useCompetitionRealtime(
  meetId: string | null | undefined,
  handlers?: CompetitionRealtimeHandlers,
) {
  const { session, isReady } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isReady || !session?.accessToken || !meetId) return;

    const socket = io(`${getRealtimeOrigin()}/realtime`, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('competition:join-meet', { meetId });
    });

    socket.on('competition:leaderboard', (payload: Record<string, unknown>) => {
      if (payload?.meetId && payload.meetId !== meetId) return;
      handlersRef.current?.onLeaderboard?.(payload);
    });
    socket.on('competition:result', (payload: Record<string, unknown>) => {
      if (payload?.meetId && payload.meetId !== meetId) return;
      handlersRef.current?.onResult?.(payload);
    });
    socket.on('competition:medals', (payload: Record<string, unknown>) => {
      if (payload?.meetId && payload.meetId !== meetId) return;
      handlersRef.current?.onMedals?.(payload);
    });
    socket.on('competition:announcement', (payload: Record<string, unknown>) => {
      if (payload?.meetId && payload.meetId !== meetId) return;
      handlersRef.current?.onAnnouncement?.(payload);
    });
    socket.on('competition:live-event', (payload: Record<string, unknown>) => {
      if (payload?.meetId && payload.meetId !== meetId) return;
      handlersRef.current?.onLiveEvent?.(payload);
    });

    return () => {
      socket.emit('competition:leave-meet', { meetId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isReady, session?.accessToken, meetId]);

  return socketRef;
}
