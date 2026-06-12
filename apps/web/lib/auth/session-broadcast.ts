'use client';

import type { AuthSession } from '@/types/auth';

const CHANNEL_NAME = 'nep-erp-session';

export type SessionBroadcastMessage =
  | { type: 'LOGOUT' }
  | { type: 'SESSION_UPDATED'; session: AuthSession }
  | { type: 'IDLE_EXTENDED' };

type Listener = (message: SessionBroadcastMessage) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<SessionBroadcastMessage>) => {
        for (const listener of listeners) {
          listener(event.data);
        }
      };
    } catch {
      return null;
    }
  }
  return channel;
}

export function subscribeSessionBroadcast(listener: Listener): () => void {
  listeners.add(listener);
  getChannel();
  return () => listeners.delete(listener);
}

export function broadcastSessionMessage(message: SessionBroadcastMessage): void {
  getChannel()?.postMessage(message);
}
