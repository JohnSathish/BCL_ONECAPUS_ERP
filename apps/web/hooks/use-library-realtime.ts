'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/hooks/use-auth';
import { getRealtimeOrigin } from '@/lib/http/env';
import type { LibraryActivityItem, OccupancySnapshot, ScanResult } from '@/types/library';

export type LibraryRealtimeHandlers = {
  onOccupancy?: (snapshot: OccupancySnapshot) => void;
  onCirculationActivity?: (item: LibraryActivityItem) => void;
  onScanResult?: (result: import('@/types/library').ScanResult) => void;
};

export function useLibraryRealtime(handlers?: LibraryRealtimeHandlers) {
  const { session, isReady } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isReady || !session?.accessToken) return;

    const socket = io(`${getRealtimeOrigin()}/realtime`, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('library:occupancy:updated', (payload: OccupancySnapshot) => {
      handlersRef.current?.onOccupancy?.(payload);
    });

    socket.on('library:circulation:activity', (payload: LibraryActivityItem) => {
      handlersRef.current?.onCirculationActivity?.(payload);
    });

    socket.on('library:scan:result', (payload: ScanResult) => {
      handlersRef.current?.onScanResult?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isReady, session?.accessToken]);

  return socketRef;
}
