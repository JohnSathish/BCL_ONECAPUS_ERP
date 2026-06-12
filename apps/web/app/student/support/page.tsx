'use client';

import { useState } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportPage() {
  useRequireAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <DashboardShell role="student" title="Support Ticket">
      <ErpWorkspace className="max-w-xl">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Raise a Support Request</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe your issue — portal access, fees, registration, ID card, or certificates. The
            office will respond through your registered email.
          </p>
          {submitted ? (
            <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
              Your request has been noted. Full ticketing integration with the helpdesk module is
              coming soon — for urgent matters, visit the student office.
            </p>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. RFID not working"
                  required
                />
              </div>
              <div>
                <Label>Message</Label>
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm">
                Submit Ticket
              </Button>
            </form>
          )}
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
