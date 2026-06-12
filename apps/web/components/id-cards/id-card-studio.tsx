'use client';

import { useMemo, useState } from 'react';
import { FlipHorizontal2, Loader2, Printer, SendHorizonal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { useStudentDashboard } from '@/hooks/use-student-dashboard';
import {
  fetchStudentPortalProfile,
  submitStudentIdCardPrintRequest,
} from '@/services/student-portal';
import { fetchIdCardTemplates } from '@/services/id-cards';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { IdCardModel, StudentIdCardModel } from '@/types/id-card';
import { normalizeIdCardLayout } from './layout-legacy-migrate';
import { buildStudentIdCardModel } from './build-student-id-card-model';
import { CR80_PREVIEW_SCALE } from './cr80-constants';
import { Cr80CardBack, Cr80CardFront } from './cr80-card-renderer';
import { openCr80PrintPreview } from './print-cr80-id-card';

type Props = {
  canPrint?: boolean;
  model?: IdCardModel | null;
  loading?: boolean;
  holderType?: 'STUDENT' | 'STAFF';
  title?: string;
  description?: string;
  layout?: IdCardLayoutV1 | null;
  enableStudentSelfService?: boolean;
};

export function IdCardStudio({
  canPrint = false,
  model: externalModel,
  loading: externalLoading,
  holderType = 'STUDENT',
  title,
  description,
  layout: layoutOverride,
  enableStudentSelfService = false,
}: Props) {
  const isStudentSelf = enableStudentSelfService && !externalModel && !canPrint;
  const {
    data: dashboard,
    isLoading: dashLoading,
    qrPass,
  } = useStudentDashboard({
    enabled: isStudentSelf,
  });
  const { branding, isLoading: brandLoading } = useInstitutionBranding();
  const profileQ = useQuery({
    queryKey: ['student-portal', 'profile'],
    queryFn: fetchStudentPortalProfile,
    enabled: isStudentSelf,
  });
  const templatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
    enabled: !layoutOverride,
  });
  const qc = useQueryClient();

  const [side, setSide] = useState<'front' | 'back'>('front');
  const [evolisRotateFront, setEvolisRotateFront] = useState(false);
  const [evolisRotateBack, setEvolisRotateBack] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [printing, setPrinting] = useState(false);
  const builtStudentModel = useMemo(
    () =>
      buildStudentIdCardModel({
        dashboard,
        profile: profileQ.data,
        branding: branding ?? undefined,
        qrPass,
      }),
    [dashboard, profileQ.data, branding, qrPass],
  );

  const model = externalModel ?? (isStudentSelf ? builtStudentModel : null);
  const loading =
    externalLoading ?? (isStudentSelf && (dashLoading || brandLoading || profileQ.isLoading));

  const layout = useMemo(() => {
    if (layoutOverride) return layoutOverride;
    const tpl = templatesQ.data?.find((t) => t.holderType === holderType && t.isDefault);
    return tpl ? normalizeIdCardLayout(tpl.layout, holderType) : null;
  }, [layoutOverride, templatesQ.data, holderType]);

  const requestMutation = useMutation({
    mutationFn: (payload: { requestType: 'NEW' | 'REPRINT'; note?: string }) =>
      submitStudentIdCardPrintRequest(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student-portal', 'profile'] });
      setRequestNote('');
    },
  });

  const handlePrint = async () => {
    if (!canPrint || !model || !layout) return;
    setPrinting(true);
    try {
      await openCr80PrintPreview({
        model,
        layout,
        holderType,
        purpose: 'preview',
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleEvolisExport = async () => {
    if (!canPrint || !model || !layout) return;
    setPrinting(true);
    try {
      await openCr80PrintPreview({
        model,
        layout,
        holderType,
        purpose: 'evolis',
        evolisFeed: { rotateFront180: evolisRotateFront, rotateBack180: evolisRotateBack },
      });
    } finally {
      setPrinting(false);
    }
  };
  const cardTitle =
    title ??
    (holderType === 'STAFF' ? 'Staff ID Card (CR80 Portrait)' : 'Student ID Card (CR80 Portrait)');

  if (loading) {
    return (
      <GlassCard className="animate-pulse p-8">
        <div className="mx-auto h-64 w-[180px] rounded-2xl bg-muted" />
      </GlassCard>
    );
  }

  if (!model) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-muted-foreground">Unable to load ID card data.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{cardTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {description ??
                (canPrint
                  ? 'Admin print — Evolis Primacy, YMCKO ribbon, CR80 portrait, dual-side (2 pages).'
                  : 'Preview your ID card. Submit a print request — only office staff can print physical cards.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={side === 'front' ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl"
              onClick={() => setSide('front')}
            >
              Front
            </Button>
            <Button
              type="button"
              variant={side === 'back' ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl"
              onClick={() => setSide('back')}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
            >
              <FlipHorizontal2 className="mr-2 h-4 w-4" />
              Flip
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-center overflow-auto py-2">
          <div
            className="origin-top transition-transform duration-300"
            style={{ transform: `scale(${CR80_PREVIEW_SCALE})` }}
          >
            {side === 'front' ? (
              <Cr80CardFront model={model} layout={layout} holderType={holderType} />
            ) : (
              <Cr80CardBack model={model} layout={layout} holderType={holderType} />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canPrint ? (
            <>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handlePrint()}
                disabled={printing || !layout}
              >
                {printing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {printing ? 'Generating PDF…' : 'Print Preview'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void handleEvolisExport()}
                disabled={printing || !layout}
              >
                Evolis Export PDF
              </Button>
            </>
          ) : isStudentSelf ? (
            <>
              <Button
                type="button"
                className="rounded-xl"
                disabled={requestMutation.isPending}
                onClick={() =>
                  requestMutation.mutate({ requestType: 'NEW', note: requestNote || undefined })
                }
              >
                <SendHorizonal className="mr-2 h-4 w-4" />
                {requestMutation.isPending ? 'Submitting…' : 'Request New ID Card'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={requestMutation.isPending}
                onClick={() =>
                  requestMutation.mutate({ requestType: 'REPRINT', note: requestNote || undefined })
                }
              >
                Request Reprint
              </Button>
            </>
          ) : null}
        </div>

        {isStudentSelf ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Optional note for the office
            </label>
            <textarea
              className="min-h-[60px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Lost card, damaged card, photo updated…"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
            />
            {requestMutation.isSuccess ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                Your print request has been sent to the admin office.
              </p>
            ) : null}
          </div>
        ) : null}

        {canPrint ? (
          <details className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              Evolis Primacy print settings
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Print Preview matches the designer canvas 1:1 (upright, no rotation).</li>
              <li>Card size: CR80 portrait (53.98 × 85.6 mm)</li>
              <li>Resolution: 300 DPI · Ribbon: YMCKO · Dual-side: Color / Color</li>
              <li>Orientation: Portrait — exactly 2 pages (front, then back)</li>
              <li>Evolis feed rotation (export only — does not affect preview):</li>
            </ul>
            <div className="mt-2 space-y-2 pl-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={evolisRotateFront}
                  onChange={(e) => setEvolisRotateFront(e.target.checked)}
                />
                Rotate front 180° for Primacy feed
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={evolisRotateBack}
                  onChange={(e) => setEvolisRotateBack(e.target.checked)}
                />
                Rotate back 180° for Primacy feed
              </label>
            </div>
          </details>
        ) : null}
      </GlassCard>
    </div>
  );
}
/** @deprecated Use IdCardStudio with enableStudentSelfService */
export function StudentIdCardStudio(
  props: Omit<Props, 'enableStudentSelfService' | 'holderType'> & {
    model?: StudentIdCardModel | null;
  },
) {
  return (
    <IdCardStudio
      {...props}
      holderType="STUDENT"
      enableStudentSelfService={!props.model && !props.canPrint}
    />
  );
}
