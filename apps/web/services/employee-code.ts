import { api } from '@/services/api';

export type EmployeeCodePreview = {
  employeeCode: string;
  fullPrefix: string;
  typeSuffix: string;
  orgPrefix: string;
  yearSuffix: string;
  sequence: number;
  joiningYear: number;
  staffType: string;
};

export async function previewEmployeeCode(input: {
  staffType: string;
  joiningDate?: string;
  institutionId?: string;
}): Promise<EmployeeCodePreview> {
  const { data } = await api.post<EmployeeCodePreview>('/v1/staff/generate-employee-code', {
    ...input,
    preview: true,
  });
  return data;
}
