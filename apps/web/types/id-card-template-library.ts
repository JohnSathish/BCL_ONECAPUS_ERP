import type { IdCardLayoutV1 } from '@/types/id-card-template';

export type IdCardTemplateCategory = 'STUDENT' | 'STAFF' | 'LIBRARY' | 'VISITOR' | 'SPECIAL';

export type BuiltinIdCardTemplate = {
  code: string;
  name: string;
  description: string;
  category: IdCardTemplateCategory;
  holderType: string;
  tags: string[];
  styleLabel: string;
  colorHints: string[];
  bestFor: string[];
  layout: IdCardLayoutV1;
  comingSoon?: boolean;
};
