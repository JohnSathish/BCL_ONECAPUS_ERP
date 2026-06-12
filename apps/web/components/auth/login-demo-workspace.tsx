'use client';

import { Check, ChevronDown, Copy, Eye, EyeOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from '@/utils/cn';
import { DEMO_CREDENTIALS } from './login-schema';

function DemoRow({
  label,
  email,
  password,
  onFill,
}: {
  label: string;
  email: string;
  password: string;
  onFill?: (email: string, password: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const copyEmail = useCallback(async () => {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [email]);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 py-1.5 last:border-0">
      <button
        type="button"
        onClick={() => onFill?.(email, password)}
        className="min-w-0 flex-1 text-left text-[11px] font-medium text-foreground hover:text-primary"
        title="Fill login form"
      >
        <span className="block truncate">{label}</span>
        <span className="block truncate font-mono text-[10px] font-normal text-muted-foreground">
          {email}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <span className="font-mono text-[10px] text-muted-foreground">
          {revealed ? password : '••••••'}
        </span>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={copyEmail}
          aria-label="Copy email"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

export function LoginDemoWorkspace({
  onFillCredentials,
}: {
  onFillCredentials?: (email: string, password: string) => void;
}) {
  const [bulkCopied, setBulkCopied] = useState(false);

  const copyAllCredentials = useCallback(async () => {
    const text = DEMO_CREDENTIALS.map((d) => `${d.label}: ${d.email} / ${d.password}`).join('\n');
    await navigator.clipboard.writeText(`Tenant: demo\n${text}`);
    setBulkCopied(true);
    setTimeout(() => setBulkCopied(false), 2000);
  }, []);

  return (
    <details className="login-demo-details rounded-lg border border-border/40 bg-muted/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <ChevronDown className="login-demo-chevron h-3.5 w-3.5 shrink-0 transition-transform" />
          Demo workspace
          <span className="font-normal opacity-75">(click role to fill)</span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            void copyAllCredentials();
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] hover:bg-background',
          )}
        >
          {bulkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </button>
      </summary>
      <div className="max-h-[140px] overflow-y-auto border-t border-border/30 px-3 pb-2 pt-1">
        {DEMO_CREDENTIALS.map((d) => (
          <DemoRow
            key={d.email}
            label={d.label}
            email={d.email}
            password={d.password}
            onFill={onFillCredentials}
          />
        ))}
      </div>
    </details>
  );
}
