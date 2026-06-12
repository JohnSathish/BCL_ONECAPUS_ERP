'use client';

import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { mmToScreenPx } from './cr80-designer-constants';

const RULER_SIZE = 24;

export function DesignerRulerHorizontal({ zoom, widthPx }: { zoom: number; widthPx: number }) {
  const ticks = [];
  for (let mm = 0; mm <= CR80_WIDTH_MM; mm += 1) {
    const x = mmToScreenPx(mm, zoom);
    const major = mm % 5 === 0;
    ticks.push(
      <div
        key={mm}
        className="absolute top-0 border-l border-slate-400/50"
        style={{ left: x, height: major ? 14 : 8 }}
      >
        {major ? (
          <span className="absolute -translate-x-1/2 pt-3 text-[9px] text-slate-500">{mm}</span>
        ) : null}
      </div>,
    );
  }
  return (
    <div
      className="relative shrink-0 border-b border-slate-300 bg-slate-100 dark:bg-slate-800"
      style={{ marginLeft: RULER_SIZE, width: widthPx, height: RULER_SIZE }}
    >
      <span className="absolute right-1 top-1 text-[8px] text-slate-400">mm</span>
      {ticks}
    </div>
  );
}

export function DesignerRulerVertical({ zoom, heightPx }: { zoom: number; heightPx: number }) {
  const ticks = [];
  for (let mm = 0; mm <= CR80_HEIGHT_MM; mm += 1) {
    const y = mmToScreenPx(mm, zoom);
    const major = mm % 5 === 0;
    ticks.push(
      <div
        key={mm}
        className="absolute left-0 border-t border-slate-400/50"
        style={{ top: y, width: major ? 14 : 8 }}
      >
        {major ? (
          <span className="absolute -translate-y-1/2 pl-3 text-[9px] text-slate-500">{mm}</span>
        ) : null}
      </div>,
    );
  }
  return (
    <div
      className="relative shrink-0 border-r border-slate-300 bg-slate-100 dark:bg-slate-800"
      style={{ width: RULER_SIZE, height: heightPx }}
    />
  );
}

export const DESIGNER_RULER_SIZE = RULER_SIZE;
