import axios from 'axios';

export type ApiProblemJson = {
  detail?: string;
  fieldErrors?: Record<string, string>;
};

/** Parses application/problem+json (and compatible) bodies from API errors. */
export function parseApiProblemJson(error: unknown): ApiProblemJson {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiProblemJson | undefined;
    const fieldErrors =
      data?.fieldErrors && typeof data.fieldErrors === 'object' && !Array.isArray(data.fieldErrors)
        ? (data.fieldErrors as Record<string, string>)
        : undefined;
    return {
      detail: typeof data?.detail === 'string' ? data.detail : undefined,
      fieldErrors,
    };
  }
  return {};
}
