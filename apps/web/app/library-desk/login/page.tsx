'use client';

import { LoginForm } from '@/components/auth/login-form';

export default function LibraryDeskLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <LoginForm postLoginPath="/library-desk" hardRedirect />
    </div>
  );
}
