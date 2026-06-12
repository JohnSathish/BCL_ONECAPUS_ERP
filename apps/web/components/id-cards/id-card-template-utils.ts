import type { IdCardTemplate } from '@/services/id-cards';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import { libraryCodeFromLayout } from './builtin-template-library';

export function isLayoutV1(layout: unknown): layout is IdCardLayoutV1 {
  return (
    typeof layout === 'object' &&
    layout !== null &&
    'version' in layout &&
    (layout as IdCardLayoutV1).version === 1 &&
    Array.isArray((layout as IdCardLayoutV1).front)
  );
}

export function pickDefaultTemplate(
  templates: IdCardTemplate[] | undefined,
  holderType: string,
  preferredLibraryCode?: string,
): IdCardTemplate | undefined {
  if (!templates?.length) return undefined;
  const forType = templates.filter((t) => t.holderType === holderType);
  return (
    forType.find((t) => t.isDefault && isLayoutV1(t.layout)) ??
    forType.find((t) => t.isDefault) ??
    (preferredLibraryCode
      ? forType.find(
          (t) =>
            t.code === preferredLibraryCode ||
            libraryCodeFromLayout(t.layout) === preferredLibraryCode,
        )
      : undefined) ??
    forType.find((t) => isLayoutV1(t.layout)) ??
    forType[0]
  );
}

export function tenantNeedsGallerySetup(templates: IdCardTemplate[] | undefined): boolean {
  const studentDefault = templates?.find((t) => t.holderType === 'STUDENT' && t.isDefault);
  if (!studentDefault) return true;
  return !isLayoutV1(studentDefault.layout);
}
