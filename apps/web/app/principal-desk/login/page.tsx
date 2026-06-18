'use client';

import { LoginForm } from '@/components/auth/login-form';

export default function PrincipalDeskLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <LoginForm postLoginPath="/principal-desk" hardRedirect />
    </div>
  );
}
