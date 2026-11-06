import { api } from './api';

export async function requestStepUpToken(input: {
  password?: string;
  totpCode?: string;
}): Promise<string> {
  const { data } = await api.post<{
    stepUpToken?: string;
    data?: { stepUpToken?: string };
  }>('/v1/auth/step-up', input);
  const token = data.stepUpToken ?? data.data?.stepUpToken;
  if (!token) {
    throw new Error('Password was accepted, but the download confirmation was not returned.');
  }
  return token;
}
