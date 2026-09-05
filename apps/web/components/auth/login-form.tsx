'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  canAccessAdminPortal,
  canAccessApplicantPortal,
  resolveHomePath,
} from '@/lib/permissions/portal-access';
import { getWebDeviceFingerprint } from '@/lib/device-fingerprint';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import type { ApiStartupRetryOptions } from '@/lib/http/wait-for-api';
import { fetchLoginChallenge, fetchLoginContext, login } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import type { LoginChallenge, LoginContext } from '@/types/login-context';
import { LoginDynamicFavicon } from '@/components/branding/login-dynamic-favicon';
import { SCHOOL_PORTAL_LOGO_SRC } from '@/lib/school-admissions-branding';
import { LoginAuthCard } from './login-auth-card';
import { LoginAuthPanel } from './login-auth-panel';
import { LoginHeroPanel } from './login-hero-panel';
import { LoginPageShell } from './login-page-shell';
import { ApiError, apiErrorMessage, isApiUnavailableError } from '@/utils/api-error';
import { loginSchema, type LoginFormValues } from './login-schema';
import { isDemoLoginWorkspaceEnabled } from '@/lib/demo-login';

type LoginFormProps = {
  /** Override default role-based home after successful login. */
  postLoginPath?: string;
  /** Full page navigation — reliable on kiosk gate PCs (avoids RSC client fetch). */
  hardRedirect?: boolean;
  /**
   * Auth card only (no marketing hero). Use for subdomain portals
   * such as pay / library where the full ERP splash looks wrong.
   */
  compact?: boolean;
};

function resolveSafeNextPath(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const path = raw.trim();
  // Only same-origin relative paths — block open redirects.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return undefined;
  }
  return path;
}

export function LoginForm({
  postLoginPath,
  hardRedirect = false,
  compact = false,
}: LoginFormProps) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setPrefs = useAuthStore((s) => s.setPrefs);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [context, setContext] = useState<LoginContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [apiWaiting, setApiWaiting] = useState(false);
  const [queryNextPath, setQueryNextPath] = useState<string | undefined>();

  const startupRetryOptions = useMemo<ApiStartupRetryOptions>(
    () => ({
      onWaiting: () => setApiWaiting(true),
    }),
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      setInfo('Password updated. Sign in with your new password.');
    }
    setQueryNextPath(resolveSafeNextPath(params.get('next')));
  }, []);

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
      identifier: isDemoLoginWorkspaceEnabled() ? 'admin@demo.edu' : '',
      password: isDemoLoginWorkspaceEnabled() ? 'Admin@123' : '',
      rememberMe: false,
      challengeAnswer: '',
    },
  });

  const passwordValue = watch('password') ?? '';
  const challengeAnswer = watch('challengeAnswer') ?? '';

  useEffect(() => {
    if (!isDemoLoginWorkspaceEnabled()) {
      setValue('identifier', '');
      setValue('password', '');
    }
  }, [setValue]);

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
        const trimmed = values.identifier.trim();
        const fingerprint = getWebDeviceFingerprint();
        const session = await login({
          ...(trimmed.includes('@') ? { email: trimmed.toLowerCase() } : { identifier: trimmed }),
          password: values.password,
          challengeToken: challenge.token,
          challengeAnswer: challengeAnswerNum,
          rememberMe: values.rememberMe,
          ...fingerprint,
        });
        setSession(session);
        setPrefs({ rememberMe: values.rememberMe });
        useAuthStore.getState().setBootstrapping(false);
        tokenRefreshManager.scheduleProactiveRefresh(session);
        if (session.user.mustResetPassword) {
          // Soft navigate so the in-memory session (not persisted) survives.
          // SessionProvider also bootstraps /change-password from the refresh cookie.
          router.replace('/change-password');
          return;
        }
        const roles = session.user.roles ?? [];
        const permissions = session.user.permissions ?? [];
        const schoolHome =
          context?.institutionType === 'SCHOOL'
            ? canAccessAdminPortal(roles, permissions)
              ? '/admin'
              : canAccessApplicantPortal(roles, permissions)
                ? '/school-admissions-portal/dashboard'
                : null
            : null;
        const destination =
          postLoginPath ?? queryNextPath ?? schoolHome ?? resolveHomePath(roles, permissions);
        // Full navigation avoids client chunk mismatch and post-login render loops on portal shells.
        window.location.assign(destination);
      } catch (err) {
        if (isApiUnavailableError(err)) {
          setError(
            'Cannot reach the API. Start it with: npm run dev -w api (or npm run dev from the repo root).',
          );
          return;
        }
        const status =
          err instanceof ApiError
            ? err.status
            : axios.isAxiosError(err)
              ? err.response?.status
              : undefined;
        const text = apiErrorMessage(err, 'Invalid credentials');
        const lower = text.toLowerCase();
        if (
          status === 400 &&
          (lower.includes('verification') ||
            lower.includes('challenge') ||
            lower.includes('equation'))
        ) {
          setVerificationError(
            'The security equation answer was incorrect. A new equation is shown below — solve it and try again. This does not lock your account.',
          );
          resetField('challengeAnswer');
          void loadChallenge();
          return;
        }
        if (status === 429) {
          setError(
            /throttler/i.test(text)
              ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
              : text,
          );
          void loadChallenge();
          return;
        }
        if (status === 403) {
          setError(text || 'Access denied for this device. Contact your college administrator.');
          void loadChallenge();
          return;
        }
        if (status === 401) {
          const isGeneric = !text || text === 'Invalid credentials' || /^unauthorized$/i.test(text);
          setError(
            isGeneric
              ? isDemoLoginWorkspaceEnabled()
                ? 'Incorrect username or password. Use the demo credentials below, or contact your administrator.'
                : 'Incorrect username or password. Check your details, use Forgot password, or contact your college administrator.'
              : text,
          );
          void loadChallenge();
          return;
        }
        setError(text);
        void loadChallenge();
      }
    },
    [
      challenge,
      context,
      hardRedirect,
      loadChallenge,
      postLoginPath,
      queryNextPath,
      resetField,
      router,
      setSession,
      setPrefs,
    ],
  );

  const fillDemoCredentials = useCallback(
    (email: string, password: string) => {
      setValue('identifier', email, { shouldValidate: true });
      setValue('password', password, { shouldValidate: true });
      setError(null);
      setVerificationError(null);
    },
    [setValue],
  );

  const authCard = (
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
      formInfo={info}
      verificationError={verificationError}
      passwordValue={passwordValue}
      challengeAnswer={challengeAnswer}
      onFillDemoCredentials={fillDemoCredentials}
    />
  );

  const schoolLogin = context?.institutionType === 'SCHOOL';
  const favicon = (
    <LoginDynamicFavicon
      faviconUrl={schoolLogin ? SCHOOL_PORTAL_LOGO_SRC : context?.institution.faviconUrl}
      forceProductBrand={!schoolLogin}
    />
  );

  if (compact) {
    return (
      <>
        {favicon}
        <div className="mx-auto w-full max-w-md px-1 py-2">{authCard}</div>
      </>
    );
  }

  return (
    <>
      {favicon}
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
            {authCard}
          </LoginAuthPanel>
        }
      />
    </>
  );
}
