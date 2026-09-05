'use client';

import {
  Activity,
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { SCHOOL_PORTAL_LOGO_SRC } from '@/lib/school-admissions-branding';
import { SCHOOL_ERP_SESSION_LABEL } from '@/lib/school-erp/nav';
import { changePassword } from '@/services/student-portal';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NOTIFICATION_PREVIEW = [
  {
    id: '1',
    title: 'Payment pending verification',
    body: 'New fee receipts are waiting in the payment queue.',
    time: 'Just now',
  },
  {
    id: '2',
    title: 'Document checklist reminder',
    body: 'Verify Mother’s ST / Father’s SC-OBC certificates for ST and OBC applicants.',
    time: 'Today',
  },
  {
    id: '3',
    title: 'Admission window',
    body: 'Check Admission Settings for the K.G. 2027 closing date.',
    time: 'Today',
  },
];

const MESSAGE_PREVIEW = [
  {
    id: '1',
    title: 'Parent support',
    body: 'Communications inbox will open here when the module is activated.',
    time: 'Soon',
  },
  {
    id: '2',
    title: 'School office',
    body: 'Internal messages between staff will appear in this panel.',
    time: 'Soon',
  },
];

type PanelId = 'notifications' | 'messages' | 'profile' | 'mobileSearch' | null;

export function SchoolErpTopbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const user = useAuthStore((s) => s.session?.user);
  const display = user?.displayName?.trim() || user?.email?.split('@')[0] || 'TPS Admin';

  const unreadNotifications = 5;
  const unreadMessages = 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.matchMedia('(max-width: 639px)').matches) {
          setOpenPanel('mobileSearch');
          window.setTimeout(() => mobileInputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') setOpenPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenPanel(null);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const runSearch = (raw: string) => {
    const q = raw.trim();
    setOpenPanel(null);
    router.push(
      q ? `/admin/school-admissions?search=${encodeURIComponent(q)}` : '/admin/school-admissions',
    );
  };

  const toggle = (id: PanelId) => {
    setOpenPanel((prev) => (prev === id ? null : id));
  };

  const logout = () => {
    setOpenPanel(null);
    logoutClientSide(router, { redirectTo: '/login' });
  };

  const openChangePassword = () => {
    setOpenPanel(null);
    setPasswordError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordOpen(true);
  };

  const submitChangePassword = async () => {
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordOpen(false);
      logoutClientSide(router, { redirectTo: '/login' });
    } catch (err) {
      setPasswordError(apiErrorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <header ref={barRef} className="school-erp-topbar">
        <div className="school-erp-topbar-inner">
          {/* LEFT — branding */}
          <div className="school-erp-topbar-left">
            <button
              type="button"
              className="school-erp-icon-btn lg:hidden"
              onClick={onMenu}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="school-erp-topbar-brand">
              <img
                src={SCHOOL_PORTAL_LOGO_SRC}
                alt="Tura Public School"
                width={40}
                height={48}
                className="h-10 w-auto shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-[var(--school-erp-primary)]">
                  Tura Public School, Tura
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-snug text-[var(--school-erp-muted)]">
                  Discipline · Knowledge · Service · {SCHOOL_ERP_SESSION_LABEL}
                </p>
              </div>
            </div>
          </div>

          {/* CENTER — search */}
          <div className="school-erp-topbar-center">
            <div className="school-erp-topbar-search">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                className="school-erp-topbar-search-input"
                placeholder="Search students, applications, staff…"
                aria-label="Global search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch((e.target as HTMLInputElement).value);
                }}
              />
              <kbd className="school-erp-topbar-kbd">Ctrl + K</kbd>
            </div>
          </div>

          {/* RIGHT — actions */}
          <div className="school-erp-topbar-right">
            <button
              type="button"
              className="school-erp-icon-btn sm:hidden"
              aria-label="Search"
              title="Search"
              onClick={() => {
                toggle('mobileSearch');
                window.setTimeout(() => mobileInputRef.current?.focus(), 50);
              }}
            >
              <Search className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                className={cn('school-erp-icon-btn', openPanel === 'notifications' && 'is-active')}
                aria-label="Notifications"
                aria-expanded={openPanel === 'notifications'}
                onClick={() => toggle('notifications')}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 ? (
                  <span className="school-erp-badge school-erp-badge-accent">
                    {unreadNotifications}
                  </span>
                ) : null}
              </button>
              {openPanel === 'notifications' ? (
                <div className="school-erp-topbar-panel" role="dialog" aria-label="Notifications">
                  <div className="school-erp-topbar-panel-head">
                    <p className="text-sm font-semibold text-[var(--school-erp-primary)]">
                      Notifications
                    </p>
                    <span className="text-[11px] text-[var(--school-erp-muted)]">
                      {unreadNotifications} unread
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {NOTIFICATION_PREVIEW.map((item) => (
                      <li key={item.id} className="px-3 py-2.5 hover:bg-[#f7faf8]">
                        <p className="text-sm font-medium text-slate-800">{item.title}</p>
                        <p className="mt-0.5 text-xs text-[var(--school-erp-muted)]">{item.body}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{item.time}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t px-3 py-2 text-center text-[11px] text-[var(--school-erp-muted)]">
                    Full notifications centre — Coming Soon
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                className={cn('school-erp-icon-btn', openPanel === 'messages' && 'is-active')}
                aria-label="Messages"
                aria-expanded={openPanel === 'messages'}
                onClick={() => toggle('messages')}
              >
                <Mail className="h-4 w-4" />
                {unreadMessages > 0 ? (
                  <span className="school-erp-badge school-erp-badge-primary">
                    {unreadMessages}
                  </span>
                ) : null}
              </button>
              {openPanel === 'messages' ? (
                <div className="school-erp-topbar-panel" role="dialog" aria-label="Messages">
                  <div className="school-erp-topbar-panel-head">
                    <p className="text-sm font-semibold text-[var(--school-erp-primary)]">
                      Messages
                    </p>
                    <span className="text-[11px] text-[var(--school-erp-muted)]">
                      {unreadMessages} unread
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {MESSAGE_PREVIEW.map((item) => (
                      <li key={item.id} className="px-3 py-2.5 hover:bg-[#f7faf8]">
                        <p className="text-sm font-medium text-slate-800">{item.title}</p>
                        <p className="mt-0.5 text-xs text-[var(--school-erp-muted)]">{item.body}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{item.time}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t px-3 py-2 text-center text-[11px] text-[var(--school-erp-muted)]">
                    Communications module — Coming Soon
                  </p>
                </div>
              ) : null}
            </div>

            <span className="school-erp-topbar-divider hidden sm:block" aria-hidden />

            <div className="relative">
              <button
                type="button"
                className={cn('school-erp-profile-btn', openPanel === 'profile' && 'is-active')}
                aria-label="Account menu"
                aria-expanded={openPanel === 'profile'}
                onClick={() => toggle('profile')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf5ee] text-[var(--school-erp-primary)]">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="hidden min-w-0 text-left md:block">
                  <span className="block max-w-[8.5rem] truncate text-xs font-semibold text-slate-800">
                    {display}
                  </span>
                  <span className="block text-[10px] text-slate-500">Administrator</span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 md:block" />
              </button>
              {openPanel === 'profile' ? (
                <div className="school-erp-topbar-panel school-erp-topbar-panel-narrow" role="menu">
                  <div className="border-b px-3 py-2.5 md:hidden">
                    <p className="text-sm font-semibold text-slate-800">{display}</p>
                    <p className="text-[11px] text-slate-500">Administrator</p>
                  </div>
                  <button type="button" className="school-erp-menu-item" role="menuitem" disabled>
                    <UserRound className="h-4 w-4" />
                    My Profile
                    <span className="ml-auto text-[10px] text-slate-400">Soon</span>
                  </button>
                  <button
                    type="button"
                    className="school-erp-menu-item"
                    role="menuitem"
                    onClick={openChangePassword}
                  >
                    <KeyRound className="h-4 w-4" />
                    Change password
                  </button>
                  <button type="button" className="school-erp-menu-item" role="menuitem" disabled>
                    <Settings className="h-4 w-4" />
                    Account Settings
                    <span className="ml-auto text-[10px] text-slate-400">Soon</span>
                  </button>
                  <button type="button" className="school-erp-menu-item" role="menuitem" disabled>
                    <Activity className="h-4 w-4" />
                    Activity Log
                    <span className="ml-auto text-[10px] text-slate-400">Soon</span>
                  </button>
                  <button
                    type="button"
                    className="school-erp-menu-item school-erp-menu-item-danger sm:hidden"
                    role="menuitem"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="school-erp-logout-btn hidden sm:inline-flex"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>

        {openPanel === 'mobileSearch' ? (
          <div className="school-erp-mobile-search sm:hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={mobileInputRef}
                type="search"
                className="school-erp-topbar-search-input pl-9"
                placeholder="Search applications…"
                aria-label="Mobile search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch((e.target as HTMLInputElement).value);
                }}
              />
            </div>
            <button
              type="button"
              className="school-erp-icon-btn"
              aria-label="Close search"
              onClick={() => setOpenPanel(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </header>

      {passwordOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tps-change-password-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="tps-change-password-title"
                  className="text-base font-semibold text-[var(--school-erp-primary)]"
                >
                  Change password
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  After saving you will be signed out and must log in again.
                </p>
              </div>
              <button
                type="button"
                className="school-erp-icon-btn"
                aria-label="Close"
                onClick={() => setPasswordOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="tps-current-password">Current password</Label>
                <Input
                  id="tps-current-password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tps-new-password">New password</Label>
                <Input
                  id="tps-new-password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tps-confirm-password">Confirm new password</Label>
                <Input
                  id="tps-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordOpen(false)}
                  disabled={passwordBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitChangePassword()}
                  disabled={passwordBusy || !currentPassword || !newPassword}
                >
                  {passwordBusy ? 'Saving…' : 'Update password'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
