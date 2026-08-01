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

/**
 * Library revision sync — never wipe front/back elements.
 * Tenant/designer edits stay; only meta.layoutRevision can catch up for bookkeeping.
 * Use gallery "reset to library" (or re-seed) when a deliberate seed refresh is needed.
 */
function upgradeBuiltinLibraryLayout(stored: IdCardLayoutV1): IdCardLayoutV1 {
  const code = libraryCodeFromLayout(stored) ?? stored.meta?.libraryCode;
  if (!code) return stored;
  const latest = getBuiltinTemplateLayout(code);
  if (!latest) return stored;

  if (stored.meta?.customized === true) return stored;

  const storedRev = stored.meta?.layoutRevision ?? 0;
  const latestRev = latest.meta?.layoutRevision ?? 0;
  if (storedRev >= latestRev) return stored;

  return {
    ...stored,
    meta: {
      ...latest.meta,
      ...stored.meta,
      libraryCode: code,
      layoutRevision: latestRev,
    },
    frontBackground: stored.frontBackground ?? latest.frontBackground ?? null,
    backBackground: stored.backBackground ?? latest.backBackground ?? null,
    // Keep stored elements — silent wipe was breaking production cards.
    front: stored.front,
    back: stored.back,
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
