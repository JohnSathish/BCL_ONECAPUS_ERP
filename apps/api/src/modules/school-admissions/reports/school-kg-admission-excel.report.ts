import type {
  AdmissionApplication,
  AdmissionApplicationDocument,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  isSchoolCycleSettings,
  type SchoolCycleSettings,
} from '../school-admission.constants';
import {
  SCHOOL_CASTE_CATEGORY_POLICY,
  resolveSchoolCasteCategory,
} from '../school-admission-category';
import { schoolAddressPinCode } from '../school-address-pin';
import { schoolDocumentDisplayStatus } from '../school-document-display-status';
import { resolveApplicableSchoolCertificates } from '../school-document-requirements';
import {
  ageAsOf,
  parseDateOnly,
  TPS_KG_2027_CENSUS_DATE,
} from '../school-age-eligibility';
import {
  applySchoolErpPrintSetup,
  createSchoolErpWorkbook,
  finalizeSchoolErpWorkbook,
  writeSchoolErpDataTable,
  writeSchoolErpKeyValueTable,
  writeSchoolErpReportHeader,
  writeSchoolErpStatCards,
  type SchoolErpWorkbookResult,
} from './school-erp-excel.engine';
import type {
  SchoolErpExcelColumn,
  SchoolErpExcelMeta,
} from './school-erp-excel.theme';

type AppRow = AdmissionApplication & {
  documents: AdmissionApplicationDocument[];
  cycle: { settings: Prisma.JsonValue | null; title?: string | null } | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function yesNo(value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const n = Number(value.toString());
  return Number.isNaN(n) ? null : n;
}

function humanStatus(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft / In Progress';
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Review';
    case 'allotted':
      return 'Admission Granted';
    case 'rejected':
      return 'Not Granted';
    default:
      return status.replaceAll('_', ' ');
  }
}

function humanPayment(status: string): string {
  switch (status) {
    case 'PAID':
      return 'Fee Paid';
    case 'PENDING':
      return 'Fee Record Pending';
    case 'FAILED':
      return 'Payment Failed';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return status || 'Fee Record Pending';
  }
}

function formatAddress(parts: {
  line1?: string;
  line2?: string;
  po?: string;
  district?: string;
  state?: string;
  pin?: string;
}): string {
  return [
    parts.line1,
    parts.line2,
    parts.po,
    parts.district,
    parts.state,
    parts.pin,
  ]
    .map((p) => text(p))
    .filter(Boolean)
    .join(', ');
}

function formatAge(dobIso: string, censusDate: string): string {
  const dob = parseDateOnly(dobIso);
  const census =
    parseDateOnly(censusDate) ?? parseDateOnly(TPS_KG_2027_CENSUS_DATE);
  if (!dob || !census) return '';
  const age = ageAsOf(dob, census);
  return `${age.years}y ${age.months}m ${age.days}d`;
}

function buildCertificateInfo(
  formData: Record<string, unknown>,
  documents: AdmissionApplicationDocument[],
  settings?: SchoolCycleSettings | null,
) {
  const child = asRecord(formData.child);
  const category = resolveSchoolCasteCategory(child);
  const applicable = resolveApplicableSchoolCertificates(formData, {
    categoryCode: category?.code ?? null,
    documentRequirements: settings?.documentRequirements,
  });
  const byCode = new Map(documents.map((d) => [d.slotCode, d]));
  const required = applicable.filter((item) => item.required);
  const checklist = applicable.map((item) => {
    const uploaded = byCode.get(item.slotCode);
    const display = schoolDocumentDisplayStatus({
      uploaded: Boolean(uploaded),
      verificationStatus: uploaded?.verificationStatus,
    });
    return {
      label: item.label,
      uploaded: Boolean(uploaded),
      status: display.displayLabel,
      rawStatus: uploaded?.verificationStatus ?? 'MISSING',
    };
  });
  const uploadedLabels = checklist
    .filter((c) => c.uploaded)
    .map((c) => c.label);
  const missingLabels = checklist
    .filter((c) => !c.uploaded)
    .map((c) => c.label);
  const allVerified =
    checklist.length > 0 &&
    checklist.every((c) => c.uploaded && c.rawStatus === 'VERIFIED');
  const anyPending = checklist.some(
    (c) =>
      c.uploaded && (c.rawStatus === 'PENDING' || c.rawStatus === 'REJECTED'),
  );
  let documentStatus = 'Not started';
  if (!checklist.length) documentStatus = '—';
  else if (missingLabels.length === 0 && allVerified)
    documentStatus = 'VERIFIED';
  else if (missingLabels.length === 0 && anyPending)
    documentStatus = 'UPLOADED – VERIFICATION PENDING';
  else if (uploadedLabels.length === 0) documentStatus = 'NOT UPLOADED';
  else documentStatus = 'INCOMPLETE';

  return {
    requiredLabels: required.map((r) => r.label).join(' | '),
    uploadedLabels: uploadedLabels.join(' | '),
    missingLabels: missingLabels.join(' | '),
    statusDetail: checklist.map((c) => `${c.label}: ${c.status}`).join(' | '),
    documentStatus,
    allUploaded: checklist.length > 0 && missingLabels.length === 0,
  };
}

function mapApplicationRow(app: AppRow) {
  const formData = asRecord(app.formData);
  const child = asRecord(formData.child);
  const permanent = asRecord(formData.permanentAddress);
  const present = asRecord(formData.presentAddress);
  const father = asRecord(formData.father);
  const mother = asRecord(formData.mother);
  const sibling = asRecord(formData.sibling);
  const emergency = asRecord(formData.emergencyContact ?? formData.emergency);
  const office = asRecord(formData.office);
  const settings = isSchoolCycleSettings(app.cycle?.settings)
    ? app.cycle.settings
    : null;
  const category = resolveSchoolCasteCategory(child);
  const certs = buildCertificateInfo(formData, app.documents, settings);
  const receipt = app.documents.find((d) => d.slotCode === 'PAYMENT_RECEIPT');
  const feeAmount =
    decimalToNumber(app.amountPaid) ??
    (typeof settings?.applicationFee === 'number'
      ? settings.applicationFee
      : null);
  const census = settings?.censusDate ?? TPS_KG_2027_CENSUS_DATE;
  const dob = text(child.dateOfBirth);

  return {
    applicationNo: app.applicationNumber,
    applicationStatus: humanStatus(app.status),
    applicationStatusRaw: app.status,
    paymentStatus: humanPayment(app.paymentStatus),
    paymentStatusRaw: app.paymentStatus,
    submissionDate: app.submittedAt,
    createdAt: app.createdAt,
    lastSavedAt: app.lastSavedAt,
    loginEmail: app.email,
    parentMobile: app.phone || text(father.mobile) || text(mother.mobile),
    childFullName: text(child.fullName) || app.firstName,
    dateOfBirth: dob || null,
    age: dob ? formatAge(dob, census) : '',
    gender: text(child.gender),
    bloodGroup: text(child.bloodGroup),
    category: category?.label ?? text(child.caste),
    categoryCode: category?.code ?? '',
    community: text(child.community),
    nationality: text(child.nationality),
    lastSchool: text(child.lastSchool),
    nurseryAttended: yesNo(child.attendedNursery),
    permanentAddress: formatAddress({
      line1: text(permanent.village),
      po: text(permanent.po),
      district: text(permanent.district),
      state: text(permanent.state),
      pin: schoolAddressPinCode(permanent),
    }),
    permanentVillage: text(permanent.village),
    permanentPo: text(permanent.po),
    permanentDistrict: text(permanent.district),
    permanentState: text(permanent.state),
    permanentPin: schoolAddressPinCode(permanent),
    presentAddress: formatAddress({
      line1: text(present.landmark),
      po: text(present.po),
      district: text(present.district),
      state: text(present.state),
      pin: schoolAddressPinCode(present),
    }),
    presentLandmark: text(present.landmark),
    presentPo: text(present.po),
    presentDistrict: text(present.district),
    presentState: text(present.state),
    presentPin: schoolAddressPinCode(present),
    sameAsPermanent: yesNo(present.sameAsPermanent),
    fatherFullName: text(father.fullName),
    fatherOccupation: text(father.occupation),
    fatherTown: text(father.town),
    fatherPo: text(father.po),
    fatherDistrict: text(father.district),
    fatherState: text(father.state),
    fatherMobile: text(father.mobile),
    fatherEmail: text(father.email),
    fatherIncome: text(father.income) || text(father.annualIncome),
    motherFullName: text(mother.fullName),
    motherOccupation: text(mother.occupation),
    motherTown: text(mother.town),
    motherPo: text(mother.po),
    motherDistrict: text(mother.district),
    motherState: text(mother.state),
    motherMobile: text(mother.mobile),
    motherEmail: text(mother.email),
    motherIncome: text(mother.income) || text(mother.annualIncome),
    siblingName: text(sibling.name),
    siblingClass: text(sibling.className) || text(sibling.class),
    emergencyContactName: text(emergency.name) || text(emergency.fullName),
    emergencyContactNumber: text(emergency.phone) || text(emergency.mobile),
    emergencyContactRelation:
      text(emergency.relation) || text(emergency.relationship),
    requiredCertificates: certs.requiredLabels,
    uploadedCertificates: certs.uploadedLabels,
    missingCertificates: certs.missingLabels,
    certificateUploadStatus: certs.statusDetail,
    documentStatus: certs.documentStatus,
    paymentReceipt: schoolDocumentDisplayStatus({
      uploaded: Boolean(receipt),
      verificationStatus: receipt?.verificationStatus,
    }).displayLabel,
    paymentReference: app.paymentReference ?? '',
    feeAmount,
    paymentDate: receipt?.updatedAt ?? receipt?.createdAt ?? null,
    paymentVerification: schoolDocumentDisplayStatus({
      uploaded: Boolean(receipt),
      verificationStatus:
        receipt?.verificationStatus ??
        (app.paymentStatus === 'PAID' ? 'VERIFIED' : null),
    }).schoolVerificationLabel,
    documentVerificationStatus: app.documentVerificationStatus,
    finalSubmissionStatus: app.submittedAt ? 'Submitted' : 'Not submitted',
    remarks:
      text(office.remarks) ||
      text(office.decisionRemarks) ||
      text(asRecord(office.decision).remarks) ||
      '',
    indexNumber: text(office.indexNumber),
  };
}

const APPLICATION_COLUMNS: SchoolErpExcelColumn[] = [
  { key: 'applicationNo', header: 'Application No.', width: 16, type: 'code' },
  {
    key: 'applicationStatus',
    header: 'Application Status',
    width: 18,
    type: 'status',
  },
  { key: 'paymentStatus', header: 'Payment Status', width: 16, type: 'status' },
  {
    key: 'submissionDate',
    header: 'Submission Date',
    width: 18,
    type: 'datetime',
  },
  {
    key: 'loginEmail',
    header: 'Login Email',
    width: 28,
    type: 'text',
    wrap: true,
  },
  { key: 'parentMobile', header: 'Parent Mobile', width: 14, type: 'phone' },
  { key: 'childFullName', header: 'Child Full Name', width: 22, type: 'text' },
  { key: 'dateOfBirth', header: 'Date of Birth', width: 14, type: 'date' },
  {
    key: 'age',
    header: 'Age (as on 01-01-2027)',
    width: 16,
    type: 'text',
    align: 'center',
  },
  { key: 'gender', header: 'Gender', width: 10, type: 'text', align: 'center' },
  {
    key: 'bloodGroup',
    header: 'Blood Group',
    width: 12,
    type: 'text',
    align: 'center',
  },
  { key: 'category', header: 'Caste / Category', width: 22, type: 'text' },
  { key: 'community', header: 'Community / Tribe', width: 16, type: 'text' },
  { key: 'nationality', header: 'Nationality', width: 12, type: 'text' },
  {
    key: 'lastSchool',
    header: 'Last School Attended',
    width: 22,
    type: 'text',
    wrap: true,
  },
  {
    key: 'nurseryAttended',
    header: 'Nursery Attended',
    width: 14,
    type: 'boolean',
  },
  {
    key: 'permanentAddress',
    header: 'Permanent Address',
    width: 36,
    type: 'text',
    wrap: true,
  },
  {
    key: 'permanentVillage',
    header: 'Permanent Village / Locality',
    width: 18,
    type: 'text',
  },
  { key: 'permanentPo', header: 'Permanent P.O.', width: 14, type: 'text' },
  {
    key: 'permanentDistrict',
    header: 'Permanent District',
    width: 16,
    type: 'text',
  },
  { key: 'permanentState', header: 'Permanent State', width: 16, type: 'text' },
  {
    key: 'permanentPin',
    header: 'Permanent PIN Code',
    width: 14,
    type: 'code',
  },
  {
    key: 'presentAddress',
    header: 'Present Address',
    width: 36,
    type: 'text',
    wrap: true,
  },
  {
    key: 'presentLandmark',
    header: 'Present Landmark',
    width: 18,
    type: 'text',
  },
  { key: 'presentPo', header: 'Present P.O.', width: 14, type: 'text' },
  {
    key: 'presentDistrict',
    header: 'Present District',
    width: 16,
    type: 'text',
  },
  { key: 'presentState', header: 'Present State', width: 16, type: 'text' },
  { key: 'presentPin', header: 'Present PIN Code', width: 14, type: 'code' },
  {
    key: 'sameAsPermanent',
    header: 'Same as Permanent Address',
    width: 16,
    type: 'boolean',
  },
  {
    key: 'fatherFullName',
    header: "Father's Full Name",
    width: 22,
    type: 'text',
  },
  {
    key: 'fatherOccupation',
    header: "Father's Occupation",
    width: 18,
    type: 'text',
    wrap: true,
  },
  { key: 'fatherTown', header: "Father's Town", width: 14, type: 'text' },
  { key: 'fatherPo', header: "Father's P.O.", width: 12, type: 'text' },
  {
    key: 'fatherDistrict',
    header: "Father's District",
    width: 14,
    type: 'text',
  },
  { key: 'fatherState', header: "Father's State", width: 14, type: 'text' },
  { key: 'fatherMobile', header: "Father's Mobile", width: 14, type: 'phone' },
  { key: 'fatherEmail', header: "Father's Email", width: 24, type: 'text' },
  { key: 'fatherIncome', header: "Father's Income", width: 14, type: 'text' },
  {
    key: 'motherFullName',
    header: "Mother's Full Name",
    width: 22,
    type: 'text',
  },
  {
    key: 'motherOccupation',
    header: "Mother's Occupation",
    width: 18,
    type: 'text',
    wrap: true,
  },
  { key: 'motherTown', header: "Mother's Town", width: 14, type: 'text' },
  { key: 'motherPo', header: "Mother's P.O.", width: 12, type: 'text' },
  {
    key: 'motherDistrict',
    header: "Mother's District",
    width: 14,
    type: 'text',
  },
  { key: 'motherState', header: "Mother's State", width: 14, type: 'text' },
  { key: 'motherMobile', header: "Mother's Mobile", width: 14, type: 'phone' },
  { key: 'motherEmail', header: "Mother's Email", width: 24, type: 'text' },
  { key: 'motherIncome', header: "Mother's Income", width: 14, type: 'text' },
  {
    key: 'siblingName',
    header: 'Sibling Name (in this school)',
    width: 20,
    type: 'text',
  },
  { key: 'siblingClass', header: 'Sibling Class', width: 12, type: 'text' },
  {
    key: 'emergencyContactName',
    header: 'Emergency Contact Name',
    width: 20,
    type: 'text',
  },
  {
    key: 'emergencyContactNumber',
    header: 'Emergency Contact Number',
    width: 16,
    type: 'phone',
  },
  {
    key: 'emergencyContactRelation',
    header: 'Emergency Contact Relation',
    width: 16,
    type: 'text',
  },
  {
    key: 'documentStatus',
    header: 'Document Status',
    width: 22,
    type: 'status',
  },
  {
    key: 'requiredCertificates',
    header: 'Required Certificates',
    width: 28,
    type: 'text',
    wrap: true,
  },
  {
    key: 'certificateUploadStatus',
    header: 'Certificate Upload Status',
    width: 32,
    type: 'text',
    wrap: true,
  },
  {
    key: 'paymentReceipt',
    header: 'Payment Receipt',
    width: 14,
    type: 'status',
  },
  {
    key: 'paymentReference',
    header: 'Payment Reference / Transaction ID',
    width: 24,
    type: 'code',
  },
  { key: 'feeAmount', header: 'Fee Amount (₹)', width: 12, type: 'currency' },
  {
    key: 'finalSubmissionStatus',
    header: 'Final Submission Status',
    width: 16,
    type: 'status',
  },
  { key: 'indexNumber', header: 'Index Number', width: 14, type: 'code' },
  { key: 'remarks', header: 'Remarks', width: 28, type: 'text', wrap: true },
];

const PAYMENT_COLUMNS: SchoolErpExcelColumn[] = [
  { key: 'applicationNo', header: 'Application No.', width: 16, type: 'code' },
  { key: 'childFullName', header: 'Child Name', width: 22, type: 'text' },
  { key: 'paymentStatus', header: 'Payment Status', width: 16, type: 'status' },
  { key: 'feeAmount', header: 'Fee Amount (₹)', width: 14, type: 'currency' },
  {
    key: 'paymentReference',
    header: 'Payment Reference / Transaction ID',
    width: 24,
    type: 'code',
  },
  {
    key: 'paymentReceipt',
    header: 'Receipt Uploaded',
    width: 16,
    type: 'status',
  },
  {
    key: 'paymentDate',
    header: 'Payment / Upload Date',
    width: 18,
    type: 'datetime',
  },
  {
    key: 'paymentVerification',
    header: 'Verification Status',
    width: 16,
    type: 'status',
  },
  { key: 'loginEmail', header: 'Login Email', width: 26, type: 'text' },
  { key: 'parentMobile', header: 'Parent Mobile', width: 14, type: 'phone' },
];

const DOCUMENT_COLUMNS: SchoolErpExcelColumn[] = [
  { key: 'applicationNo', header: 'Application No.', width: 16, type: 'code' },
  { key: 'childFullName', header: 'Child Name', width: 22, type: 'text' },
  { key: 'category', header: 'Caste / Category', width: 20, type: 'text' },
  { key: 'community', header: 'Community / Tribe', width: 16, type: 'text' },
  {
    key: 'requiredCertificates',
    header: 'Required Documents',
    width: 32,
    type: 'text',
    wrap: true,
  },
  {
    key: 'uploadedCertificates',
    header: 'Uploaded Documents',
    width: 32,
    type: 'text',
    wrap: true,
  },
  {
    key: 'missingCertificates',
    header: 'Missing Documents',
    width: 28,
    type: 'text',
    wrap: true,
  },
  {
    key: 'certificateUploadStatus',
    header: 'Verification Detail',
    width: 36,
    type: 'text',
    wrap: true,
  },
  {
    key: 'documentStatus',
    header: 'Verification Status',
    width: 22,
    type: 'status',
  },
  {
    key: 'paymentReceipt',
    header: 'Payment Receipt',
    width: 14,
    type: 'status',
  },
];

/**
 * Professional multi-sheet K.G. Admission 2027 Excel report for Tura Public School.
 * Built on the reusable School ERP Excel engine for future module reports.
 */
export async function buildSchoolKgAdmissionExcelReport(input: {
  applications: AppRow[];
  generatedBy?: string;
}): Promise<SchoolErpWorkbookResult> {
  const generatedAt = new Date();
  const mapped = input.applications.map(mapApplicationRow);
  const meta: SchoolErpExcelMeta = {
    schoolName: 'Tura Public School',
    schoolLocation: 'Tura',
    reportTitle: 'Admission Application Report',
    sessionLabel: 'K.G. ADMISSION – ACADEMIC SESSION 2027',
    moduleLabel: 'K.G. Admission 2027',
    generatedAt,
    generatedBy: input.generatedBy,
    filenameBase: 'Tura_Public_School_KG_Admission_2027_Report',
    printHeaderLeft: 'Tura Public School, Tura',
    printHeaderCenter: 'K.G. Admission 2027',
  };

  const workbook = createSchoolErpWorkbook(meta);

  const total = mapped.length;
  const draft = mapped.filter((r) => r.applicationStatusRaw === 'draft').length;
  const submitted = mapped.filter(
    (r) => r.applicationStatusRaw === 'submitted',
  ).length;
  const underReview = mapped.filter(
    (r) => r.applicationStatusRaw === 'under_review',
  ).length;
  const granted = mapped.filter(
    (r) => r.applicationStatusRaw === 'allotted',
  ).length;
  const notGranted = mapped.filter(
    (r) => r.applicationStatusRaw === 'rejected',
  ).length;
  const paid = mapped.filter((r) => r.paymentStatusRaw === 'PAID').length;
  const paymentPending = mapped.filter(
    (r) => r.paymentStatusRaw !== 'PAID',
  ).length;
  const docsComplete = mapped.filter(
    (r) => r.documentStatus === 'Verified',
  ).length;
  const docsMissing = mapped.filter(
    (r) => r.documentStatus === 'Missing' || r.documentStatus === 'Partial',
  ).length;

  const byCategory = SCHOOL_CASTE_CATEGORY_POLICY.map((item) => ({
    label: item.label,
    value: mapped.filter((r) => r.categoryCode === item.code).length,
  }));
  const uncategorised = mapped.filter((r) => !r.categoryCode).length;
  if (uncategorised)
    byCategory.push({ label: 'Not selected', value: uncategorised });

  const byGender = [
    {
      label: 'Male',
      value: mapped.filter((r) => /^male$/i.test(r.gender)).length,
    },
    {
      label: 'Female',
      value: mapped.filter((r) => /^female$/i.test(r.gender)).length,
    },
    {
      label: 'Other / Not specified',
      value: mapped.filter(
        (r) => r.gender && !/^(male|female)$/i.test(r.gender),
      ).length,
    },
  ];

  // —— Sheet 1: Admission Summary ——
  const summary = workbook.addWorksheet('Admission Summary');
  applySchoolErpPrintSetup(summary, meta, {
    orientation: 'portrait',
    fitToWidth: 1,
  });
  let row = await writeSchoolErpReportHeader(workbook, summary, meta, {
    mergeThroughCol: 8,
    totalApplications: total,
  });

  summary.getCell(row, 2).value = 'ADMISSION APPLICATION REPORT';
  summary.getCell(row, 2).font = {
    bold: true,
    size: 12,
    color: { argb: 'FF1B4D3E' },
  };
  row += 2;

  row = writeSchoolErpStatCards(summary, row, 2, [
    { label: 'Total Applications', value: total },
    { label: 'Draft / In Progress', value: draft },
    { label: 'Submitted', value: submitted },
    { label: 'Under Review', value: underReview },
    { label: 'Payment Pending', value: paymentPending },
    { label: 'Fee Paid', value: paid },
    { label: 'Admission Granted', value: granted },
    { label: 'Not Granted', value: notGranted },
  ]);

  row += 1;
  const afterStatus = writeSchoolErpKeyValueTable(
    summary,
    row,
    'Applications by Status',
    [
      { label: 'Draft / In Progress', value: draft },
      { label: 'Submitted', value: submitted },
      { label: 'Under Review', value: underReview },
      { label: 'Admission Granted', value: granted },
      { label: 'Not Granted', value: notGranted },
    ],
    2,
  );
  writeSchoolErpKeyValueTable(
    summary,
    row,
    'Applications by Category',
    byCategory,
    5,
  );
  const afterGender = writeSchoolErpKeyValueTable(
    summary,
    Math.max(afterStatus, row + byCategory.length + 4),
    'Applications by Gender',
    byGender,
    2,
  );
  writeSchoolErpKeyValueTable(
    summary,
    Math.max(afterStatus, row + byCategory.length + 4),
    'Applications by Payment Status',
    [
      { label: 'Fee Paid', value: paid },
      { label: 'Payment Pending', value: paymentPending },
    ],
    5,
  );
  writeSchoolErpKeyValueTable(
    summary,
    afterGender + 1,
    'Document Statistics',
    [
      { label: 'Fully verified', value: docsComplete },
      { label: 'Missing / partial', value: docsMissing },
      {
        label: 'Payment receipts uploaded',
        value: mapped.filter((r) => r.paymentReceipt === 'Uploaded').length,
      },
    ],
    2,
  );

  summary.getColumn(1).width = 3;
  summary.getColumn(2).width = 28;
  summary.getColumn(3).width = 14;
  summary.getColumn(4).width = 4;
  summary.getColumn(5).width = 28;
  summary.getColumn(6).width = 14;

  // —— Sheet 2: Applications (all) ——
  const appsSheet = workbook.addWorksheet('Applications');
  applySchoolErpPrintSetup(appsSheet, meta, { fitToPage: false });
  row = await writeSchoolErpReportHeader(workbook, appsSheet, meta, {
    mergeThroughCol: 8,
    totalApplications: total,
  });
  row = writeSchoolErpStatCards(
    appsSheet,
    row,
    1,
    [
      { label: 'Total', value: total },
      { label: 'Submitted', value: submitted },
      { label: 'Under Review', value: underReview },
      { label: 'Granted', value: granted },
      { label: 'Payment Pending', value: paymentPending },
      { label: 'Fee Paid', value: paid },
      ...byCategory
        .slice(0, 5)
        .map((c) => ({ label: c.label, value: c.value })),
    ],
    5,
  );
  writeSchoolErpDataTable(appsSheet, row, APPLICATION_COLUMNS, mapped, {
    tableName: 'KgApplicationsAll',
    freezeFirstColumn: true,
  });

  // —— Sheet 3: Submitted Applications ——
  const submittedRows = mapped.filter(
    (r) =>
      r.applicationStatusRaw === 'submitted' ||
      r.applicationStatusRaw === 'under_review' ||
      r.applicationStatusRaw === 'allotted' ||
      r.applicationStatusRaw === 'rejected' ||
      Boolean(r.submissionDate),
  );
  const submittedSheet = workbook.addWorksheet('Submitted Applications');
  applySchoolErpPrintSetup(submittedSheet, meta, { fitToPage: false });
  row = await writeSchoolErpReportHeader(workbook, submittedSheet, meta, {
    mergeThroughCol: 8,
    totalApplications: submittedRows.length,
    extraLines: [
      {
        label: 'Filter',
        value: 'Submitted and post-submission applications only',
      },
    ],
  });
  writeSchoolErpDataTable(
    submittedSheet,
    row,
    APPLICATION_COLUMNS,
    submittedRows,
    {
      tableName: 'KgApplicationsSubmitted',
      freezeFirstColumn: true,
      emptyMessage: 'No submitted applications yet.',
    },
  );

  // —— Sheet 4: Payment Report ——
  const paymentSheet = workbook.addWorksheet('Payment Report');
  applySchoolErpPrintSetup(paymentSheet, meta, { fitToWidth: 1 });
  row = await writeSchoolErpReportHeader(workbook, paymentSheet, meta, {
    mergeThroughCol: 8,
    totalApplications: total,
  });
  row = writeSchoolErpStatCards(paymentSheet, row, 1, [
    { label: 'Fee Paid', value: paid },
    { label: 'Payment Pending', value: paymentPending },
    {
      label: 'Receipts uploaded',
      value: mapped.filter((r) => r.paymentReceipt === 'Uploaded').length,
    },
  ]);
  writeSchoolErpDataTable(paymentSheet, row, PAYMENT_COLUMNS, mapped, {
    tableName: 'KgPaymentReport',
    freezeFirstColumn: true,
  });

  // —— Sheet 5: Document Status ——
  const docSheet = workbook.addWorksheet('Document Status');
  applySchoolErpPrintSetup(docSheet, meta, { fitToWidth: 1 });
  row = await writeSchoolErpReportHeader(workbook, docSheet, meta, {
    mergeThroughCol: 8,
    totalApplications: total,
  });
  writeSchoolErpDataTable(docSheet, row, DOCUMENT_COLUMNS, mapped, {
    tableName: 'KgDocumentStatus',
    freezeFirstColumn: true,
  });

  return finalizeSchoolErpWorkbook(workbook, meta);
}
