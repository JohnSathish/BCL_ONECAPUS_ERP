'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Cr80CardBack, Cr80CardFront } from '@/components/id-cards/cr80-card-renderer';
import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from '@/components/id-cards/cr80-constants';
import { MM_TO_PX, ZOOM_PRESETS } from '@/components/id-cards/cr80-designer-constants';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { IdCardModel } from '@/types/id-card';
import { cn } from '@/utils/cn';

export type ProductionViewMode = 'front' | 'back' | 'dual';

type Props = {
  model: IdCardModel;
  layout: IdCardLayoutV1 | null;
  holderType?: string;
  viewMode: ProductionViewMode;
  className?: string;
  signatureUrl?: string | null;
};

function cardShell(children: React.ReactNode, label?: string) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div className="rounded-2xl bg-gradient-to-br from-slate-200/80 to-slate-300/60 p-4 shadow-inner dark:from-slate-800/60 dark:to-slate-900/40">
        <div
          className="overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/10"
          style={{ width: `${CR80_WIDTH_MM}mm`, height: `${CR80_HEIGHT_MM}mm` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ProductionCardPreview({
  model,
  layout,
  holderType = 'STUDENT',
  viewMode,
  className,
  signatureUrl,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.5);

  const fitScreen = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const baseH = CR80_HEIGHT_MM * MM_TO_PX;
    const baseW = CR80_WIDTH_MM * MM_TO_PX;
    const pad = viewMode === 'dual' ? 48 : 32;
    const availH = host.clientHeight - pad;
    const availW = host.clientWidth - pad;
    const scaleH = availH / baseH;
    const scaleW = viewMode === 'dual' ? (availW / 2 - 16) / baseW : availW / baseW;
    setZoom(Math.min(scaleH, scaleW, 2.5));
  }, [viewMode]);

  useEffect(() => {
    fitScreen();
    const ro = new ResizeObserver(() => fitScreen());
    if (hostRef.current) ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [fitScreen, viewMode]);

  const cardProps = { model, layout, holderType, printMode: true as const, signatureUrl };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Zoom
        </span>
        {ZOOM_PRESETS.map((z) => (
          <Button
            key={z}
            type="button"
            size="sm"
            variant={Math.abs(zoom - z) < 0.01 ? 'default' : 'outline'}
            className="h-7 px-2 text-xs"
            onClick={() => setZoom(z)}
          >
            {z * 100}%
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={fitScreen}
        >
          <Maximize2 className="mr-1 h-3 w-3" /> Fit
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          CR80 {CR80_WIDTH_MM}×{CR80_HEIGHT_MM} mm · 300 DPI print
        </span>
      </div>

      <div
        ref={hostRef}
        className="flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-muted/40 via-background to-muted/20 p-6"
      >
        <div
          className="flex items-center justify-center gap-8 transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {viewMode === 'front' || viewMode === 'dual'
            ? cardShell(<Cr80CardFront {...cardProps} />, viewMode === 'dual' ? 'Front' : undefined)
            : null}
          {viewMode === 'back' || viewMode === 'dual'
            ? cardShell(<Cr80CardBack {...cardProps} />, viewMode === 'dual' ? 'Back' : undefined)
            : null}
        </div>
      </div>
    </div>
  );
}
