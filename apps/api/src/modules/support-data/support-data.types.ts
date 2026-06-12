export type SupportDataFieldType =
  | 'text'
  | 'code'
  | 'select'
  | 'status'
  | 'time'
  | 'number'
  | 'color'
  | 'icon';

export type SupportDataFieldDef = {
  key: string;
  label: string;
  type: SupportDataFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type SupportDataCategoryDef = {
  code: string;
  label: string;
  group: string;
  source: 'lookup' | 'dedicated';
  lookupType?: string;
  permissions: string[];
  fields: SupportDataFieldDef[];
  features: {
    search: boolean;
    reorder: boolean;
    import: boolean;
    export: boolean;
    campusScope: boolean;
  };
};

export type SupportDataRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type SupportDataListQuery = {
  q?: string;
  activeOnly?: boolean;
  campusId?: string;
  institutionId?: string;
};

export type SupportDataAdapter = {
  list(
    tenantId: string,
    query: SupportDataListQuery,
  ): Promise<SupportDataRow[]>;
  create(
    tenantId: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow>;
  update(
    tenantId: string,
    id: string,
    payload: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<SupportDataRow>;
  setStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<SupportDataRow>;
  archive(tenantId: string, id: string, actorUserId?: string): Promise<void>;
  restore(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ): Promise<SupportDataRow>;
  reorder(tenantId: string, ids: string[], actorUserId?: string): Promise<void>;
};
