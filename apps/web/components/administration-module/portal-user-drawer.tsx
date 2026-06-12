'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { PortalUserRow } from '@/types/administration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGlassCard } from './ui/admin-shell';

type Props = {
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  user: PortalUserRow | null;
  roles: { slug: string; name: string }[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  loading?: boolean;
};

export function PortalUserDrawer({ open, mode, user, roles, onClose, onSubmit, loading }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmail(user?.email ?? '');
    setDisplayName(user?.displayName ?? user?.name ?? '');
    setPhone(user?.mobile ?? '');
    setUsername(user?.username ?? '');
    setRoleSlugs(user?.roles.map((r) => r.slug) ?? []);
    setPassword('');
  }, [open, user]);

  if (!open) return null;

  const readOnly = mode === 'view';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l bg-background p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Add portal user' : mode === 'edit' ? 'Edit user' : 'User details'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <AdminGlassCard className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={readOnly || mode === 'edit'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <select
              multiple
              className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={roleSlugs}
              disabled={readOnly}
              onChange={(e) => setRoleSlugs(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {mode === 'create' ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
          ) : null}
        </AdminGlassCard>

        {!readOnly ? (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={loading}
              onClick={() =>
                onSubmit({
                  email,
                  displayName,
                  phone,
                  username: username || undefined,
                  roleSlugs,
                  ...(password ? { password } : {}),
                })
              }
            >
              {mode === 'create' ? 'Create user' : 'Save changes'}
            </Button>
          </div>
        ) : null}
      </motion.aside>
    </>
  );
}
