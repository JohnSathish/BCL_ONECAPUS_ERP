import { SetMetadata } from '@nestjs/common';

export const SCHOOL_LICENSE_MODULE_KEY = 'schoolLicenseModule';
export const SKIP_SCHOOL_LICENSE_KEY = 'skipSchoolLicense';

export const RequiresSchoolLicense = (moduleId: string) =>
  SetMetadata(SCHOOL_LICENSE_MODULE_KEY, moduleId);

export const SkipSchoolLicense = () =>
  SetMetadata(SKIP_SCHOOL_LICENSE_KEY, true);
