export type LookupOption = { id: string; label: string };

export type LookupOptions = {
  programOptions: LookupOption[];
  batchOptions: LookupOption[];
  streamOptions: LookupOption[];
  shiftOptions: LookupOption[];
  departmentOptions: LookupOption[];
  programVersionDepartmentMap: Record<string, string>;
  categoryOptions: LookupOption[];
  religionOptions: LookupOption[];
  bloodGroupOptions: LookupOption[];
  nationalityOptions: LookupOption[];
  tribeOptions: LookupOption[];
  denominationOptions: LookupOption[];
};

export type BatchMeta = {
  id: string;
  currentSemester: number;
  programVersionId?: string | null;
};
