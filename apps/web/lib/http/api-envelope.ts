export function isApiEnvelope(value: unknown): value is { success: boolean; data?: unknown } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'success' in value &&
    typeof (value as { success?: unknown }).success === 'boolean',
  );
}

/** Unwrap `{ success, data }` responses from the Nest API (SSR fetch and axios). */
export function unwrapApiPayload<T>(value: unknown): T {
  if (isApiEnvelope(value) && value.success && 'data' in value) {
    return value.data as T;
  }
  return value as T;
}
