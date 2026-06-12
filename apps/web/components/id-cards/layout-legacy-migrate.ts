import type { IdCardLayoutInput, IdCardLayoutV1 } from '@/types/id-card-template';
import { getBuiltinTemplateLayout, libraryCodeFromLayout } from './builtin-template-library';
import { defaultLayoutForHolderType } from './default-layouts';

function isLayoutV1(layout: IdCardLayoutInput): layout is IdCardLayoutV1 {
  return (
    typeof layout === 'object' &&
    layout !== null &&
    'version' in layout &&
    (layout as IdCardLayoutV1).version === 1 &&
    Array.isArray((layout as IdCardLayoutV1).front)
  );
}

/** Keep uploaded backgrounds; always use latest element positions from the built-in library. */
function upgradeBuiltinLibraryLayout(stored: IdCardLayoutV1): IdCardLayoutV1 {
  const code = libraryCodeFromLayout(stored) ?? stored.meta?.libraryCode;
  if (!code) return stored;
  const latest = getBuiltinTemplateLayout(code);
  if (!latest) return stored;

  return {
    version: 1,
    meta: { ...latest.meta, ...stored.meta, libraryCode: code },
    frontBackground: stored.frontBackground ?? latest.frontBackground ?? null,
    backBackground: stored.backBackground ?? latest.backBackground ?? null,
    front: latest.front,
    back: latest.back,
  };
}

/** Normalize API layout JSON to v1 spatial layout. */
export function normalizeIdCardLayout(
  layout: IdCardLayoutInput | null | undefined,
  holderType = 'STUDENT',
): IdCardLayoutV1 {
  if (layout != null && isLayoutV1(layout)) {
    return upgradeBuiltinLibraryLayout(layout);
  }
  return defaultLayoutForHolderType(holderType);
}
