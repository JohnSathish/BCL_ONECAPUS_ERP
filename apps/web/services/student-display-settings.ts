import { api } from '@/services/api';
import type { StudentNameDisplayFormat } from '@/utils/student-name-format';

export type StudentDisplaySettings = {
  nameDisplayFormat: StudentNameDisplayFormat;
};

export async function fetchStudentDisplaySettings(): Promise<StudentDisplaySettings> {
  const { data } = await api.get('/v1/settings/student-display');
  return data;
}

export async function updateStudentDisplaySettings(payload: {
  nameDisplayFormat: StudentNameDisplayFormat;
}): Promise<StudentDisplaySettings> {
  const { data } = await api.patch('/v1/settings/student-display', payload);
  return data;
}
