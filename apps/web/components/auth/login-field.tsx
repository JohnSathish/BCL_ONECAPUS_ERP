'use client';

import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { FieldError, UseFormRegister } from 'react-hook-form';
import { cn } from '@/utils/cn';
import type { LoginFormValues } from './login-schema';

type Props = {
  id: keyof LoginFormValues;
  label: string;
  icon: LucideIcon;
  type?: 'text' | 'email' | 'password';
  error?: FieldError['message'];
  autoComplete?: string;
  disabled?: boolean;
  register: UseFormRegister<LoginFormValues>;
  passwordValue?: string;
};

function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^a-zA-Z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export function LoginField({
  id,
  label,
  icon: Icon,
  type = 'text',
  error,
  autoComplete,
  disabled,
  register,
  passwordValue = '',
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const { onBlur, ref, ...field } = register(id);
  const strength = useMemo(() => passwordStrength(passwordValue), [passwordValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isPassword) {
        setCapsLock(e.getModifierState('CapsLock'));
      }
    },
    [isPassword],
  );

  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground peer-focus:text-primary"
        aria-hidden
      />
      <input
        id={id}
        ref={ref}
        type={inputType}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder=" "
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : isPassword ? `${id}-extras` : undefined}
        className={cn(
          'login-input peer w-full rounded-xl border bg-card/60 pb-2.5 pl-11 pr-4 pt-5 text-sm text-foreground',
          'border-border/80 transition-all duration-200',
          'focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/25',
          focused &&
            'login-input-active border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]',
          error && 'border-danger/50 focus:ring-danger/20',
          isPassword && 'pr-11',
        )}
        {...field}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          onBlur(e);
          setFocused(false);
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200',
          'peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary',
          'peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs',
        )}
      >
        {label}
      </label>
      {isPassword ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {isPassword ? (
        <div id={`${id}-extras`} className="mt-2 space-y-1.5">
          {capsLock ? (
            <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
              Caps Lock is on
            </p>
          ) : null}
          {passwordValue ? (
            <div className="flex items-center gap-2" aria-label="Password strength">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      i < strength
                        ? strength <= 1
                          ? 'bg-danger'
                          : strength <= 2
                            ? 'bg-amber-500'
                            : strength <= 3
                              ? 'bg-primary'
                              : 'bg-success'
                        : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {strength <= 1
                  ? 'Weak'
                  : strength <= 2
                    ? 'Fair'
                    : strength <= 3
                      ? 'Good'
                      : 'Strong'}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
