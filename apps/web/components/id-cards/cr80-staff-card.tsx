'use client';

import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { StaffIdCardModel } from '@/types/id-card';
import { Cr80CardBack, Cr80CardFront } from './cr80-card-renderer';
import { DEFAULT_STAFF_LAYOUT } from './default-layouts';

type FaceProps = {
  model: StaffIdCardModel;
  layout?: IdCardLayoutV1 | null;
  className?: string;
  printMode?: boolean;
};

export function Cr80StaffCardFront({ model, layout, className, printMode }: FaceProps) {
  return (
    <Cr80CardFront
      model={model}
      layout={layout ?? DEFAULT_STAFF_LAYOUT}
      holderType="STAFF"
      className={className}
      printMode={printMode}
    />
  );
}

export function Cr80StaffCardBack({ model, layout, className, printMode }: FaceProps) {
  return (
    <Cr80CardBack
      model={model}
      layout={layout ?? DEFAULT_STAFF_LAYOUT}
      holderType="STAFF"
      className={className}
      printMode={printMode}
    />
  );
}
