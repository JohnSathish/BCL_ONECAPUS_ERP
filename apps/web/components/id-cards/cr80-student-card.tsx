'use client';

import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { StudentIdCardModel } from '@/types/id-card';
import { Cr80CardBack, Cr80CardFront } from './cr80-card-renderer';
import { DEFAULT_STUDENT_LAYOUT } from './default-layouts';

type FaceProps = {
  model: StudentIdCardModel;
  layout?: IdCardLayoutV1 | null;
  className?: string;
  printMode?: boolean;
};

export function Cr80StudentCardFront({ model, layout, className, printMode }: FaceProps) {
  return (
    <Cr80CardFront
      model={model}
      layout={layout ?? DEFAULT_STUDENT_LAYOUT}
      holderType="STUDENT"
      className={className}
      printMode={printMode}
    />
  );
}

export function Cr80StudentCardBack({ model, layout, className, printMode }: FaceProps) {
  return (
    <Cr80CardBack
      model={model}
      layout={layout ?? DEFAULT_STUDENT_LAYOUT}
      holderType="STUDENT"
      className={className}
      printMode={printMode}
    />
  );
}
