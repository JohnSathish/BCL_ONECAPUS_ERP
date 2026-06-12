'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/hooks/use-auth';
import { getApiBaseUrl } from '@/lib/http/env';
import type { OccupancySnapshot } from '@/types/library';

function realtimeOrigin() {
  const base = getApiBaseUrl();
  if (base.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return base.replace(/\/api\/?$/, '');
}

export function useLibraryRealtime(onOccupancy?: (snapshot: OccupancySnapshot) => void) {
  const { session, isReady } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlerRef = useRef(onOccupancy);
  handlerRef.current = onOccupancy;

  useEffect(() => {
    if (!isReady || !session?.accessToken) return;

    const socket = io(`${realtimeOrigin()}/realtime`, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('library:occupancy:updated', (payload: OccupancySnapshot) => {
      handlerRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isReady, session?.accessToken]);

  return socketRef;
}
