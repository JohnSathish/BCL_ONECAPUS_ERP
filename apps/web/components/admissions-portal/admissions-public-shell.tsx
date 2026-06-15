'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchPortalInfo } from '@/services/admissions-portal';
import { fetchLoginContext } from '@/services/auth';
import { LoginHeroPanel } from '@/components/auth/login-hero-panel';
import { AdmissionsScheduleBanner } from './admissions-schedule-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  children: React.ReactNode;
  showHero?: boolean;
};

export function AdmissionsPublicShell({ children, showHero = true }: Props) {
  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const loginContext = useQuery({
    queryKey: ['login-context'],
    queryFn: () => fetchLoginContext(),
  });
  const branding = portalInfo.data?.branding;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1628] via-[#152a45] to-[#0f1d33]">
      {showHero ? (
        <div className="grid min-h-screen lg:grid-cols-2">
          <div className="relative hidden lg:block">
            <LoginHeroPanel context={loginContext.data} contextLoading={loginContext.isLoading} />
          </div>
          <div className="flex flex-col">
            <div className="border-b border-white/10 px-6 py-4 lg:hidden">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
                {branding?.shortName}
              </p>
              <h1 className="text-lg font-semibold text-white">{branding?.displayName}</h1>
            </div>
            <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
              {children}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <header className="mb-8 text-center text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
              {branding?.shortName}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{branding?.displayName}</h1>
            <p className="mt-2 text-slate-300">{branding?.portalSubtitle}</p>
          </header>
          <AdmissionsScheduleBanner info={portalInfo.data} className="mb-8" />
          {children}
        </div>
      )}
    </div>
  );
}

export function AdmissionsAuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md border-white/10 bg-white/95 shadow-2xl backdrop-blur dark:bg-card/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdmissionsPublicLinks() {
  return (
    <p className="mt-4 text-center text-sm text-muted-foreground">
      <Link href="/admissions-portal" className="text-primary hover:underline">
        Portal home
      </Link>
      {' · '}
      <Link href="/admissions-portal/login" className="text-primary hover:underline">
        Applicant login
      </Link>
      {' · '}
      <Link href="/admissions-portal/register" className="text-primary hover:underline">
        New registration
      </Link>
    </p>
  );
}

export function AdmissionsCtaButtons({ isOpen }: { isOpen?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {isOpen ? (
        <Button asChild size="lg">
          <Link href="/admissions-portal/register">Start Registration</Link>
        </Button>
      ) : null}
      <Button variant="outline" asChild size="lg">
        <Link href="/admissions-portal/login">Applicant Login</Link>
      </Button>
    </div>
  );
}
