import axios from 'axios';

export type ApiErrorKind =
  | 'NetworkError'
  | 'TimeoutError'
  | 'UnauthorizedError'
  | 'ServerError'
  | 'ValidationError'
  | 'UnknownError';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts?: {
      status?: number;
      detail?: string;
      fieldErrors?: Record<string, string[]>;
      cause?: unknown;
    },
  ) {
    super(message, { cause: opts?.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts?.status;
    this.detail = opts?.detail;
    this.fieldErrors = opts?.fieldErrors;
  }
}

export function normalizeAxiosError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new ApiError('TimeoutError', 'Request timed out. The server may be busy.', {
        cause: error,
      });
    }

    if (!error.response) {
      return new ApiError(
        'NetworkError',
        'Unable to reach API server. Check that the backend is running.',
        { cause: error },
      );
    }

    const status = error.response.status;
    const contentType = String(error.response.headers?.['content-type'] ?? '').toLowerCase();
    const rawData = error.response.data;
    if (typeof rawData === 'string' && contentType.includes('text/html')) {
      return new ApiError(
        status >= 500 ? 'ServerError' : 'UnknownError',
        'API returned an HTML page instead of JSON. The API proxy is misconfigured or the backend is unavailable.',
        {
          status,
          detail: rawData.slice(0, 240),
          cause: error,
        },
      );
    }

    const data = rawData as
      | {
          detail?: string;
          message?: string;
          errorCode?: string;
          fieldErrors?: Record<string, string[]>;
          details?: { fieldErrors?: Record<string, string[]> };
        }
      | undefined;
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.message === 'string'
          ? data.message
          : undefined;
    const fieldErrors = data?.fieldErrors ?? data?.details?.fieldErrors;

    if (status === 401) {
      return new ApiError('UnauthorizedError', detail ?? 'Session expired.', {
        status,
        detail,
        cause: error,
      });
    }

    if (status === 403) {
      return new ApiError(
        'UnknownError',
        detail ?? 'You do not have permission to perform this action.',
        {
          status,
          detail,
          cause: error,
        },
      );
    }

    if (status >= 500) {
      return new ApiError('ServerError', detail ?? 'Server error. Try again shortly.', {
        status,
        detail,
        cause: error,
      });
    }

    if (status === 400 || status === 422) {
      return new ApiError('ValidationError', detail ?? 'Validation failed.', {
        status,
        detail,
        fieldErrors,
        cause: error,
      });
    }

    return new ApiError('UnknownError', detail ?? error.message, {
      status,
      detail,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new ApiError('UnknownError', error.message, { cause: error });
  }

  return new ApiError('UnknownError', 'An unexpected error occurred.');
}

export function isRetryableQueryError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.kind === 'NetworkError' ||
      error.kind === 'TimeoutError' ||
      (error.kind === 'ServerError' && (error.status ?? 0) >= 502)
    );
  }
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  const status = error.response.status;
  if (status >= 502 && status <= 504) return true;
  const data = error.response.data as { errorCode?: string } | undefined;
  return (
    data?.errorCode === 'API_PROXY_UNAVAILABLE' || data?.errorCode === 'API_GATEWAY_UNAVAILABLE'
  );
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
