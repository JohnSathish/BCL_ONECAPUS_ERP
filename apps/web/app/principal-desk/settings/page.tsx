'use client';

import Link from 'next/link';
import { Mail, Settings as SettingsIcon, Shield } from 'lucide-react';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { useAuth } from '@/hooks/use-auth';

const LINKS = [
  {
    href: '/principal-desk/communication-hub/settings',
    label: 'Mail & mailbox accounts',
    description: 'Connect Google accounts, sync, and disconnect',
    icon: Mail,
    permission: 'principal-comms:access' as const,
  },
  {
    href: '/principal-desk/communication-hub',
    label: 'Open Mail',
    description: 'Inbox, compose, and account switcher',
    icon: Mail,
    permission: 'principal-comms:access' as const,
  },
  {
    href: '/admin/profile',
    label: 'Profile & security',
    description: 'Password and account preferences',
    icon: Shield,
  },
];

export default function PrincipalSettingsPage() {
  const { session } = useAuth();
  const permissions = session?.user?.permissions ?? [];

  const visible = LINKS.filter(
    (link) => !('permission' in link && link.permission) || permissions.includes(link.permission!),
  );

  return (
    <PrincipalDeskShell
      title="Settings"
      subtitle="Principal workspace preferences and integrations"
    >
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Configure Mail connectivity and account access for the Principal Command Center.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-border dark:bg-card"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <span>
                  <span className="block font-semibold text-slate-900 dark:text-foreground">
                    {link.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{link.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PrincipalDeskShell>
  );
}
