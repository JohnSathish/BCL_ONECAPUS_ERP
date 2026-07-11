'use client';

import Link from 'next/link';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="mt-6 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Students sign in with their college roll number. Password recovery is handled by the
              college office for now.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">
          <p className="font-medium">What to do</p>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Contact the college administrator or office staff with your roll number.</li>
            <li>Ask them to reset your password (they can reset it to your roll number).</li>
            <li>
              Sign in with the temporary password, then complete the mandatory password change.
            </li>
          </ol>
          <p className="pt-2 text-xs text-muted-foreground">
            Email and mobile OTP reset will be available in a future release once a verified email
            or phone number is on your profile.
          </p>
        </div>

        <Button asChild className="mt-6 w-full">
          <Link href="/login">Return to login</Link>
        </Button>
      </div>
    </main>
  );
}
