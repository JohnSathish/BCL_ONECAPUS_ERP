'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, QrCode } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  checkInFrontOfficeGatePass,
  checkOutFrontOfficeGatePass,
  fetchFrontOfficeKioskStatus,
  scanFrontOfficeKiosk,
} from '@/services/front-office';
import { apiErrorMessage } from '@/utils/api-error';

export function FrontOfficeKioskDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{
    message: string;
    pass?: {
      id: string;
      visitorName: string;
      status: string;
      passNumber: string;
      scanCode?: string;
    };
  } | null>(null);

  const status = useQuery({
    queryKey: ['front-office', 'kiosk'],
    queryFn: fetchFrontOfficeKioskStatus,
    enabled,
    refetchInterval: 15000,
  });

  const scanMut = useMutation({
    mutationFn: (autoCheckIn: boolean) => scanFrontOfficeKiosk({ code, autoCheckIn }),
    onSuccess: (data) => {
      setResult({ message: data.message, pass: data.pass });
      setCode('');
      inputRef.current?.focus();
      void qc.invalidateQueries({ queryKey: ['front-office'] });
    },
    onError: (e) => setResult({ message: apiErrorMessage(e) }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Monitor className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Visitor Kiosk Desk</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Inside campus</p>
          <p className="text-3xl font-semibold">{status.data?.visitorsInside ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Active passes</p>
          <p className="text-3xl font-semibold">{status.data?.activePasses ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Check-ins today</p>
          <p className="text-3xl font-semibold">{status.data?.checkedInToday ?? '—'}</p>
        </div>
      </div>
      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <QrCode className="h-4 w-4" /> Scan gate pass QR or enter pass / GP code
        </div>
        <Input
          ref={inputRef}
          autoFocus
          className="h-14 text-lg font-mono"
          placeholder="FO:GP:… or FO-GP-2026-0001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.trim()) scanMut.mutate(true);
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={!code.trim() || scanMut.isPending}
            onClick={() => scanMut.mutate(true)}
          >
            Scan & auto check-in/out
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!code.trim() || scanMut.isPending}
            onClick={() => scanMut.mutate(false)}
          >
            Lookup only
          </Button>
        </div>
        {result ? (
          <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium">{result.message}</p>
            {result.pass ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.pass.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await checkInFrontOfficeGatePass(result.pass!.id);
                      void qc.invalidateQueries({ queryKey: ['front-office'] });
                      setResult({ message: `${result.pass!.visitorName} checked in manually` });
                    }}
                  >
                    Check in
                  </Button>
                ) : null}
                {result.pass.status === 'CHECKED_IN' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await checkOutFrontOfficeGatePass(result.pass!.id);
                      void qc.invalidateQueries({ queryKey: ['front-office'] });
                      setResult({ message: `${result.pass!.visitorName} checked out manually` });
                    }}
                  >
                    Check out
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GatePassPrintSlip({
  pass,
  onClose,
}: {
  pass: {
    passNumber: string;
    scanCode?: string;
    visitorName: string;
    hostName?: string | null;
    hostDepartment?: string | null;
    purpose?: string | null;
    validUntil: string;
    qrImageUrl?: string;
    scanPayload?: string;
  };
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:relative print:inset-auto print:bg-transparent">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-lg print:shadow-none">
        <h2 className="text-center text-lg font-bold">Visitor Gate Pass</h2>
        <p className="text-center font-mono text-sm text-muted-foreground">{pass.passNumber}</p>
        <p className="mt-4 text-center text-xl font-semibold">{pass.visitorName}</p>
        <p className="text-center text-sm">
          Host: {pass.hostName ?? '—'} {pass.hostDepartment ? `(${pass.hostDepartment})` : ''}
        </p>
        <p className="text-center text-sm">Purpose: {pass.purpose ?? '—'}</p>
        <p className="text-center text-xs text-muted-foreground">
          Valid until {new Date(pass.validUntil).toLocaleString()}
        </p>
        {pass.qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pass.qrImageUrl} alt="Gate pass QR" className="mx-auto mt-4 h-40 w-40" />
        ) : null}
        <p className="mt-2 text-center font-mono text-xs">{pass.scanCode ?? pass.scanPayload}</p>
        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <Button onClick={() => window.print()}>Print</Button>
          {onClose ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
