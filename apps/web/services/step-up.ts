import { api } from './api';

export async function requestStepUpToken(input: {
  password?: string;
  totpCode?: string;
}): Promise<string> {
  const { data } = await api.post<{ stepUpToken: string; expiresInSeconds: number }>(
    '/v1/auth/step-up',
    input,
  );
  return data.stepUpToken;
}
