'use client';

import { Loader2, Lock, Mail, Shield } from 'lucide-react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister } from 'react-hook-form';
import type { LoginChallenge, LoginContext } from '@/types/login-context';
import { LoginDemoWorkspace } from './login-demo-workspace';
import { LoginField } from './login-field';
import { LoginHumanVerification } from './login-human-verification';
import { LoginInstitutionHeader } from './login-institution-header';
import type { LoginFormValues } from './login-schema';

type Props = {
  context: LoginContext | null;
  contextLoading?: boolean;
  contextError?: string | null;
  waitingForApi?: boolean;
  challenge: LoginChallenge | null;
  challengeLoading?: boolean;
  onRefreshChallenge: () => void;
  register: UseFormRegister<LoginFormValues>;
  handleSubmit: UseFormHandleSubmit<LoginFormValues>;
  onSubmit: (values: LoginFormValues) => void;
  errors: FieldErrors<LoginFormValues>;
  isSubmitting: boolean;
  formError: string | null;
  verificationError?: string | null;
  passwordValue: string;
  challengeAnswer: string;
  onFillDemoCredentials?: (email: string, password: string) => void;
};

const SECURITY_LINES = [
  'Enterprise-grade authentication with human verification',
  'Role-based multi-tenant secure access',
] as const;

export function LoginAuthCard({
  context,
  contextLoading,
  contextError,
  waitingForApi = false,
  challenge,
  challengeLoading,
  onRefreshChallenge,
  register,
  handleSubmit,
  onSubmit,
  errors,
  isSubmitting,
  formError,
  verificationError,
  passwordValue,
  challengeAnswer,
  onFillDemoCredentials,
}: Props) {
  const themeStyle = context?.theme
    ? ({
        '--login-institution-primary': context.theme.primaryColor,
        '--login-institution-accent': context.theme.accentColor,
      } as CSSProperties)
    : undefined;

  const canSubmit =
    Boolean(context) && Boolean(challenge) && challengeAnswer.trim().length > 0 && !isSubmitting;

  return (
    <article
      className="login-glass-card login-institution-themed login-auth-card-shell flex w-full min-h-0 max-h-[min(calc(100dvh-4rem),880px)] min-w-0 max-w-[440px] flex-col overflow-hidden rounded-2xl"
      style={themeStyle}
    >
      <LoginInstitutionHeader
        context={context}
        loading={contextLoading}
        waitingForApi={waitingForApi}
        errorMessage={contextError}
      />

      <div className="login-auth-card-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <LoginField
              id="email"
              label="Work email"
              icon={Mail}
              type="email"
              autoComplete="email"
              disabled={isSubmitting || !context}
              error={errors.email?.message}
              register={register}
            />
            <LoginField
              id="password"
              label="Password"
              icon={Lock}
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting || !context}
              error={errors.password?.message}
              register={register}
              passwordValue={passwordValue}
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="rounded border-border"
                disabled={isSubmitting || !context}
                {...register('rememberMe')}
              />
              Remember me for 30 days
            </label>

            <LoginHumanVerification
              challenge={challenge}
              loading={challengeLoading}
              waitingForApi={waitingForApi}
              error={verificationError ?? errors.challengeAnswer?.message}
              disabled={isSubmitting || !context}
              register={register}
              onRefresh={onRefreshChallenge}
            />

            {formError ? (
              <p
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="login-cta group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="login-cta-gradient absolute inset-0" />
              <span className="login-cta-shine absolute inset-0" />
              <span className="relative flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  'Sign In Securely'
                )}
              </span>
            </button>
          </form>

          {context ? <LoginDemoWorkspace onFillCredentials={onFillDemoCredentials} /> : null}

          <div className="space-y-1 border-t border-border/40 pt-2.5">
            {SECURITY_LINES.map((line) => (
              <p
                key={line}
                className="flex items-center gap-2 text-[10px] leading-snug text-muted-foreground"
              >
                <Shield className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border/50 bg-muted/15 px-5 py-3 sm:px-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Link
            href="https://basecodelabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BrandingLogoImage
              src="/branding/basecode-labs-logo.png"
              className="opacity-90"
              size={28}
            />
            <p className="text-[10px] text-muted-foreground">
              A Product of{' '}
              <span className="font-medium text-foreground/80 group-hover:text-primary">
                BaseCode Labs Pvt. Ltd.
              </span>
            </p>
          </Link>
        </div>
      </footer>
    </article>
  );
}
