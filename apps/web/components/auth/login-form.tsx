'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolveHomePath } from '@/hooks/use-auth';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import type { ApiStartupRetryOptions } from '@/lib/http/wait-for-api';
import { fetchLoginChallenge, fetchLoginContext, login } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import type { LoginChallenge, LoginContext } from '@/types/login-context';
import { LoginDynamicFavicon } from '@/components/branding/login-dynamic-favicon';
import { LoginAuthCard } from './login-auth-card';
import { LoginAuthPanel } from './login-auth-panel';
import { LoginHeroPanel } from './login-hero-panel';
import { LoginPageShell } from './login-page-shell';
import { apiErrorMessage } from '@/utils/api-error';
import { loginSchema, type LoginFormValues } from './login-schema';

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setPrefs = useAuthStore((s) => s.setPrefs);
  const [error, setError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [context, setContext] = useState<LoginContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [apiWaiting, setApiWaiting] = useState(false);

  const startupRetryOptions = useMemo<ApiStartupRetryOptions>(
    () => ({
      onWaiting: () => setApiWaiting(true),
    }),
    [],
  );

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@demo.edu',
      password: 'Admin@123',
      rememberMe: false,
      challengeAnswer: '',
    },
  });

  const passwordValue = watch('password') ?? '';
  const challengeAnswer = watch('challengeAnswer') ?? '';

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    try {
      const next = await fetchLoginChallenge(startupRetryOptions);
      setChallenge(next);
      resetField('challengeAnswer');
      setVerificationError(null);
    } catch {
      setChallenge(null);
    } finally {
      setChallengeLoading(false);
    }
  }, [resetField, startupRetryOptions]);

  useEffect(() => {
    if (!contextLoading && !challengeLoading) {
      setApiWaiting(false);
    }
  }, [challengeLoading, contextLoading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setContextLoading(true);
      setContextError(null);
      try {
        const ctx = await fetchLoginContext(startupRetryOptions);
        if (!cancelled) {
          setContext(ctx);
          setContextError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setContext(null);
          setContextError(
            apiErrorMessage(
              error,
              'Could not load institution portal. Run npm run dev to start the full stack.',
            ),
          );
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    void loadChallenge();
    return () => {
      cancelled = true;
    };
  }, [loadChallenge, startupRetryOptions]);

  const onSubmit = useCallback(
    async (values: LoginFormValues) => {
      setError(null);
      setVerificationError(null);
      if (!challenge) {
        setError('Verification challenge unavailable. Please refresh the page.');
        return;
      }
      const challengeAnswerNum = Number(values.challengeAnswer.trim());
      if (!Number.isFinite(challengeAnswerNum)) {
        setVerificationError('Invalid equation value. Please enter a number.');
        return;
      }
      try {
        const session = await login({
          email: values.email,
          password: values.password,
          challengeToken: challenge.token,
          challengeAnswer: challengeAnswerNum,
          rememberMe: values.rememberMe,
        });
        setSession(session);
        setPrefs({ rememberMe: values.rememberMe });
        tokenRefreshManager.scheduleProactiveRefresh(session);
        router.replace(resolveHomePath(session.user.roles));
      } catch (err) {
        if (!axios.isAxiosError(err) || !err.response) {
          setError(
            'Cannot reach the API. Start it with: npm run dev -w api (or npm run dev from the repo root).',
          );
          return;
        }
        const data = err.response.data as {
          message?: string | string[];
          detail?: string;
        };
        const raw = data.detail ?? data.message ?? 'Invalid credentials';
        const text = Array.isArray(raw) ? raw.join(', ') : raw;
        const lower = text.toLowerCase();
        if (
          err.response.status === 400 &&
          (lower.includes('verification') ||
            lower.includes('challenge') ||
            lower.includes('equation'))
        ) {
          setVerificationError('Invalid equation value. Please solve the equation correctly.');
          resetField('challengeAnswer');
          void loadChallenge();
          return;
        }
        if (err.response.status === 429) {
          setError(text);
          return;
        }
        if (err.response.status === 401) {
          setError(
            'Invalid credentials. Use demo credentials below or contact your administrator.',
          );
          return;
        }
        setError(text);
        void loadChallenge();
      }
    },
    [challenge, loadChallenge, resetField, router, setSession, setPrefs],
  );

  const fillDemoCredentials = useCallback(
    (email: string, password: string) => {
      setValue('email', email, { shouldValidate: true });
      setValue('password', password, { shouldValidate: true });
      setError(null);
      setVerificationError(null);
    },
    [setValue],
  );

  return (
    <>
      <LoginDynamicFavicon faviconUrl={context?.institution.faviconUrl} />
      <LoginPageShell
        hero={
          <div className="relative flex h-full min-h-0 flex-col lg:min-h-screen">
            <LoginHeroPanel compact context={context} contextLoading={contextLoading} />
            <LoginHeroPanel context={context} contextLoading={contextLoading} />
          </div>
        }
        auth={
          <LoginAuthPanel
            theme={context?.theme}
            loginBackgroundStyle={context?.loginBackgroundStyle}
          >
            <LoginAuthCard
              context={context}
              contextLoading={contextLoading}
              contextError={contextError}
              waitingForApi={apiWaiting}
              challenge={challenge}
              challengeLoading={challengeLoading}
              onRefreshChallenge={loadChallenge}
              register={register}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              errors={errors}
              isSubmitting={isSubmitting}
              formError={error}
              verificationError={verificationError}
              passwordValue={passwordValue}
              challengeAnswer={challengeAnswer}
              onFillDemoCredentials={fillDemoCredentials}
            />
          </LoginAuthPanel>
        }
      />
    </>
  );
}
