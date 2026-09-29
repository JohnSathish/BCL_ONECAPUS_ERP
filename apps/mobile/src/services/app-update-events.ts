export type UpdateRequiredSignal = {
  minVersion?: string | null;
  storeUrl?: string | null;
  message?: string | null;
};

type Listener = (signal: UpdateRequiredSignal) => void;

const listeners = new Set<Listener>();

/** Raised when the API rejects a request with 426 (installed version below the required minimum). */
export function emitUpdateRequired(signal: UpdateRequiredSignal) {
  for (const listener of listeners) {
    try {
      listener(signal);
    } catch {
      // listener errors must not break the API client
    }
  }
}

export function onUpdateRequired(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
