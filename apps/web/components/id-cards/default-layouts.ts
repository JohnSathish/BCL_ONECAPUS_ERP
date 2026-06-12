import type { IdCardLayoutV1 } from '@/types/id-card-template';
import {
  CORPORATE_PROFESSIONAL_LAYOUT,
  DBC_PURSUIT_EXCELLENCE_LAYOUT,
  DBC_PURSUIT_STAFF_LAYOUT,
} from './builtin-template-library';

/** Official DBC Pursuit of Excellence student layout */
export const DEFAULT_STUDENT_LAYOUT: IdCardLayoutV1 = DBC_PURSUIT_EXCELLENCE_LAYOUT;

export const DEFAULT_STAFF_LAYOUT: IdCardLayoutV1 = DBC_PURSUIT_STAFF_LAYOUT;

export function defaultLayoutForHolderType(holderType: string): IdCardLayoutV1 {
  if (
    holderType === 'STAFF' ||
    holderType === 'CONTRACT' ||
    holderType === 'VISITING' ||
    holderType === 'RESEARCH'
  ) {
    return DEFAULT_STAFF_LAYOUT;
  }
  return DEFAULT_STUDENT_LAYOUT;
}

export { layoutEl } from './id-card-layout-utils';
