'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  count: number;
  onClear: () => void;
  onActivate: () => void;
  onResetPasswords: () => void;
  onSendCredentials: () => void;
  busy?: boolean;
};

export function PortalUsersBulkBar({
  count,
  onClear,
  onActivate,
  onResetPasswords,
  onSendCredentials,
  busy,
}: Props) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="glass-card flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">{count} selected</span>
            <Button size="sm" variant="secondary" onClick={onActivate} disabled={busy}>
              <ShieldCheck className="mr-1 h-4 w-4" /> Activate
            </Button>
            <Button size="sm" variant="secondary" onClick={onResetPasswords} disabled={busy}>
              <KeyRound className="mr-1 h-4 w-4" /> Reset passwords
            </Button>
            <Button size="sm" variant="secondary" onClick={onSendCredentials} disabled={busy}>
              <Mail className="mr-1 h-4 w-4" /> Send credentials
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
