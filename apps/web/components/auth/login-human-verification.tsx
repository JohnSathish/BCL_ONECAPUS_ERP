'use client';

import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { FieldError, UseFormRegister } from 'react-hook-form';
import type { LoginChallenge } from '@/types/login-context';
import { cn } from '@/utils/cn';
import type { LoginFormValues } from './login-schema';

type Props = {
  challenge: LoginChallenge | null;
  loading?: boolean;
  waitingForApi?: boolean;
  error?: FieldError['message'] | string;
  disabled?: boolean;
  register: UseFormRegister<LoginFormValues>;
  onRefresh: () => void;
};

export function LoginHumanVerification({
  challenge,
  loading,
  waitingForApi = false,
  error,
  disabled,
  register,
  onRefresh,
}: Props) {
  const { onBlur, ref, ...field } = register('challengeAnswer');

  return (
    <div className="space-y-1.5">
      <label htmlFor="challengeAnswer" className="sr-only">
        Human verification answer
      </label>
      <div className="flex items-stretch gap-2">
        <div
          className="login-verification-equation flex min-w-[7.5rem] items-center justify-center gap-1 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 font-mono text-sm font-semibold text-foreground"
          aria-hidden={!challenge}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
          {loading ? (
            <span className="text-xs text-muted-foreground">{waitingForApi ? 'Waiting' : '…'}</span>
          ) : challenge ? (
            <span>{challenge.expression} =</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <input
          id="challengeAnswer"
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled || loading || !challenge}
          placeholder="Answer"
          aria-label="Verification answer"
          aria-invalid={error ? true : undefined}
          className={cn(
            'login-input min-w-0 flex-1 rounded-xl border bg-card/60 px-3 py-2.5 text-sm text-foreground',
            'border-border/80 transition-all duration-200',
            'focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/25',
            error && 'border-danger/50 focus:ring-danger/20',
          )}
          {...field}
          onBlur={onBlur}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || loading}
          aria-label="Refresh verification challenge"
          className="flex shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card/60 px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : waitingForApi ? (
        <p className="text-[11px] text-muted-foreground">
          Loading verification challenge once the API is ready…
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Solve the equation to verify you are human.
        </p>
      )}
    </div>
  );
}
