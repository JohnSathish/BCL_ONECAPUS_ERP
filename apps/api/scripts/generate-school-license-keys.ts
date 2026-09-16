import { generateSchoolLicenseKeypair } from '../src/modules/school-sis/school-sis-license.crypto';

const keys = generateSchoolLicenseKeypair();
process.stdout.write(
  [
    '# Add these to the license-server environment. Never commit LICENSE_PRIVATE_KEY.',
    `LICENSE_PUBLIC_KEY=${keys.publicKeyB64}`,
    `LICENSE_PRIVATE_KEY=${keys.privateKeyB64}`,
    '',
  ].join('\n'),
);
