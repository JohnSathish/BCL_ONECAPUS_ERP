import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  defaultNehuTemplateLines,
  NEHU_FYUGP_DEFAULT_TEMPLATE_NAME,
  DEFAULT_NEHU_TOTAL_SEMESTERS,
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_SEMESTER_CREDIT_TARGET,
} from '../src/modules/academic-engine/domain/fyugp-templates';
import { seedDbcFyugpRules } from './seed-dbc-fyugp-rules';
import { seedArtsFyugpCatalog } from './seed-arts-fyugp-catalog';
import { seedArtsOddTimetable } from './seed-arts-odd-timetable';
import { seedArtsShiftIiTimetable } from './seed-arts-shift-ii-timetable';
import { seedDemoLiveReady } from './seed-demo-live-ready';
import { seedDonBoscoFeeCycles } from './seeds/fee-cycle.seed';
import { seedDonBoscoMonthlyPlans } from './seeds/monthly-fee.seed';
import { seedDbcCommittees } from './seeds/seed-dbc-committees';
import { seedNaacIqac } from './seeds/seed-naac-iqac';

const prisma = new PrismaClient();

const PERMISSIONS: {
  slug: string;
  resource: string;
  action: string;
  description: string;
}[] = [
  {
    slug: 'tenant:read',
    resource: 'tenant',
    action: 'read',
    description: 'View tenant profile',
  },
  {
    slug: 'tenant:manage',
    resource: 'tenant',
    action: 'manage',
    description: 'Manage tenant settings',
  },
  {
    slug: 'users:read',
    resource: 'users',
    action: 'read',
    description: 'List users',
  },
  {
    slug: 'users:manage',
    resource: 'users',
    action: 'manage',
    description: 'Create/update users',
  },
  {
    slug: 'rbac:manage',
    resource: 'rbac',
    action: 'manage',
    description: 'Manage roles and permissions',
  },
  {
    slug: 'org:read',
    resource: 'org',
    action: 'read',
    description: 'View organization structure',
  },
  {
    slug: 'org:manage',
    resource: 'org',
    action: 'manage',
    description: 'Manage campuses and departments',
  },
  {
    slug: 'academic:read',
    resource: 'academic',
    action: 'read',
    description: 'View academic catalog',
  },
  {
    slug: 'academic:manage',
    resource: 'academic',
    action: 'manage',
    description: 'Manage programs and courses',
  },
  {
    slug: 'admissions:read',
    resource: 'admissions',
    action: 'read',
    description: 'View admissions',
  },
  {
    slug: 'admissions:manage',
    resource: 'admissions',
    action: 'manage',
    description: 'Manage admissions workflows',
  },
  {
    slug: 'admissions:configure',
    resource: 'admissions',
    action: 'configure',
    description: 'Configure admission cycles and seat matrix',
  },
  {
    slug: 'admissions:verify-documents',
    resource: 'admissions',
    action: 'verify-documents',
    description: 'Verify applicant documents',
  },
  {
    slug: 'admissions:publish-merit',
    resource: 'admissions',
    action: 'publish-merit',
    description: 'Generate and publish merit lists',
  },
  {
    slug: 'admissions:allocate',
    resource: 'admissions',
    action: 'allocate',
    description: 'Run seat allocation',
  },
  {
    slug: 'admissions:enroll',
    resource: 'admissions',
    action: 'enroll',
    description: 'Enroll selected applicants as students',
  },
  {
    slug: 'admissions:portal:self',
    resource: 'admissions',
    action: 'portal:self',
    description: 'Applicant portal self-service',
  },
  {
    slug: 'students:read',
    resource: 'students',
    action: 'read',
    description: 'View students',
  },
  {
    slug: 'students:manage',
    resource: 'students',
    action: 'manage',
    description: 'Manage students',
  },
  {
    slug: 'students:import',
    resource: 'students',
    action: 'import',
    description: 'Import students in bulk',
  },
  {
    slug: 'students:export',
    resource: 'students',
    action: 'export',
    description: 'Export student profiles',
  },
  {
    slug: 'students:manage-academic',
    resource: 'students',
    action: 'manage-academic',
    description: 'Manage student academic profile and registration',
  },
  {
    slug: 'students:verify-documents',
    resource: 'students',
    action: 'verify-documents',
    description: 'Verify student documents',
  },
  {
    slug: 'students:self-update',
    resource: 'students',
    action: 'self-update',
    description: 'Limited student self profile update',
  },
  {
    slug: 'students:bulk-update',
    resource: 'students',
    action: 'bulk-update',
    description: 'Access student bulk update module',
  },
  {
    slug: 'students:bulk-update:personal',
    resource: 'students',
    action: 'bulk-update:personal',
    description: 'Bulk update personal and family fields',
  },
  {
    slug: 'students:bulk-update:academic',
    resource: 'students',
    action: 'bulk-update:academic',
    description: 'Bulk update academic fields',
  },
  {
    slug: 'students:bulk-update:subjects',
    resource: 'students',
    action: 'bulk-update:subjects',
    description: 'Bulk update NEP subject selections',
  },
  {
    slug: 'students:bulk-update:rollback',
    resource: 'students',
    action: 'bulk-update:rollback',
    description: 'Rollback student bulk update batches',
  },
  {
    slug: 'students:photos:upload',
    resource: 'students',
    action: 'photos:upload',
    description: 'Upload student photos in bulk',
  },
  {
    slug: 'students:photos:replace',
    resource: 'students',
    action: 'photos:replace',
    description: 'Replace existing student photos in bulk',
  },
  {
    slug: 'students:photos:delete',
    resource: 'students',
    action: 'photos:delete',
    description: 'Delete student photos in bulk',
  },
  {
    slug: 'students:photos:reports',
    resource: 'students',
    action: 'photos:reports',
    description: 'Download student photo upload reports',
  },
  {
    slug: 'academic-engine:read',
    resource: 'academic-engine',
    action: 'read',
    description: 'View academic engine',
  },
  {
    slug: 'academic-engine:manage',
    resource: 'academic-engine',
    action: 'manage',
    description: 'Manage academic engine',
  },
  {
    slug: 'academic-lifecycle:read',
    resource: 'academic-lifecycle',
    action: 'read',
    description: 'View academic lifecycle and promotion',
  },
  {
    slug: 'academic-lifecycle:manage',
    resource: 'academic-lifecycle',
    action: 'manage',
    description: 'Manage semester lifecycle and promotion',
  },
  {
    slug: 'fees:read',
    resource: 'fees',
    action: 'read',
    description: 'View fees',
  },
  {
    slug: 'fees:manage',
    resource: 'fees',
    action: 'manage',
    description: 'Manage fee structures and payments',
  },
  {
    slug: 'fees:cash:collect',
    resource: 'fees',
    action: 'cash:collect',
    description: 'Collect cash fee payments at the desk',
  },
  {
    slug: 'reports:read',
    resource: 'reports',
    action: 'read',
    description: 'View reports',
  },
  {
    slug: 'communication:read',
    resource: 'communication',
    action: 'read',
    description: 'View communication hub and history',
  },
  {
    slug: 'communication:manage',
    resource: 'communication',
    action: 'manage',
    description: 'Manage templates, campaigns, and send messages',
  },
  {
    slug: 'mobile:settings:read',
    resource: 'mobile',
    action: 'settings:read',
    description: 'View mobile app control settings',
  },
  {
    slug: 'mobile:settings:manage',
    resource: 'mobile',
    action: 'settings:manage',
    description: 'Manage mobile app control settings',
  },
  {
    slug: 'notifications:read',
    resource: 'notifications',
    action: 'read',
    description: 'View in-app notifications',
  },
  {
    slug: 'certificates:read',
    resource: 'certificates',
    action: 'read',
    description: 'View certificate templates, requests, and issues',
  },
  {
    slug: 'certificates:manage',
    resource: 'certificates',
    action: 'manage',
    description: 'Manage templates, issue, revoke, and configure certificates',
  },
  {
    slug: 'certificates:approve',
    resource: 'certificates',
    action: 'approve',
    description: 'Approve certificate workflow steps',
  },
  {
    slug: 'certificates:self',
    resource: 'certificates',
    action: 'self',
    description: 'Student self-service certificate requests and downloads',
  },
  {
    slug: 'obe:read',
    resource: 'obe',
    action: 'read',
    description: 'View OBE mappings',
  },
  {
    slug: 'obe:manage',
    resource: 'obe',
    action: 'manage',
    description: 'Manage OBE and attainment',
  },
  {
    slug: 'abc:read',
    resource: 'abc',
    action: 'read',
    description: 'View ABC credits',
  },
  {
    slug: 'abc:manage',
    resource: 'abc',
    action: 'manage',
    description: 'Manage ABC transfers',
  },
  {
    slug: 'shift:read',
    resource: 'shift',
    action: 'read',
    description: 'View shifts',
  },
  {
    slug: 'shift:manage',
    resource: 'shift',
    action: 'manage',
    description: 'Manage shifts',
  },
  {
    slug: 'shift:students:read',
    resource: 'shift',
    action: 'students:read',
    description: 'View shift students',
  },
  {
    slug: 'shift:students:manage',
    resource: 'shift',
    action: 'students:manage',
    description: 'Manage shift students',
  },
  {
    slug: 'shift:timetable:manage',
    resource: 'shift',
    action: 'timetable:manage',
    description: 'Manage shift timetables',
  },
  {
    slug: 'academic:timetable:manage',
    resource: 'academic',
    action: 'timetable:manage',
    description: 'Manage academic timetables',
  },
  {
    slug: 'shift:attendance:manage',
    resource: 'shift',
    action: 'attendance:manage',
    description: 'Manage shift attendance',
  },
  {
    slug: 'shift:exams:manage',
    resource: 'shift',
    action: 'exams:manage',
    description: 'Manage shift examinations',
  },
  {
    slug: 'shift:reports:read',
    resource: 'shift',
    action: 'reports:read',
    description: 'View shift reports',
  },
  {
    slug: 'audit:read',
    resource: 'audit',
    action: 'read',
    description: 'View platform audit logs',
  },
  {
    slug: 'sessions:manage',
    resource: 'sessions',
    action: 'manage',
    description: 'Manage user sessions',
  },
  {
    slug: 'lookups:read',
    resource: 'lookups',
    action: 'read',
    description: 'View master lookups',
  },
  {
    slug: 'lookups:manage',
    resource: 'lookups',
    action: 'manage',
    description: 'Manage master lookups',
  },
  {
    slug: 'imports:manage',
    resource: 'imports',
    action: 'manage',
    description: 'Manage import/export center',
  },
  {
    slug: 'users:impersonate',
    resource: 'users',
    action: 'impersonate',
    description: 'Login as another user',
  },
  {
    slug: 'staff:read',
    resource: 'staff',
    action: 'read',
    description: 'View staff directory and profiles',
  },
  {
    slug: 'staff:manage',
    resource: 'staff',
    action: 'manage',
    description: 'Create and update staff records',
  },
  {
    slug: 'staff:assign-subjects',
    resource: 'staff',
    action: 'assign-subjects',
    description: 'Assign teaching subjects and sections',
  },
  {
    slug: 'staff:portal',
    resource: 'staff',
    action: 'portal',
    description: 'Manage staff portal accounts',
  },
  {
    slug: 'staff:export',
    resource: 'staff',
    action: 'export',
    description: 'Export staff data',
  },
  {
    slug: 'staff:import',
    resource: 'staff',
    action: 'import',
    description: 'Import staff in bulk',
  },
  {
    slug: 'staff:bulk-update',
    resource: 'staff',
    action: 'bulk-update',
    description: 'Access staff bulk update module',
  },
  {
    slug: 'staff:bulk-update:rollback',
    resource: 'staff',
    action: 'bulk-update:rollback',
    description: 'Rollback staff bulk update batches',
  },
  {
    slug: 'staff-attendance:view',
    resource: 'staff-attendance',
    action: 'view',
    description: 'View staff attendance dashboards and registers',
  },
  {
    slug: 'staff-attendance:edit',
    resource: 'staff-attendance',
    action: 'edit',
    description: 'Edit staff attendance records and settings',
  },
  {
    slug: 'staff-attendance:reports',
    resource: 'staff-attendance',
    action: 'reports',
    description: 'Export staff attendance reports',
  },
  {
    slug: 'staff-attendance:corrections:approve',
    resource: 'staff-attendance',
    action: 'corrections:approve',
    description: 'Approve staff attendance corrections',
  },
  {
    slug: 'staff-attendance:settings:view',
    resource: 'staff-attendance',
    action: 'settings:view',
    description: 'View staff attendance policy configuration',
  },
  {
    slug: 'staff-attendance:settings:edit',
    resource: 'staff-attendance',
    action: 'settings:edit',
    description: 'Edit staff attendance policy configuration',
  },
  {
    slug: 'staff-attendance:shift-admin',
    resource: 'staff-attendance',
    action: 'shift-admin',
    description:
      'Manage staff attendance shifts, groups, rosters, and assignments',
  },
  {
    slug: 'staff-attendance:leave-admin',
    resource: 'staff-attendance',
    action: 'leave-admin',
    description:
      'Manage staff attendance leave types and leave integration settings',
  },
  {
    slug: 'staff-attendance:reprocess',
    resource: 'staff-attendance',
    action: 'reprocess',
    description: 'Run attendance recalculation and reprocessing jobs',
  },
  {
    slug: 'staff-biometric:admin',
    resource: 'staff-biometric',
    action: 'admin',
    description: 'Administer staff biometric mappings and sync',
  },
  {
    slug: 'staff-biometric:device-admin',
    resource: 'staff-biometric',
    action: 'device-admin',
    description: 'Manage biometric devices and dangerous device operations',
  },
  {
    slug: 'staff-biometric:sync',
    resource: 'staff-biometric',
    action: 'sync',
    description: 'Run biometric device sync jobs',
  },
  {
    slug: 'staff:portal:self',
    resource: 'staff',
    action: 'portal:self',
    description: 'Access own staff portal profile and dashboard',
  },
  {
    slug: 'student:portal:self',
    resource: 'student',
    action: 'portal:self',
    description: 'Access own student portal profile and dashboard',
  },
  {
    slug: 'lms:read',
    resource: 'lms',
    action: 'read',
    description: 'View LMS workspaces and content',
  },
  {
    slug: 'lms:manage',
    resource: 'lms',
    action: 'manage',
    description: 'Manage LMS administration',
  },
  {
    slug: 'lms:workspace:manage',
    resource: 'lms',
    action: 'workspace:manage',
    description: 'Manage LMS workspaces',
  },
  {
    slug: 'lms:materials:upload',
    resource: 'lms',
    action: 'materials:upload',
    description: 'Upload LMS materials',
  },
  {
    slug: 'lms:materials:publish',
    resource: 'lms',
    action: 'materials:publish',
    description: 'Publish LMS materials',
  },
  {
    slug: 'lms:announcements:publish',
    resource: 'lms',
    action: 'announcements:publish',
    description: 'Publish LMS announcements',
  },
  {
    slug: 'lms:lesson-plans:manage',
    resource: 'lms',
    action: 'lesson-plans:manage',
    description: 'Manage LMS lesson plans',
  },
  {
    slug: 'lms:assignments:manage',
    resource: 'lms',
    action: 'assignments:manage',
    description: 'Manage and evaluate LMS assignments',
  },
  {
    slug: 'lms:analytics:read',
    resource: 'lms',
    action: 'analytics:read',
    description: 'View LMS analytics',
  },
  {
    slug: 'lms:settings:manage',
    resource: 'lms',
    action: 'settings:manage',
    description: 'Manage LMS settings',
  },
  {
    slug: 'question-bank:read',
    resource: 'question-bank',
    action: 'read',
    description: 'View question bank papers and dashboard',
  },
  {
    slug: 'question-bank:download',
    resource: 'question-bank',
    action: 'download',
    description: 'Download and preview published papers',
  },
  {
    slug: 'question-bank:contribute',
    resource: 'question-bank',
    action: 'contribute',
    description: 'Upload and submit question papers',
  },
  {
    slug: 'question-bank:approve',
    resource: 'question-bank',
    action: 'approve',
    description: 'Approve question paper workflow steps',
  },
  {
    slug: 'question-bank:publish',
    resource: 'question-bank',
    action: 'publish',
    description: 'Publish approved question papers',
  },
  {
    slug: 'question-bank:manage',
    resource: 'question-bank',
    action: 'manage',
    description: 'Full question bank administration and bulk import',
  },
  {
    slug: 'question-bank:reports',
    resource: 'question-bank',
    action: 'reports',
    description: 'View question bank reports and exports',
  },
  {
    slug: 'exam:view',
    resource: 'exam',
    action: 'view',
    description: 'View examination sessions and papers',
  },
  {
    slug: 'exam:create',
    resource: 'exam',
    action: 'create',
    description: 'Create examination sessions',
  },
  {
    slug: 'exam:edit',
    resource: 'exam',
    action: 'edit',
    description: 'Edit examination sessions',
  },
  {
    slug: 'exam:delete',
    resource: 'exam',
    action: 'delete',
    description: 'Archive examination sessions',
  },
  {
    slug: 'exam:admin',
    resource: 'exam',
    action: 'admin',
    description: 'Full examination administration',
  },
  {
    slug: 'exam:results',
    resource: 'exam',
    action: 'results',
    description: 'Calculate and publish examination results',
  },
  {
    slug: 'library:access-desk',
    resource: 'library',
    action: 'access-desk',
    description: 'Library access desk kiosk scan and entry/exit',
  },
  {
    slug: 'principal-desk:access',
    resource: 'principal-desk',
    action: 'access',
    description: 'Principal command center dashboard and instant lookup',
  },
  {
    slug: 'cams:read',
    resource: 'cams',
    action: 'read',
    description: 'View campus access points and live occupancy',
  },
  {
    slug: 'cams:manage',
    resource: 'cams',
    action: 'manage',
    description: 'Configure access points and kiosk devices',
  },
  {
    slug: 'cams:reports',
    resource: 'cams',
    action: 'reports',
    description: 'Campus access analytics and NAAC footfall reports',
  },
  {
    slug: 'library:read',
    resource: 'library',
    action: 'read',
    description: 'View library visits, catalogue, and own loans',
  },
  {
    slug: 'library:manage',
    resource: 'library',
    action: 'manage',
    description: 'Manage library catalogue and administration',
  },
  {
    slug: 'library:circulate',
    resource: 'library',
    action: 'circulate',
    description: 'Issue and return library books',
  },
  {
    slug: 'library:reports',
    resource: 'library',
    action: 'reports',
    description: 'View library reports and analytics',
  },
  {
    slug: 'library:settings',
    resource: 'library',
    action: 'settings',
    description: 'Configure library settings and fines',
  },
  {
    slug: 'library:digital:read',
    resource: 'library',
    action: 'digital:read',
    description: 'Browse digital library catalogue',
  },
  {
    slug: 'library:digital:download',
    resource: 'library',
    action: 'digital:download',
    description: 'Download digital library resources',
  },
  {
    slug: 'library:digital:manage',
    resource: 'library',
    action: 'digital:manage',
    description: 'Upload and manage digital library assets',
  },
  {
    slug: 'library:research:read',
    resource: 'library',
    action: 'research:read',
    description: 'Browse research repository',
  },
  {
    slug: 'library:research:submit',
    resource: 'library',
    action: 'research:submit',
    description: 'Submit research repository items',
  },
  {
    slug: 'library:research:manage',
    resource: 'library',
    action: 'research:manage',
    description: 'Approve and manage research repository',
  },
  {
    slug: 'front-office:read',
    resource: 'front-office',
    action: 'read',
    description: 'View front office enquiries, gate passes, and complaints',
  },
  {
    slug: 'front-office:desk',
    resource: 'front-office',
    action: 'desk',
    description: 'Register enquiries, issue gate passes, log complaints',
  },
  {
    slug: 'front-office:manage',
    resource: 'front-office',
    action: 'manage',
    description: 'Manage and resolve front office records',
  },
  {
    slug: 'front-office:reports',
    resource: 'front-office',
    action: 'reports',
    description: 'View front office reports',
  },
  {
    slug: 'governance:read',
    resource: 'governance',
    action: 'read',
    description: 'View committees, meetings, and governance records',
  },
  {
    slug: 'governance:manage',
    resource: 'governance',
    action: 'manage',
    description: 'Manage committees, meetings, ATR, and tasks',
  },
  {
    slug: 'governance:publish',
    resource: 'governance',
    action: 'publish',
    description: 'Publish notices, minutes, and circulars',
  },
  {
    slug: 'governance:reports',
    resource: 'governance',
    action: 'reports',
    description: 'Export governance and NAAC reports',
  },
  {
    slug: 'governance:import',
    resource: 'governance',
    action: 'import',
    description: 'Import committees from PDF',
  },
  {
    slug: 'governance:portal',
    resource: 'governance',
    action: 'portal',
    description: 'Staff committee member self-service portal',
  },
  {
    slug: 'naac-iqac:read',
    resource: 'naac-iqac',
    action: 'read',
    description: 'View NAAC & IQAC workspace, criteria, and evidence',
  },
  {
    slug: 'naac-iqac:manage',
    resource: 'naac-iqac',
    action: 'manage',
    description: 'Manage AQAR, vault, MoUs, and IQAC workflows',
  },
  {
    slug: 'naac-iqac:collect',
    resource: 'naac-iqac',
    action: 'collect',
    description: 'Submit department-wise NAAC data and achievements',
  },
  {
    slug: 'naac-iqac:publish',
    resource: 'naac-iqac',
    action: 'publish',
    description: 'Publish finalized NAAC reports and circulars',
  },
  {
    slug: 'naac-iqac:reports',
    resource: 'naac-iqac',
    action: 'reports',
    description: 'Export NAAC evidence packs and DVV reports',
  },
  {
    slug: 'naac-iqac:portal',
    resource: 'naac-iqac',
    action: 'portal',
    description: 'Staff IQAC and department coordinator self-service',
  },
  {
    slug: 'transport:read',
    resource: 'transport',
    action: 'read',
    description: 'View transport routes, vehicles, and assignments',
  },
  {
    slug: 'transport:manage',
    resource: 'transport',
    action: 'manage',
    description: 'Manage transport routes and vehicles',
  },
  {
    slug: 'transport:assign',
    resource: 'transport',
    action: 'assign',
    description: 'Assign students to transport routes',
  },
  {
    slug: 'inventory:read',
    resource: 'inventory',
    action: 'read',
    description: 'View inventory stores, items, and transactions',
  },
  {
    slug: 'inventory:manage',
    resource: 'inventory',
    action: 'manage',
    description: 'Manage stores, items, and stock receipts',
  },
  {
    slug: 'inventory:issue',
    resource: 'inventory',
    action: 'issue',
    description: 'Issue and return stock to departments',
  },
  {
    slug: 'payroll:read',
    resource: 'payroll',
    action: 'read',
    description: 'View payroll dashboard, structures, and payslips',
  },
  {
    slug: 'payroll:manage',
    resource: 'payroll',
    action: 'manage',
    description: 'Manage salary components, structures, assignments, loans',
  },
  {
    slug: 'payroll:process',
    resource: 'payroll',
    action: 'process',
    description: 'Create and calculate payroll runs',
  },
  {
    slug: 'payroll:verify',
    resource: 'payroll',
    action: 'verify',
    description: 'Verify payroll runs',
  },
  {
    slug: 'payroll:approve',
    resource: 'payroll',
    action: 'approve',
    description: 'Approve payroll runs',
  },
  {
    slug: 'payroll:publish',
    resource: 'payroll',
    action: 'publish',
    description: 'Publish payroll runs',
  },
  {
    slug: 'payroll:reports',
    resource: 'payroll',
    action: 'reports',
    description: 'View and export payroll reports',
  },
  {
    slug: 'payroll:portal:self',
    resource: 'payroll',
    action: 'portal:self',
    description: 'View own payslips, loans, and PF summary',
  },
  {
    slug: 'accommodation:read',
    resource: 'accommodation',
    action: 'read',
    description: 'View staff quarters and accommodation',
  },
  {
    slug: 'accommodation:manage',
    resource: 'accommodation',
    action: 'manage',
    description: 'Manage quarters, allotments, and charges',
  },
  {
    slug: 'accommodation:reports',
    resource: 'accommodation',
    action: 'reports',
    description: 'Export accommodation reports',
  },
  {
    slug: 'license:read',
    resource: 'license',
    action: 'read',
    description: 'View institution license status',
  },
  {
    slug: 'license:activate',
    resource: 'license',
    action: 'activate',
    description: 'Activate or renew license with a key',
  },
  {
    slug: 'platform:licenses:read',
    resource: 'platform',
    action: 'licenses:read',
    description: 'View all tenant licenses',
  },
  {
    slug: 'platform:licenses:manage',
    resource: 'platform',
    action: 'licenses:manage',
    description: 'Manage tenant licenses',
  },
  {
    slug: 'backup:read',
    resource: 'backup',
    action: 'read',
    description: 'View backup dashboard, repository, and logs',
  },
  {
    slug: 'backup:manage',
    resource: 'backup',
    action: 'manage',
    description: 'Configure schedules, run manual backups, cloud settings',
  },
  {
    slug: 'backup:download',
    resource: 'backup',
    action: 'download',
    description: 'Download backup artifacts (super-admin)',
  },
  {
    slug: 'backup:restore',
    resource: 'backup',
    action: 'restore',
    description: 'Restore from backup (super-admin)',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'Don Bosco College Tura' },
    create: {
      name: 'Don Bosco College Tura',
      slug: 'demo',
      status: 'active',
    },
  });

  await prisma.tenantDomain.upsert({
    where: { host: 'demo.localhost' },
    update: {},
    create: {
      tenantId: tenant.id,
      host: 'demo.localhost',
      verified: true,
    },
  });

  await prisma.tenantDomain.upsert({
    where: { host: 'localhost' },
    update: {},
    create: {
      tenantId: tenant.id,
      host: 'localhost',
      verified: true,
    },
  });

  await prisma.tenantDomain.upsert({
    where: { host: 'library.demo.localhost' },
    update: {},
    create: {
      tenantId: tenant.id,
      host: 'library.demo.localhost',
      verified: true,
    },
  });

  await prisma.tenantDomain.upsert({
    where: { host: 'admissions.demo.localhost' },
    update: {},
    create: {
      tenantId: tenant.id,
      host: 'admissions.demo.localhost',
      verified: true,
    },
  });

  const productionHosts = [
    'erp.donboscocollege.ac.in',
    'admissions.donboscocollege.ac.in',
    'library.donboscocollege.ac.in',
  ];
  for (const host of productionHosts) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
  }

  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {
      displayName: 'Don Bosco College Tura',
      shortName: 'DBC Tura',
      campusName: 'Tura, Meghalaya',
      portalSubtitle: 'FYUGP · AY 2026-27 · ODD Semester',
      address: 'Tura, West Garo Hills, Meghalaya – 794002',
      badges: [
        'Affiliated to NEHU, Shillong',
        'NAAC Accredited',
        'NEP 2020',
        'FYUGP',
      ],
      primaryColor: '#1e3a5f',
      accentColor: '#c8102e',
      sidebarColor: '#152a45',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Don Bosco College Tura',
      shortName: 'DBC Tura',
      campusName: 'Tura, Meghalaya',
      portalSubtitle: 'FYUGP · AY 2026-27 · ODD Semester',
      address: 'Tura, West Garo Hills, Meghalaya – 794002',
      badges: [
        'Affiliated to NEHU, Shillong',
        'NAAC Accredited',
        'NEP 2020',
        'FYUGP',
      ],
      primaryColor: '#1e3a5f',
      accentColor: '#c8102e',
      sidebarColor: '#152a45',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
    },
  });

  const existingThemeSettings = await prisma.appThemeSettings.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingThemeSettings) {
    await prisma.appThemeSettings.create({
      data: {
        tenantId: tenant.id,
        themeName: 'dbc-enterprise-blue',
        primaryColor: '#2563eb',
        accentColor: '#0ea5e9',
        sidebarBg: '#1e293b',
        sidebarText: '#e2e8f0',
        sidebarActive: '#3b82f6',
        topbarBg: '#ffffff',
        cardBg: '#ffffff',
        borderColor: '#e2e8f0',
        roundedStyle: 'xl',
        layoutJson: {
          glassEnabled: true,
          shadowIntensity: 'soft',
          cardDensity: 'comfortable',
          tableDensity: 'comfortable',
        },
      },
    });
  }

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: {
        resource: p.resource,
        action: p.action,
        description: p.description,
      },
      create: p,
    });
  }

  const allPermissions = await prisma.permission.findMany();

  const upsertRole = async (
    slug: string,
    name: string,
    permissionSlugs: string[],
  ) => {
    const role = await prisma.role.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      update: { name },
      create: {
        tenantId: tenant.id,
        slug,
        name,
        isSystem: true,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permSlug of permissionSlugs) {
      const perm = allPermissions.find((x) => x.slug === permSlug);
      if (!perm) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }

    return role;
  };

  await upsertRole(
    'college-admin',
    'College Admin',
    PERMISSIONS.map((p) => p.slug),
  );
  await upsertRole(
    'super-admin',
    'Super Admin',
    PERMISSIONS.map((p) => p.slug),
  );
  await upsertRole('institution-admin', 'Institution Admin', [
    'tenant:read',
    'tenant:manage',
    'users:read',
    'users:manage',
    'rbac:manage',
    'org:read',
    'org:manage',
    'audit:read',
    'sessions:manage',
    'lookups:read',
    'lookups:manage',
    'imports:manage',
    'users:impersonate',
    'reports:read',
    'staff:read',
    'staff:manage',
    'staff:assign-subjects',
    'staff:portal',
    'staff:export',
    'staff:import',
    'staff:bulk-update',
    'staff:bulk-update:rollback',
    'staff-attendance:view',
    'staff-attendance:edit',
    'staff-attendance:reports',
    'staff-attendance:corrections:approve',
    'staff-attendance:settings:view',
    'staff-attendance:settings:edit',
    'staff-attendance:shift-admin',
    'staff-attendance:leave-admin',
    'staff-attendance:reprocess',
    'staff-biometric:admin',
    'staff-biometric:device-admin',
    'staff-biometric:sync',
    'payroll:read',
    'payroll:manage',
    'payroll:process',
    'payroll:verify',
    'payroll:approve',
    'payroll:publish',
    'payroll:reports',
    'accommodation:read',
    'accommodation:manage',
    'accommodation:reports',
    'license:read',
    'license:activate',
    'mobile:settings:read',
    'mobile:settings:manage',
    'communication:read',
    'communication:manage',
    'backup:read',
    'backup:manage',
    'backup:download',
  ]);
  await upsertRole('academic-admin', 'Academic Admin', [
    'academic:read',
    'academic:manage',
    'academic-engine:read',
    'academic-engine:manage',
    'academic-lifecycle:read',
    'academic-lifecycle:manage',
    'students:read',
    'students:manage',
    'students:bulk-update',
    'students:bulk-update:academic',
    'students:bulk-update:subjects',
    'students:bulk-update:rollback',
    'students:photos:upload',
    'students:photos:replace',
    'students:photos:delete',
    'students:photos:reports',
    'org:read',
    'reports:read',
    'users:read',
    'certificates:read',
    'certificates:manage',
    'certificates:approve',
    'staff:read',
    'staff:manage',
    'staff:assign-subjects',
    'staff:import',
    'staff:export',
    'staff:portal',
    'staff:bulk-update',
    'staff:bulk-update:rollback',
    'staff-attendance:view',
    'staff-attendance:edit',
    'staff-attendance:reports',
    'staff-attendance:corrections:approve',
    'staff-attendance:settings:view',
    'staff-attendance:settings:edit',
    'staff-attendance:shift-admin',
    'staff-attendance:leave-admin',
    'staff-attendance:reprocess',
    'staff-biometric:admin',
    'staff-biometric:device-admin',
    'staff-biometric:sync',
    'lms:read',
    'lms:manage',
    'lms:workspace:manage',
    'lms:materials:upload',
    'lms:materials:publish',
    'lms:announcements:publish',
    'lms:lesson-plans:manage',
    'lms:assignments:manage',
    'lms:analytics:read',
    'lms:settings:manage',
    'question-bank:read',
    'question-bank:approve',
    'question-bank:publish',
    'question-bank:manage',
    'question-bank:reports',
    'exam:view',
    'exam:create',
    'exam:edit',
    'exam:delete',
    'exam:admin',
    'exam:results',
  ]);
  await upsertRole('admission-admin', 'Admission Admin', [
    'admissions:read',
    'admissions:manage',
    'admissions:configure',
    'admissions:verify-documents',
    'admissions:publish-merit',
    'admissions:allocate',
    'admissions:enroll',
    'students:read',
    'students:manage',
    'students:import',
    'students:bulk-update',
    'students:bulk-update:personal',
    'students:bulk-update:academic',
    'students:photos:upload',
    'students:photos:replace',
    'students:photos:reports',
    'users:read',
    'users:manage',
    'lookups:read',
  ]);
  await upsertRole('applicant', 'Applicant', [
    'admissions:portal:self',
    'notifications:read',
  ]);
  await upsertRole('hod', 'Head of Department', [
    'academic:read',
    'students:read',
    'students:manage-academic',
    'academic-engine:read',
    'reports:read',
    'shift:read',
    'staff:read',
    'staff:assign-subjects',
    'staff-attendance:view',
    'certificates:read',
    'certificates:approve',
    'question-bank:read',
    'question-bank:approve',
    'notifications:read',
    'lms:read',
    'lms:workspace:manage',
    'lms:materials:upload',
    'lms:materials:publish',
    'lms:announcements:publish',
    'lms:lesson-plans:manage',
    'lms:assignments:manage',
    'lms:analytics:read',
    'naac-iqac:read',
    'naac-iqac:collect',
  ]);
  await upsertRole('parent', 'Parent', ['students:read']);
  await upsertRole('hostel-warden', 'Hostel Warden', [
    'students:read',
    'reports:read',
  ]);
  await upsertRole('shift-admin', 'Shift Admin', [
    'shift:read',
    'shift:manage',
    'shift:students:read',
    'shift:students:manage',
    'shift:timetable:manage',
    'shift:attendance:manage',
    'shift:exams:manage',
    'shift:reports:read',
    'students:read',
    'academic-engine:read',
    'reports:read',
  ]);
  await upsertRole('shift-academic-coordinator', 'Shift Academic Coordinator', [
    'shift:read',
    'shift:students:read',
    'shift:students:manage',
    'academic-engine:read',
    'academic-engine:manage',
    'shift:timetable:manage',
    'academic:timetable:manage',
    'shift:reports:read',
  ]);
  await upsertRole('shift-attendance-manager', 'Shift Attendance Manager', [
    'shift:read',
    'shift:attendance:manage',
    'shift:reports:read',
    'students:read',
  ]);
  await upsertRole(
    'shift-examination-coordinator',
    'Shift Examination Coordinator',
    [
      'shift:read',
      'shift:exams:manage',
      'shift:reports:read',
      'question-bank:read',
      'question-bank:publish',
      'question-bank:manage',
      'exam:view',
      'exam:admin',
      'exam:results',
    ],
  );
  await upsertRole('faculty', 'Faculty', [
    'academic:read',
    'students:read',
    'obe:read',
    'reports:read',
    'shift:read',
    'staff:portal:self',
    'payroll:portal:self',
    'notifications:read',
    'governance:portal',
    'governance:read',
    'naac-iqac:portal',
    'naac-iqac:collect',
    'lms:read',
    'lms:materials:upload',
    'lms:materials:publish',
    'lms:announcements:publish',
    'lms:lesson-plans:manage',
    'lms:assignments:manage',
    'question-bank:contribute',
    'question-bank:read',
    'question-bank:download',
    'library:digital:read',
    'library:digital:download',
    'library:research:read',
    'library:research:submit',
  ]);
  await upsertRole('staff', 'Staff', [
    'reports:read',
    'staff:portal:self',
    'payroll:portal:self',
    'notifications:read',
  ]);
  await upsertRole('student', 'Student', [
    'academic:read',
    'academic-engine:read',
    'lms:read',
    'certificates:self',
    'notifications:read',
    'question-bank:download',
    'library:read',
    'library:digital:read',
    'library:digital:download',
    'library:research:read',
    'student:portal:self',
    'fees:read',
    'exam:view',
  ]);
  await upsertRole('accountant', 'Accounts Staff', [
    'fees:read',
    'fees:manage',
    'fees:cash:collect',
    'reports:read',
    'notifications:read',
    'payroll:read',
    'payroll:verify',
    'payroll:reports',
  ]);
  await upsertRole('librarian', 'Library Staff', [
    'library:read',
    'library:manage',
    'library:circulate',
    'library:reports',
    'library:settings',
    'library:access-desk',
    'library:digital:read',
    'library:digital:download',
    'library:digital:manage',
    'library:research:read',
    'library:research:submit',
    'library:research:manage',
    'notifications:read',
  ]);
  await upsertRole('library-operator', 'Library Operator', [
    'library:access-desk',
  ]);
  await upsertRole('front-office-desk', 'Front Office Staff', [
    'front-office:read',
    'front-office:desk',
    'front-office:reports',
    'notifications:read',
  ]);
  await upsertRole('transport-coordinator', 'Transport Manager', [
    'transport:read',
    'transport:manage',
    'transport:assign',
    'notifications:read',
  ]);
  await upsertRole('store-keeper', 'Store Keeper', [
    'inventory:read',
    'inventory:manage',
    'inventory:issue',
    'notifications:read',
  ]);
  await upsertRole('examination-cell', 'Examination Cell', [
    'exam:view',
    'exam:create',
    'exam:edit',
    'exam:admin',
    'exam:results',
    'question-bank:read',
    'question-bank:manage',
    'reports:read',
    'notifications:read',
  ]);
  await upsertRole('registrar', 'Registrar', [
    'students:read',
    'students:manage',
    'admissions:read',
    'admissions:manage',
    'certificates:read',
    'certificates:manage',
    'reports:read',
    'notifications:read',
    'naac-iqac:read',
    'naac-iqac:manage',
    'naac-iqac:reports',
  ]);
  await upsertRole('principal', 'Principal', [
    'students:read',
    'staff:read',
    'academic:read',
    'fees:read',
    'reports:read',
    'admissions:read',
    'exam:view',
    'certificates:read',
    'notifications:read',
    'payroll:read',
    'payroll:approve',
    'payroll:reports',
    'naac-iqac:read',
    'naac-iqac:reports',
    'principal-desk:access',
    'governance:read',
    'staff-attendance:leave-admin',
    'library:read',
  ]);
  await upsertRole('vice-principal', 'Vice Principal', [
    'students:read',
    'staff:read',
    'academic:read',
    'fees:read',
    'reports:read',
    'admissions:read',
    'exam:view',
    'certificates:read',
    'notifications:read',
    'payroll:read',
    'payroll:approve',
    'payroll:reports',
    'naac-iqac:read',
    'naac-iqac:reports',
    'principal-desk:access',
    'governance:read',
    'staff-attendance:leave-admin',
    'library:read',
  ]);
  await upsertRole('erp-administrator', 'ERP Administrator', [
    'users:read',
    'users:manage',
    'rbac:manage',
    'org:read',
    'org:manage',
    'audit:read',
    'sessions:manage',
    'lookups:read',
    'lookups:manage',
    'imports:manage',
    'reports:read',
    'notifications:read',
    'license:read',
    'license:activate',
    'principal-desk:access',
    'governance:read',
    'staff-attendance:leave-admin',
    'library:read',
    'students:read',
    'staff:read',
    'fees:read',
    'naac-iqac:read',
  ]);

  const adminRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, slug: 'college-admin' },
  });

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.edu' } },
    update: { passwordHash, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.edu',
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await prisma.userRole.deleteMany({
    where: { userId: adminUser.id, roleId: adminRole.id },
  });

  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  const libraryOperatorRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, slug: 'library-operator' },
  });

  const libraryOperatorUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'library-desk@demo.edu' },
    },
    update: { passwordHash, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'library-desk@demo.edu',
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await prisma.userRole.deleteMany({
    where: { userId: libraryOperatorUser.id, roleId: libraryOperatorRole.id },
  });

  await prisma.userRole.create({
    data: {
      userId: libraryOperatorUser.id,
      roleId: libraryOperatorRole.id,
    },
  });

  const principalRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, slug: 'principal' },
  });

  const principalDeskUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'principal-desk@demo.edu' },
    },
    update: { passwordHash, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'principal-desk@demo.edu',
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await prisma.userRole.deleteMany({
    where: { userId: principalDeskUser.id, roleId: principalRole.id },
  });

  await prisma.userRole.create({
    data: {
      userId: principalDeskUser.id,
      roleId: principalRole.id,
    },
  });

  async function upsertWorkspaceUser(email: string, roleSlug: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: tenant.id, slug: roleSlug },
    });
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { passwordHash, isActive: true },
      create: {
        tenantId: tenant.id,
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    await prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: role.id },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return user;
  }

  await upsertWorkspaceUser('frontoffice@demo.edu', 'front-office-desk');
  await upsertWorkspaceUser('librarian@demo.edu', 'librarian');
  await upsertWorkspaceUser('accounts@demo.edu', 'accountant');
  await upsertWorkspaceUser('transport@demo.edu', 'transport-coordinator');
  await upsertWorkspaceUser('store@demo.edu', 'store-keeper');

  await prisma.tenantSecuritySettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      minPasswordLength: 8,
      passwordHistoryCount: 5,
      forceResetOnFirstLogin: true,
      sessionTimeoutMinutes: 480,
      mfaEnforced: false,
    },
  });

  const usernameRules = [
    {
      userType: 'STUDENT',
      prefix: '',
      suffix: '',
      includeYear: true,
      zeroPadding: 3,
    },
    {
      userType: 'STAFF',
      prefix: 'EMP',
      suffix: '',
      includeYear: false,
      zeroPadding: 4,
    },
    {
      userType: 'FACULTY',
      prefix: 'FAC',
      suffix: '',
      includeYear: true,
      zeroPadding: 3,
    },
  ];
  for (const rule of usernameRules) {
    await prisma.usernameGenerationRule.upsert({
      where: {
        tenantId_userType: { tenantId: tenant.id, userType: rule.userType },
      },
      update: {},
      create: { tenantId: tenant.id, ...rule },
    });
  }

  const designationSeed: {
    code: string;
    label: string;
    category: string;
    sortOrder: number;
  }[] = [
    {
      code: 'PROFESSOR',
      label: 'Professor',
      category: 'TEACHING',
      sortOrder: 1,
    },
    {
      code: 'ASSOCIATE_PROF',
      label: 'Associate Professor',
      category: 'TEACHING',
      sortOrder: 2,
    },
    {
      code: 'ASSISTANT_PROF',
      label: 'Assistant Professor',
      category: 'TEACHING',
      sortOrder: 3,
    },
    {
      code: 'SENIOR_LECTURER',
      label: 'Senior Lecturer',
      category: 'TEACHING',
      sortOrder: 4,
    },
    { code: 'LECTURER', label: 'Lecturer', category: 'TEACHING', sortOrder: 5 },
    {
      code: 'GUEST_FACULTY',
      label: 'Guest Faculty',
      category: 'TEACHING',
      sortOrder: 6,
    },
    {
      code: 'VISITING_FACULTY',
      label: 'Visiting Faculty',
      category: 'TEACHING',
      sortOrder: 7,
    },
    {
      code: 'PRINCIPAL',
      label: 'Principal',
      category: 'TEACHING',
      sortOrder: 8,
    },
    {
      code: 'VICE_PRINCIPAL',
      label: 'Vice Principal',
      category: 'TEACHING',
      sortOrder: 9,
    },
    {
      code: 'LDA',
      label: 'LDA (Lower Division Assistant)',
      category: 'NON_TEACHING',
      sortOrder: 20,
    },
    {
      code: 'UDA',
      label: 'UDA (Upper Division Assistant)',
      category: 'NON_TEACHING',
      sortOrder: 21,
    },
    {
      code: 'GRADE_IV',
      label: 'Grade IV',
      category: 'NON_TEACHING',
      sortOrder: 22,
    },
    {
      code: 'HOUSE_KEEPING',
      label: 'House Keeping',
      category: 'NON_TEACHING',
      sortOrder: 23,
    },
    { code: 'PEON', label: 'Peon', category: 'NON_TEACHING', sortOrder: 24 },
    { code: 'CLERK', label: 'Clerk', category: 'NON_TEACHING', sortOrder: 25 },
    {
      code: 'ACCOUNTANT',
      label: 'Accountant',
      category: 'NON_TEACHING',
      sortOrder: 26,
    },
    {
      code: 'OFFICE_ASSISTANT',
      label: 'Office Assistant',
      category: 'NON_TEACHING',
      sortOrder: 27,
    },
    {
      code: 'RECEPTIONIST',
      label: 'Receptionist',
      category: 'NON_TEACHING',
      sortOrder: 28,
    },
    {
      code: 'TYPIST',
      label: 'Typist',
      category: 'NON_TEACHING',
      sortOrder: 29,
    },
    {
      code: 'DATA_ENTRY_OPERATOR',
      label: 'Data Entry Operator',
      category: 'NON_TEACHING',
      sortOrder: 30,
    },
    {
      code: 'STORE_KEEPER',
      label: 'Store Keeper',
      category: 'NON_TEACHING',
      sortOrder: 31,
    },
    {
      code: 'LAB_ASSISTANT',
      label: 'Lab Assistant',
      category: 'NON_TEACHING',
      sortOrder: 32,
    },
    {
      code: 'LIBRARY_ASSISTANT',
      label: 'Library Assistant',
      category: 'NON_TEACHING',
      sortOrder: 33,
    },
    {
      code: 'LIBRARIAN',
      label: 'Librarian',
      category: 'NON_TEACHING',
      sortOrder: 34,
    },
    {
      code: 'SECURITY_STAFF',
      label: 'Security Staff',
      category: 'NON_TEACHING',
      sortOrder: 35,
    },
    {
      code: 'DRIVER',
      label: 'Driver',
      category: 'NON_TEACHING',
      sortOrder: 36,
    },
    {
      code: 'ELECTRICIAN',
      label: 'Electrician',
      category: 'NON_TEACHING',
      sortOrder: 37,
    },
    {
      code: 'PLUMBER',
      label: 'Plumber',
      category: 'NON_TEACHING',
      sortOrder: 38,
    },
    {
      code: 'CLEANER',
      label: 'Cleaner',
      category: 'NON_TEACHING',
      sortOrder: 39,
    },
    {
      code: 'HOSTEL_STAFF',
      label: 'Hostel Staff',
      category: 'NON_TEACHING',
      sortOrder: 40,
    },
    {
      code: 'MAINTENANCE_STAFF',
      label: 'Maintenance Staff',
      category: 'NON_TEACHING',
      sortOrder: 41,
    },
    { code: 'REGISTRAR', label: 'Registrar', category: 'ADMIN', sortOrder: 50 },
    {
      code: 'ASSISTANT_REGISTRAR',
      label: 'Assistant Registrar',
      category: 'ADMIN',
      sortOrder: 51,
    },
    {
      code: 'ADMIN_OFFICER',
      label: 'Administrative Officer',
      category: 'ADMIN',
      sortOrder: 52,
    },
    {
      code: 'SUPERINTENDENT',
      label: 'Superintendent',
      category: 'ADMIN',
      sortOrder: 53,
    },
    { code: 'BURSAR', label: 'Bursar', category: 'ADMIN', sortOrder: 54 },
    {
      code: 'OFFICE_SUPERINTENDENT',
      label: 'Office Superintendent',
      category: 'ADMIN',
      sortOrder: 55,
    },
    {
      code: 'FINANCE_OFFICER',
      label: 'Finance Officer',
      category: 'ADMIN',
      sortOrder: 56,
    },
    {
      code: 'HR_OFFICER',
      label: 'HR Officer',
      category: 'ADMIN',
      sortOrder: 57,
    },
    {
      code: 'IT_ADMINISTRATOR',
      label: 'IT Administrator',
      category: 'ADMIN',
      sortOrder: 58,
    },
    {
      code: 'ERP_ADMINISTRATOR',
      label: 'ERP Administrator',
      category: 'ADMIN',
      sortOrder: 59,
    },
  ];
  for (const d of designationSeed) {
    await prisma.designation.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: d.code } },
      update: {
        label: d.label,
        sortOrder: d.sortOrder,
        category: d.category,
        isActive: true,
      },
      create: { tenantId: tenant.id, ...d },
    });
  }

  await prisma.designation.updateMany({
    where: { tenantId: tenant.id, code: 'HOD' },
    data: { isActive: false },
  });

  const academicRoleSeed = [
    { code: 'HOD', label: 'Head of Department', sortOrder: 1 },
    { code: 'IQAC_COORD', label: 'IQAC Coordinator', sortOrder: 2 },
    { code: 'NAAC_COORD', label: 'NAAC Coordinator', sortOrder: 3 },
    { code: 'EXAM_CONTROLLER', label: 'Exam Controller', sortOrder: 4 },
    { code: 'NSS_COORD', label: 'NSS Coordinator', sortOrder: 5 },
    { code: 'TIMETABLE_COORD', label: 'Timetable Coordinator', sortOrder: 6 },
    { code: 'RESEARCH_COORD', label: 'Research Coordinator', sortOrder: 7 },
    { code: 'DEAN', label: 'Dean', sortOrder: 8 },
    { code: 'VICE_PRINCIPAL', label: 'Vice Principal', sortOrder: 9 },
    { code: 'PRINCIPAL', label: 'Principal', sortOrder: 10 },
  ];
  for (const r of academicRoleSeed) {
    await prisma.academicRoleDefinition.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: r.code } },
      update: { label: r.label, sortOrder: r.sortOrder, isActive: true },
      create: { tenantId: tenant.id, ...r },
    });
  }

  const institutionName = 'Don Bosco College Tura';
  const campusName = 'Don Bosco College Tura';

  let institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        tenantId: tenant.id,
        name: institutionName,
        code: 'DBCT',
      },
    });
  } else {
    institution = await prisma.institution.update({
      where: { id: institution.id },
      data: { name: institutionName },
    });
  }

  await prisma.institution.updateMany({
    where: { tenantId: tenant.id, deletedAt: null },
    data: { name: institutionName },
  });

  let campus = await prisma.campus.findFirst({
    where: {
      tenantId: tenant.id,
      institutionId: institution.id,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!campus) {
    campus = await prisma.campus.create({
      data: {
        tenantId: tenant.id,
        institutionId: institution.id,
        name: campusName,
        code: 'DBCT',
      },
    });
  } else {
    campus = await prisma.campus.update({
      where: { id: campus.id },
      data: { name: campusName },
    });
  }

  await prisma.campus.updateMany({
    where: { tenantId: tenant.id, deletedAt: null },
    data: { name: campusName },
  });

  // Point all departments at the active institution + campus (fixes orphaned soft-deleted campus links)
  await prisma.department.updateMany({
    where: { tenantId: tenant.id, deletedAt: null },
    data: { institutionId: institution.id, campusId: campus.id },
  });

  const DEPARTMENT_MASTER: {
    name: string;
    code: string;
    departmentType: string;
  }[] = [
    { name: 'Economics', code: 'ECO', departmentType: 'ARTS' },
    { name: 'Education', code: 'EDU', departmentType: 'ARTS' },
    { name: 'English', code: 'ENG', departmentType: 'ARTS' },
    { name: 'Garo', code: 'GAR', departmentType: 'ARTS' },
    { name: 'Geography', code: 'GEO', departmentType: 'ARTS' },
    { name: 'History', code: 'HIS', departmentType: 'ARTS' },
    { name: 'Philosophy', code: 'PHI', departmentType: 'ARTS' },
    { name: 'Political Science', code: 'POL', departmentType: 'ARTS' },
    { name: 'Sociology', code: 'SOC', departmentType: 'ARTS' },
    { name: 'Botany', code: 'BOT', departmentType: 'SCIENCE' },
    { name: 'Chemistry', code: 'CHE', departmentType: 'SCIENCE' },
    { name: 'Mathematics', code: 'MTH', departmentType: 'SCIENCE' },
    { name: 'Zoology', code: 'ZOO', departmentType: 'SCIENCE' },
    { name: 'Physics', code: 'PHY', departmentType: 'SCIENCE' },
    {
      name: 'Accounting For Business',
      code: 'AFB',
      departmentType: 'COMMERCE',
    },
    {
      name: 'Computer Science & Engineering',
      code: 'CSE',
      departmentType: 'PROFESSIONAL',
    },
    { name: 'Administration', code: 'ADM', departmentType: 'ADMINISTRATIVE' },
    { name: 'Accounts', code: 'ACC', departmentType: 'ADMINISTRATIVE' },
    { name: 'Library', code: 'LIB', departmentType: 'ADMINISTRATIVE' },
    { name: 'Examination Cell', code: 'EXM', departmentType: 'ADMINISTRATIVE' },
    { name: 'IQAC', code: 'IQAC', departmentType: 'ADMINISTRATIVE' },
    { name: 'IT Cell', code: 'ITC', departmentType: 'ADMINISTRATIVE' },
    { name: 'Transport', code: 'TRN', departmentType: 'ADMINISTRATIVE' },
    { name: 'Hostel', code: 'HST', departmentType: 'ADMINISTRATIVE' },
    { name: 'Maintenance', code: 'MNT', departmentType: 'ADMINISTRATIVE' },
    { name: 'Front Office', code: 'FRO', departmentType: 'ADMINISTRATIVE' },
    { name: 'HR', code: 'HR', departmentType: 'ADMINISTRATIVE' },
    { name: 'Store', code: 'STR', departmentType: 'ADMINISTRATIVE' },
    { name: 'Security', code: 'SEC', departmentType: 'ADMINISTRATIVE' },
    { name: 'House Keeping', code: 'HKP', departmentType: 'ADMINISTRATIVE' },
  ];

  for (const dept of DEPARTMENT_MASTER) {
    const existing = await prisma.department.findFirst({
      where: { tenantId: tenant.id, code: dept.code, deletedAt: null },
    });
    if (!existing) {
      await prisma.department.create({
        data: {
          tenantId: tenant.id,
          institutionId: institution.id,
          campusId: campus.id,
          name: dept.name,
          code: dept.code,
          departmentType: dept.departmentType,
          status: 'ACTIVE',
        },
      });
    } else {
      await prisma.department.update({
        where: { id: existing.id },
        data: {
          name: dept.name,
          departmentType: dept.departmentType,
          status: 'ACTIVE',
          ...(existing.campusId ? {} : { campusId: campus.id }),
        },
      });
    }
  }

  const departmentByCode = async (code: string) =>
    prisma.department.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
    });

  const upsertProgramDepartment = async (
    code: string,
    name: string,
    level: string,
    departmentCode: string,
  ) => {
    const owningDepartment = await departmentByCode(departmentCode);
    if (!owningDepartment) return null;

    let row = await prisma.program.findFirst({
      where: { tenantId: tenant.id, code },
    });
    if (!row) {
      row = await prisma.program.create({
        data: {
          tenantId: tenant.id,
          departmentId: owningDepartment.id,
          code,
          name,
          level,
        },
      });
    } else if (row.departmentId !== owningDepartment.id) {
      row = await prisma.program.update({
        where: { id: row.id },
        data: { departmentId: owningDepartment.id },
      });
    }
    return row;
  };

  const department =
    (await departmentByCode('CSE')) ??
    (await prisma.department.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
    }));

  if (!department) {
    throw new Error('No department available for BCA program seed');
  }

  let program = await prisma.program.findFirst({
    where: { tenantId: tenant.id, code: 'BCA' },
  });

  if (!program) {
    program = await prisma.program.create({
      data: {
        tenantId: tenant.id,
        departmentId: department.id,
        code: 'BCA',
        name: 'Bachelor of Computer Applications',
        level: 'UG',
      },
    });
  } else if (!program.departmentId) {
    program = await prisma.program.update({
      where: { id: program.id },
      data: { departmentId: department.id },
    });
  }

  await upsertProgramDepartment(
    'BA-ECO',
    'Bachelor of Arts in Economics',
    'UG',
    'ECO',
  );

  let programVersion = await prisma.programVersion.findFirst({
    where: { programId: program.id, version: 1 },
  });

  if (!programVersion) {
    programVersion = await prisma.programVersion.create({
      data: {
        tenantId: tenant.id,
        programId: program.id,
        version: 1,
        cbcsEnabled: true,
        nepProfile: { multipleEntryExit: true, abcEnabled: true },
      },
    });
  }

  const courseDefs = [
    {
      code: 'CS101',
      title: 'Programming Fundamentals',
      credits: 4,
      courseType: 'CORE',
    },
    { code: 'MA101', title: 'Mathematics I', credits: 3, courseType: 'CORE' },
    {
      code: 'HS101',
      title: 'Communication Skills',
      credits: 2,
      courseType: 'SKILL',
    },
  ];

  for (const def of courseDefs) {
    const course = await prisma.course.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: def.code } },
      update: {
        title: def.title,
        credits: def.credits,
        courseType: def.courseType,
      },
      create: { tenantId: tenant.id, ...def },
    });

    const existingOffering = await prisma.courseOffering.findFirst({
      where: {
        tenantId: tenant.id,
        programVersionId: programVersion.id,
        courseId: course.id,
        deletedAt: null,
      },
    });

    if (!existingOffering) {
      await prisma.courseOffering.create({
        data: {
          tenantId: tenant.id,
          programVersionId: programVersion.id,
          courseId: course.id,
          isElective: false,
        },
      });
    }
  }

  let academicYear = await prisma.academicYear.findFirst({
    where: {
      tenantId: tenant.id,
      institutionId: institution.id,
      name: '2026-27',
      deletedAt: null,
    },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.findFirst({
      where: {
        tenantId: tenant.id,
        institutionId: institution.id,
        academicYearIndex: 1,
        deletedAt: null,
      },
    });
  }

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        tenantId: tenant.id,
        institutionId: institution.id,
        name: '2026-27',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2027-06-30'),
        status: 'ACTIVE',
        academicYearIndex: 1,
        isPrimarySession: true,
      },
    });
  } else {
    academicYear = await prisma.academicYear.update({
      where: { id: academicYear.id },
      data: {
        institutionId: institution.id,
        name: '2026-27',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2027-06-30'),
        status: 'ACTIVE',
        academicYearIndex: 1,
        isPrimarySession: true,
      },
    });
  }

  await prisma.institutionAcademicConfig.upsert({
    where: { institutionId: institution.id },
    create: {
      tenantId: tenant.id,
      institutionId: institution.id,
      programmeModel: 'FYUGP',
      structureType: 'FYUGP_3Y_6S',
      maxActiveSemesters: 6,
      operationalYears: 3,
      terminalSemesterNumber: 6,
      currentCycle: 'ODD',
    },
    update: {
      structureType: 'FYUGP_3Y_6S',
      maxActiveSemesters: 6,
      operationalYears: 3,
      terminalSemesterNumber: 6,
      currentCycle: 'ODD',
    },
  });

  let intake = await prisma.admissionIntake.findFirst({
    where: { tenantId: tenant.id, code: 'BCA-2026' },
  });

  if (!intake) {
    intake = await prisma.admissionIntake.create({
      data: {
        tenantId: tenant.id,
        programId: program.id,
        academicYearId: academicYear.id,
        name: 'BCA Admission 2026',
        code: 'BCA-2026',
        totalSeats: 120,
        status: 'open',
        opensAt: new Date(),
      },
    });
  }

  const cycleInstitution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  let admissionCycle = await prisma.admissionCycle.findFirst({
    where: { tenantId: tenant.id, code: 'ADM-2026-27' },
  });
  if (!admissionCycle && cycleInstitution && academicYear) {
    admissionCycle = await prisma.admissionCycle.create({
      data: {
        tenantId: tenant.id,
        institutionId: cycleInstitution.id,
        academicYearId: academicYear.id,
        code: 'ADM-2026-27',
        title: 'Admission 2026-27',
        status: 'OPEN',
        fyupSemester: 1,
        registrationOpensAt: new Date('2026-01-01'),
        registrationClosesAt: new Date('2026-08-31'),
        applicationDeadline: new Date('2026-07-31'),
        paymentDeadline: new Date('2026-08-15'),
        settings: {
          applicationNumberPrefix: 'DBCT26',
          applicationFee: 600,
          admissionFeeMin: 10500,
          meritRules: {
            class12Weight: 1,
            tieBreakers: ['meritScore', 'submittedAt'],
          },
          helpDesk: {
            phone: '+91-9876543210',
            email: 'admissions@donboscocollege.ac.in',
          },
        },
      },
    });

    await prisma.admissionCycleProgram.upsert({
      where: {
        cycleId_programId: {
          cycleId: admissionCycle.id,
          programId: program.id,
        },
      },
      update: { enabled: true },
      create: {
        tenantId: tenant.id,
        cycleId: admissionCycle.id,
        programId: program.id,
        enabled: true,
      },
    });

    await prisma.admissionIntake.update({
      where: { id: intake.id },
      data: { cycleId: admissionCycle.id },
    });

    const shifts = await prisma.shift.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      take: 2,
    });
    for (const shift of shifts) {
      await prisma.admissionIntakeShift.upsert({
        where: { intakeId_shiftId: { intakeId: intake.id, shiftId: shift.id } },
        update: {
          totalSeats: 60,
          reservedSeats: { GENERAL: 30, OBC: 12, SC: 9, ST: 5, EWS: 4 },
        },
        create: {
          tenantId: tenant.id,
          intakeId: intake.id,
          shiftId: shift.id,
          totalSeats: 60,
          reservedSeats: { GENERAL: 30, OBC: 12, SC: 9, ST: 5, EWS: 4 },
        },
      });
    }
  }

  const applicants = [
    {
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul.sharma@example.com',
      category: 'GENERAL',
      meritScore: 92.5,
    },
    {
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'priya.nair@example.com',
      category: 'OBC',
      meritScore: 89.2,
    },
    {
      firstName: 'Amit',
      lastName: 'Patel',
      email: 'amit.patel@example.com',
      category: 'GENERAL',
      meritScore: 87.8,
    },
    {
      firstName: 'Sneha',
      lastName: 'Reddy',
      email: 'sneha.reddy@example.com',
      category: 'SC',
      meritScore: 85.1,
    },
    {
      firstName: 'Vikram',
      lastName: 'Singh',
      email: 'vikram.singh@example.com',
      category: 'GENERAL',
      meritScore: 83.4,
    },
  ];

  for (let i = 0; i < applicants.length; i++) {
    const num = `BCA-2026-${String(i + 1).padStart(4, '0')}`;
    const existing = await prisma.admissionApplication.findFirst({
      where: { intakeId: intake.id, applicationNumber: num },
    });
    if (!existing) {
      await prisma.admissionApplication.create({
        data: {
          tenantId: tenant.id,
          intakeId: intake.id,
          applicationNumber: num,
          ...applicants[i],
          status: i < 3 ? 'shortlisted' : 'submitted',
          submittedAt: new Date(),
        },
      });
    }
  }

  const upsertStream = async (
    code: string,
    name: string,
    description: string,
    displayOrder: number,
  ) =>
    prisma.academicStream.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, description, displayOrder, isActive: true },
      create: {
        tenantId: tenant.id,
        code,
        name,
        description,
        displayOrder,
        isActive: true,
      },
    });

  const artsStream = await upsertStream(
    'ARTS',
    'Arts',
    'Humanities and arts programmes',
    1,
  );
  const scienceStream = await upsertStream(
    'SCIENCE',
    'Science',
    'Science programmes',
    2,
  );
  const commerceStream = await upsertStream(
    'COMMERCE',
    'Commerce',
    'Commerce and business programmes',
    3,
  );
  const streamByCode = {
    ARTS: artsStream,
    SCIENCE: scienceStream,
    COMMERCE: commerceStream,
  } as const;

  const departmentStreamSeed = [
    { code: 'ECONOMICS', name: 'Economics', group: 'ARTS', order: 11 },
    { code: 'EDUCATION', name: 'Education', group: 'ARTS', order: 12 },
    { code: 'ENGLISH', name: 'English', group: 'ARTS', order: 13 },
    { code: 'GARO', name: 'Garo', group: 'ARTS', order: 14 },
    { code: 'GEOGRAPHY', name: 'Geography', group: 'ARTS', order: 15 },
    { code: 'HISTORY', name: 'History', group: 'ARTS', order: 16 },
    { code: 'PHILOSOPHY', name: 'Philosophy', group: 'ARTS', order: 17 },
    {
      code: 'POLITICAL_SCIENCE',
      name: 'Political Science',
      group: 'ARTS',
      order: 18,
    },
    { code: 'SOCIOLOGY', name: 'Sociology', group: 'ARTS', order: 19 },
    { code: 'BOTANY', name: 'Botany', group: 'SCIENCE', order: 21 },
    { code: 'CHEMISTRY', name: 'Chemistry', group: 'SCIENCE', order: 22 },
    { code: 'MATHEMATICS', name: 'Mathematics', group: 'SCIENCE', order: 23 },
    { code: 'PHYSICS', name: 'Physics', group: 'SCIENCE', order: 24 },
    { code: 'ZOOLOGY', name: 'Zoology', group: 'SCIENCE', order: 25 },
  ] as const;

  for (const row of departmentStreamSeed) {
    await upsertStream(row.code, row.name, `group:${row.group}`, row.order);
  }

  await prisma.rollNumberSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      sequenceLength: 3,
      separator: '-',
      autoGenerateOnAdmit: true,
    },
  });

  const rollPrefixSeed = [
    { stream: artsStream, prefix: 'BA' },
    { stream: scienceStream, prefix: 'BS' },
    { stream: commerceStream, prefix: 'BC' },
  ] as const;
  for (const { stream, prefix } of rollPrefixSeed) {
    await prisma.rollPrefixConfig.upsert({
      where: {
        tenantId_streamId: { tenantId: tenant.id, streamId: stream.id },
      },
      update: { prefix, isActive: true },
      create: {
        tenantId: tenant.id,
        streamId: stream.id,
        prefix,
        isActive: true,
      },
    });
  }

  await prisma.staffEmployeeCodeSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      orgPrefix: 'DBC',
      sequenceLength: 3,
      separator: '-',
      autoGenerateOnCreate: true,
    },
  });

  const employeeCodeTypeSeed = [
    { staffType: 'TEACHING', typeSuffix: 'TCH' },
    { staffType: 'ADMIN', typeSuffix: 'ADM' },
    { staffType: 'NON_TEACHING', typeSuffix: 'NTS' },
    { staffType: 'GUEST', typeSuffix: 'GST' },
    { staffType: 'VISITING', typeSuffix: 'VIS' },
    { staffType: 'CONTRACT', typeSuffix: 'CTR' },
  ] as const;
  for (const row of employeeCodeTypeSeed) {
    await prisma.staffEmployeeCodeTypePrefix.upsert({
      where: {
        tenantId_staffType: { tenantId: tenant.id, staffType: row.staffType },
      },
      update: { typeSuffix: row.typeSuffix, isActive: true },
      create: {
        tenantId: tenant.id,
        staffType: row.staffType,
        typeSuffix: row.typeSuffix,
        isActive: true,
      },
    });
  }

  await prisma.admissionApplication.updateMany({
    where: { tenantId: tenant.id, academicStreamId: null },
    data: { academicStreamId: scienceStream.id },
  });

  await prisma.studentAcademicProfile.updateMany({
    where: { tenantId: tenant.id, streamId: null },
    data: { streamId: scienceStream.id },
  });

  await prisma.programStructureTemplate.upsert({
    where: { programVersionId: programVersion.id },
    create: {
      tenantId: tenant.id,
      programVersionId: programVersion.id,
      streamId: scienceStream.id,
      structureType: 'FYUGP_3Y_6S',
      totalSemesters: 8,
      degreeMinCredits: 160,
    },
    update: { streamId: scienceStream.id },
  });

  const semRules = [
    {
      semesterSequence: 1,
      categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1, AEC: 1, SEC: 1, VAC: 1 },
      continuityRules: {},
    },
    {
      semesterSequence: 2,
      categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1, AEC: 1, SEC: 1, VAC: 1 },
      continuityRules: {
        MAJOR: 'LOCK',
        MINOR: 'LOCK',
      },
    },
    {
      semesterSequence: 3,
      categoryCounts: { MAJOR: 2, MDC: 1, SEC: 1, AEC: 1, VTC: 1 },
      continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
    },
    {
      semesterSequence: 4,
      categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1, AEC: 1, SEC: 1, VAC: 1 },
      continuityRules: {
        MAJOR: 'LOCK',
        MINOR: 'LOCK',
        VTC: 'TRACK_CONTINUE',
      },
    },
    {
      semesterSequence: 5,
      categoryCounts: { MAJOR: 2, MDC: 1, SEC: 1, AEC: 1, VTC: 1 },
      continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
    },
    {
      semesterSequence: 6,
      categoryCounts: { MAJOR: 2, MDC: 1, SEC: 1, AEC: 1 },
      continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK', VTC: 'TRACK_CONTINUE' },
    },
  ];

  for (const rule of semRules) {
    await prisma.semesterStructureRule.upsert({
      where: {
        programVersionId_semesterSequence: {
          programVersionId: programVersion.id,
          semesterSequence: rule.semesterSequence,
        },
      },
      create: {
        tenantId: tenant.id,
        programVersionId: programVersion.id,
        semesterSequence: rule.semesterSequence,
        categoryCounts: rule.categoryCounts,
        continuityRules: rule.continuityRules,
      },
      update: {
        categoryCounts: rule.categoryCounts,
        continuityRules: rule.continuityRules,
      },
    });
  }

  const fyugpSemesterDefs = [
    {
      yearIndex: 1,
      yearName: '2026-27',
      yearStart: '2026-07-01',
      yearEnd: '2027-06-30',
      sem: 1,
      seqInYear: 1,
      type: 'ODD',
      start: '2026-07-01',
      end: '2026-12-15',
      terminal: false,
    },
    {
      yearIndex: 1,
      yearName: '2026-27',
      yearStart: '2026-07-01',
      yearEnd: '2027-06-30',
      sem: 2,
      seqInYear: 2,
      type: 'EVEN',
      start: '2027-01-01',
      end: '2027-06-30',
      terminal: false,
    },
    {
      yearIndex: 2,
      yearName: '2027-28',
      yearStart: '2027-07-01',
      yearEnd: '2028-06-30',
      sem: 3,
      seqInYear: 1,
      type: 'ODD',
      start: '2027-07-01',
      end: '2027-12-15',
      terminal: false,
    },
    {
      yearIndex: 2,
      yearName: '2027-28',
      yearStart: '2027-07-01',
      yearEnd: '2028-06-30',
      sem: 4,
      seqInYear: 2,
      type: 'EVEN',
      start: '2028-01-01',
      end: '2028-06-30',
      terminal: false,
    },
    {
      yearIndex: 3,
      yearName: '2028-29',
      yearStart: '2028-07-01',
      yearEnd: '2029-06-30',
      sem: 5,
      seqInYear: 1,
      type: 'ODD',
      start: '2028-07-01',
      end: '2028-12-15',
      terminal: false,
    },
    {
      yearIndex: 3,
      yearName: '2028-29',
      yearStart: '2028-07-01',
      yearEnd: '2029-06-30',
      sem: 6,
      seqInYear: 2,
      type: 'EVEN',
      start: '2029-01-01',
      end: '2029-06-30',
      terminal: true,
    },
  ];

  const yearByIndex: Record<number, { id: string }> = {};
  const semesterBySeq: Record<number, { id: string }> = {};

  for (const def of fyugpSemesterDefs) {
    if (!yearByIndex[def.yearIndex]) {
      let ay = await prisma.academicYear.findFirst({
        where: {
          tenantId: tenant.id,
          institutionId: institution.id,
          deletedAt: null,
          OR: [{ academicYearIndex: def.yearIndex }, { name: def.yearName }],
        },
      });
      if (!ay) {
        ay = await prisma.academicYear.create({
          data: {
            tenantId: tenant.id,
            institutionId: institution.id,
            name: def.yearName,
            startDate: new Date(def.yearStart),
            endDate: new Date(def.yearEnd),
            status: def.yearIndex === 1 ? 'ACTIVE' : 'PLANNED',
            academicYearIndex: def.yearIndex,
            isPrimarySession: def.yearIndex === 1,
          },
        });
      } else {
        ay = await prisma.academicYear.update({
          where: { id: ay.id },
          data: {
            name: def.yearName,
            startDate: new Date(def.yearStart),
            endDate: new Date(def.yearEnd),
            academicYearIndex: def.yearIndex,
            status: def.yearIndex === 1 ? 'ACTIVE' : ay.status,
            isPrimarySession: def.yearIndex === 1,
          },
        });
      }
      yearByIndex[def.yearIndex] = ay;
    }

    const ayId = yearByIndex[def.yearIndex]!.id;
    let sem = await prisma.semester.findFirst({
      where: {
        institutionId: institution.id,
        semesterNumber: def.sem,
        deletedAt: null,
      },
    });
    if (!sem) {
      sem = await prisma.semester.create({
        data: {
          tenantId: tenant.id,
          institutionId: institution.id,
          academicYearId: ayId,
          name: `Semester ${def.sem}`,
          sequence: def.seqInYear,
          semesterNumber: def.sem,
          semesterType: def.type,
          progressionOrder: def.sem,
          academicYearIndex: def.yearIndex,
          isTerminal: def.terminal,
          status: def.sem === 1 ? 'ACTIVE' : 'PLANNED',
          isActive: def.sem === 1,
          registrationOpen: def.sem === 1,
          attendanceEnabled: def.sem === 1,
          startDate: new Date(def.start),
          endDate: new Date(def.end),
        },
      });
    } else {
      sem = await prisma.semester.update({
        where: { id: sem.id },
        data: {
          institutionId: institution.id,
          semesterNumber: def.sem,
          semesterType: def.type,
          progressionOrder: def.sem,
          academicYearIndex: def.yearIndex,
          isTerminal: def.terminal,
        },
      });
    }
    semesterBySeq[def.sem] = sem;
  }

  const semester1 = semesterBySeq[1]!;
  const semester2 = semesterBySeq[2]!;
  const semester3 = semesterBySeq[3]!;
  const semester4 = semesterBySeq[4]!;
  const semester5 = semesterBySeq[5]!;
  const semester6 = semesterBySeq[6]!;

  await prisma.institutionAcademicConfig.update({
    where: { institutionId: institution.id },
    data: { currentCycle: 'ODD' },
  });

  await prisma.semester.updateMany({
    where: {
      institutionId: institution.id,
      semesterNumber: { in: [1, 3, 5] },
      deletedAt: null,
    },
    data: {
      isActive: true,
      status: 'ACTIVE',
      registrationOpen: true,
      attendanceEnabled: true,
      examinationEnabled: true,
      timetableEnabled: true,
      feeCycleEnabled: true,
      resultProcessingEnabled: true,
    },
  });

  await prisma.semester.updateMany({
    where: {
      institutionId: institution.id,
      semesterNumber: { in: [2, 4, 6] },
      deletedAt: null,
    },
    data: {
      isActive: false,
      status: 'PLANNED',
      registrationOpen: false,
      attendanceEnabled: false,
      examinationEnabled: false,
      timetableEnabled: false,
    },
  });

  const batchSessionDefs = [
    {
      year: 2024,
      name: '2024-25',
      start: '2024-07-01',
      end: '2025-06-30',
      sem: 5,
    },
    {
      year: 2025,
      name: '2025-26',
      start: '2025-07-01',
      end: '2026-06-30',
      sem: 3,
    },
    {
      year: 2026,
      name: '2026-27',
      start: '2026-07-01',
      end: '2027-06-30',
      sem: 1,
    },
  ];

  for (const def of batchSessionDefs) {
    let session = await prisma.academicYear.findFirst({
      where: {
        tenantId: tenant.id,
        institutionId: institution.id,
        name: def.name,
        deletedAt: null,
      },
    });
    if (!session) {
      session = await prisma.academicYear.create({
        data: {
          tenantId: tenant.id,
          institutionId: institution.id,
          name: def.name,
          startDate: new Date(def.start),
          endDate: new Date(def.end),
          status: def.year === 2026 ? 'ACTIVE' : 'ARCHIVED',
          isPrimarySession: def.year === 2026,
          academicYearIndex: def.year === 2026 ? 1 : def.year === 2025 ? 2 : 3,
        },
      });
    } else {
      session = await prisma.academicYear.update({
        where: { id: session.id },
        data: {
          startDate: new Date(def.start),
          endDate: new Date(def.end),
          status: def.year === 2026 ? 'ACTIVE' : session.status,
          isPrimarySession: def.year === 2026,
          academicYearIndex:
            session.academicYearIndex ?? (def.year === 2026 ? 1 : undefined),
        },
      });
    }

    const batchCode = `BATCH-${def.year}`;
    let batch = await prisma.admissionBatch.findFirst({
      where: { institutionId: institution.id, batchCode, deletedAt: null },
    });
    if (!batch) {
      batch = await prisma.admissionBatch.create({
        data: {
          tenantId: tenant.id,
          institutionId: institution.id,
          batchCode,
          admissionYear: def.year,
          entrySessionId: session.id,
          currentSemester: def.sem,
          cycleType: def.sem % 2 === 1 ? 'ODD' : 'EVEN',
          promotionStatus: 'IDLE',
          registrationMode: 'ADMIN_ONLY',
          isActive: true,
        },
      });
    } else {
      batch = await prisma.admissionBatch.update({
        where: { id: batch.id },
        data: {
          currentSemester: def.sem,
          cycleType: def.sem % 2 === 1 ? 'ODD' : 'EVEN',
          entrySessionId: session.id,
          registrationMode: 'ADMIN_ONLY',
        },
      });
    }

    const calendarSem = semesterBySeq[def.sem];
    await prisma.batchSemesterMapping.upsert({
      where: { admissionBatchId: batch.id },
      create: {
        tenantId: tenant.id,
        institutionId: institution.id,
        admissionBatchId: batch.id,
        semesterNumber: def.sem,
        calendarSemesterId: calendarSem?.id,
        cycleType: def.sem % 2 === 1 ? 'ODD' : 'EVEN',
        isActive: true,
      },
      update: {
        semesterNumber: def.sem,
        calendarSemesterId: calendarSem?.id,
        cycleType: def.sem % 2 === 1 ? 'ODD' : 'EVEN',
        isActive: true,
      },
    });
  }

  const allYears = await prisma.academicYear.findMany({
    where: {
      tenantId: tenant.id,
      institutionId: institution.id,
      deletedAt: null,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
  const keeperByName = new Map<string, string>();
  for (const year of allYears) {
    const key = year.name.trim().toLowerCase();
    if (keeperByName.has(key)) continue;
    if (year.status === 'ACTIVE' || year.isPrimarySession) {
      keeperByName.set(key, year.id);
    }
  }
  for (const year of allYears) {
    const key = year.name.trim().toLowerCase();
    if (!keeperByName.has(key)) keeperByName.set(key, year.id);
  }
  for (const year of allYears) {
    const key = year.name.trim().toLowerCase();
    if (keeperByName.get(key) !== year.id) {
      await prisma.academicYear.update({
        where: { id: year.id },
        data: { deletedAt: new Date() },
      });
    }
  }

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      tenantId: tenant.id,
      semesterId: semester1.id,
      name: 'Sem 1 Registration 2026-27',
      opensAt: new Date('2026-05-01'),
      closesAt: new Date('2026-12-31'),
      locked: false,
    },
    update: { locked: false, closesAt: new Date('2026-12-31') },
  });

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      tenantId: tenant.id,
      semesterId: semester2.id,
      name: 'Sem 2 Registration 2026-27',
      opensAt: new Date('2026-05-01'),
      closesAt: new Date('2027-12-31'),
      locked: false,
    },
    update: { locked: false, closesAt: new Date('2027-12-31') },
  });

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    create: {
      id: '00000000-0000-4000-8000-000000000003',
      tenantId: tenant.id,
      semesterId: semester3.id,
      name: 'Sem 3 Registration 2026-27',
      opensAt: new Date('2026-05-01'),
      closesAt: new Date('2027-12-31'),
      locked: false,
    },
    update: { locked: false, closesAt: new Date('2027-12-31') },
  });

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000004' },
    create: {
      id: '00000000-0000-4000-8000-000000000004',
      tenantId: tenant.id,
      semesterId: semester4.id,
      name: 'Sem 4 Registration 2027-28',
      opensAt: new Date('2027-05-01'),
      closesAt: new Date('2028-12-31'),
      locked: false,
    },
    update: { locked: false },
  });

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000005' },
    create: {
      id: '00000000-0000-4000-8000-000000000005',
      tenantId: tenant.id,
      semesterId: semester5.id,
      name: 'Sem 5 Registration 2028-29',
      opensAt: new Date('2028-05-01'),
      closesAt: new Date('2029-12-31'),
      locked: false,
    },
    update: { locked: false },
  });

  await prisma.registrationWindow.upsert({
    where: { id: '00000000-0000-4000-8000-000000000006' },
    create: {
      id: '00000000-0000-4000-8000-000000000006',
      tenantId: tenant.id,
      semesterId: semester6.id,
      name: 'Sem 6 Registration 2029-30',
      opensAt: new Date('2029-05-01'),
      closesAt: new Date('2030-12-31'),
      locked: false,
    },
    update: { locked: false },
  });

  await prisma.eligibilityRuleSet.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, rules: { mdcExcludeClass12: true } },
    update: {},
  });

  const nepCourses: {
    code: string;
    title: string;
    credits: number;
    category: string;
    subjectSlug: string;
    sem: number;
    majorPaperIndex?: number;
    deliveryType?: string;
    creditCalculationMode?: string;
    theoryCredits?: number;
    practicalCredits?: number;
    theoryHoursPerWeek?: number;
    practicalHoursPerWeek?: number;
    totalTheoryContactHours?: number;
    totalPracticalContactHours?: number;
    totalContactHours?: number;
  }[] = [
    {
      code: 'BCA-M101',
      title: 'Programming Fundamentals',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 1,
      deliveryType: 'THEORY',
      theoryCredits: 4,
      practicalCredits: 0,
      theoryHoursPerWeek: 4,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 60,
      totalPracticalContactHours: 0,
    },
    {
      code: 'MAT-M101',
      title: 'Mathematics Minor I',
      credits: 3,
      category: 'MINOR',
      subjectSlug: 'mathematics',
      sem: 1,
    },
    {
      code: 'MDC101',
      title: 'Culture and Society',
      credits: 3,
      category: 'MDC',
      subjectSlug: 'culture-society',
      sem: 1,
    },
    {
      code: 'AEC-ENG',
      title: 'Communicative English',
      credits: 2,
      category: 'AEC',
      subjectSlug: 'english',
      sem: 1,
    },
    {
      code: 'SEC-PY',
      title: 'Python Programming',
      credits: 2,
      category: 'SEC',
      subjectSlug: 'python',
      sem: 1,
      deliveryType: 'PRACTICAL',
      theoryCredits: 0,
      practicalCredits: 2,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 4,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 80,
    },
    {
      code: 'VAC-ENV',
      title: 'Environmental Science',
      credits: 2,
      category: 'VAC',
      subjectSlug: 'environment',
      sem: 1,
      majorPaperIndex: undefined,
    },
    {
      code: 'BCA-M201',
      title: 'Data Structures',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 2,
    },
    {
      code: 'MAT-M201',
      title: 'Mathematics Minor II',
      credits: 3,
      category: 'MINOR',
      subjectSlug: 'mathematics',
      sem: 2,
    },
    {
      code: 'MDC201',
      title: 'Disaster Management',
      credits: 3,
      category: 'MDC',
      subjectSlug: 'disaster-management',
      sem: 2,
    },
    {
      code: 'AEC-HIN',
      title: 'Hindi Communication',
      credits: 2,
      category: 'AEC',
      subjectSlug: 'hindi',
      sem: 2,
    },
    {
      code: 'SEC-WEB',
      title: 'Web Technologies',
      credits: 2,
      category: 'SEC',
      subjectSlug: 'web-tech',
      sem: 2,
    },
    {
      code: 'VAC-YOGA',
      title: 'Yoga and Wellness',
      credits: 2,
      category: 'VAC',
      subjectSlug: 'yoga',
      sem: 2,
    },
    {
      code: 'BCA-M301',
      title: 'Advanced Programming',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 3,
      majorPaperIndex: 1,
    },
    {
      code: 'BCA-M302',
      title: 'Database Systems',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 3,
      majorPaperIndex: 2,
    },
    {
      code: 'MDC301',
      title: 'Indian Constitution',
      credits: 3,
      category: 'MDC',
      subjectSlug: 'constitution',
      sem: 3,
    },
    {
      code: 'AEC-ENG2',
      title: 'Advanced English',
      credits: 2,
      category: 'AEC',
      subjectSlug: 'english',
      sem: 3,
    },
    {
      code: 'SEC-DS',
      title: 'Data Science Basics',
      credits: 2,
      category: 'SEC',
      subjectSlug: 'data-science',
      sem: 3,
    },
    {
      code: 'VTC301',
      title: 'Web Development Workshop',
      credits: 4,
      category: 'VTC',
      subjectSlug: 'web-dev',
      sem: 3,
      deliveryType: 'INTERNSHIP',
      creditCalculationMode: 'MANUAL_OVERRIDE',
      theoryCredits: 0,
      practicalCredits: 0,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 0,
      totalContactHours: 120,
    },
    {
      code: 'BCA-M501',
      title: 'Software Engineering',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 5,
      majorPaperIndex: 1,
    },
    {
      code: 'BCA-M502',
      title: 'Computer Networks',
      credits: 4,
      category: 'MAJOR',
      subjectSlug: 'computer-science',
      sem: 5,
      majorPaperIndex: 2,
    },
    {
      code: 'MDC501',
      title: 'Ethics and Values',
      credits: 3,
      category: 'MDC',
      subjectSlug: 'ethics',
      sem: 5,
    },
    {
      code: 'AEC-ENG3',
      title: 'Professional Communication',
      credits: 2,
      category: 'AEC',
      subjectSlug: 'english',
      sem: 5,
    },
    {
      code: 'SEC-501',
      title: 'Cloud Computing',
      credits: 2,
      category: 'SEC',
      subjectSlug: 'cloud',
      sem: 5,
    },
    {
      code: 'INT501',
      title: 'Industry Internship',
      credits: 4,
      category: 'VTC',
      subjectSlug: 'internship',
      sem: 5,
      deliveryType: 'INTERNSHIP',
      creditCalculationMode: 'MANUAL_OVERRIDE',
      theoryCredits: 0,
      practicalCredits: 0,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 0,
      totalContactHours: 120,
    },
  ];

  const shiftTime = (h: number, m: number) =>
    new Date(Date.UTC(1970, 0, 1, h, m, 0));
  const shiftDefs = [
    {
      code: 'MORNING',
      name: 'Morning Shift',
      sortOrder: 0,
      start: shiftTime(6, 30),
      end: shiftTime(9, 30),
    },
    {
      code: 'DAY',
      name: 'Day Shift',
      sortOrder: 1,
      start: shiftTime(9, 45),
      end: shiftTime(15, 30),
    },
    {
      code: 'SHIFT_II',
      name: 'Arts Shift II',
      sortOrder: 2,
      start: shiftTime(9, 45),
      end: shiftTime(15, 30),
    },
    {
      code: 'EVENING',
      name: 'Evening Shift',
      sortOrder: 3,
      start: shiftTime(14, 45),
      end: shiftTime(17, 45),
    },
  ];
  const activeCampuses = await prisma.campus.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const shifts: Record<string, { id: string }> = {};
  for (const campusRow of activeCampuses) {
    for (const s of shiftDefs) {
      let row = await prisma.shift.findFirst({
        where: {
          tenantId: tenant.id,
          campusId: campusRow.id,
          code: s.code,
          deletedAt: null,
        },
      });
      if (!row) {
        row = await prisma.shift.create({
          data: {
            tenantId: tenant.id,
            institutionId: institution.id,
            campusId: campusRow.id,
            name: s.name,
            code: s.code,
            startTime: s.start,
            endTime: s.end,
            shiftType: 'REGULAR',
            status: 'ACTIVE',
            sortOrder: s.sortOrder,
          },
        });
      } else {
        row = await prisma.shift.update({
          where: { id: row.id },
          data: {
            name: s.name,
            startTime: s.start,
            endTime: s.end,
            sortOrder: s.sortOrder,
            status: 'ACTIVE',
          },
        });
      }
      if (campusRow.id === campus.id) {
        shifts[s.code] = row;
      }
    }
  }

  await prisma.registrationApprovalPolicy.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      tenantId: tenant.id,
      programVersionId: programVersion.id,
      mode: 'auto',
      approverRoles: ['college-admin', 'faculty'],
      creditPolicy: { minCredits: 18, maxCredits: 26 },
      shiftPolicy: { enforcePreferredShift: true, blockCrossShift: true },
    },
    update: {
      mode: 'auto',
      creditPolicy: { minCredits: 18, maxCredits: 26 },
      shiftPolicy: { enforcePreferredShift: true, blockCrossShift: true },
    },
  });

  const shiftAdminRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, slug: 'shift-admin' },
  });

  const upsertShiftAdmin = async (
    email: string,
    shiftCode: string,
    displayName: string,
  ) => {
    const shift = shifts[shiftCode];
    if (!shift) return;
    const passwordHash = await bcrypt.hash('Shift@123', 12);
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { passwordHash, isActive: true, deletedAt: null },
      create: {
        tenantId: tenant.id,
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: shiftAdminRole.id,
        deletedAt: null,
      },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: shiftAdminRole.id },
      });
    }
    await prisma.userShiftAssignment.upsert({
      where: { userId_shiftId: { userId: user.id, shiftId: shift.id } },
      create: { userId: user.id, shiftId: shift.id, isPrimary: true },
      update: { isPrimary: true },
    });
    console.log(`Shift admin (${displayName}): ${email} / Shift@123`);
  };

  await upsertShiftAdmin('morning.admin@demo.edu', 'MORNING', 'Morning');
  await upsertShiftAdmin('day.admin@demo.edu', 'DAY', 'Day');
  await upsertShiftAdmin('evening.admin@demo.edu', 'EVENING', 'Evening');

  const academicSettings = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId: tenant.id },
  });
  const excludedCurriculum = new Set<string>(
    Array.isArray(
      (academicSettings?.nepProfile as Record<string, unknown> | null)
        ?.excludedCurriculumKeys,
    )
      ? ((academicSettings?.nepProfile as Record<string, unknown>)
          .excludedCurriculumKeys as string[])
      : [],
  );

  for (const c of nepCourses) {
    const offeringKey = `${programVersion.id}:${c.code}:${c.sem}`;
    if (excludedCurriculum.has(offeringKey)) {
      console.log(`Seed skip (removed mapping): ${c.code} semester ${c.sem}`);
      continue;
    }

    const deliveryType = c.deliveryType ?? 'THEORY';
    const creditCalculationMode = c.creditCalculationMode ?? 'AUTO_CALCULATED';
    const theoryCredits =
      c.theoryCredits ??
      (creditCalculationMode === 'MANUAL_OVERRIDE' ? 0 : c.credits);
    const practicalCredits = c.practicalCredits ?? 0;
    const hasPractical = practicalCredits > 0;
    const totalCredits =
      creditCalculationMode === 'MANUAL_OVERRIDE'
        ? c.credits
        : theoryCredits + practicalCredits || c.credits;
    const totalTheoryContactHours = c.totalTheoryContactHours ?? 0;
    const totalPracticalContactHours = c.totalPracticalContactHours ?? 0;
    const totalContactHours =
      c.totalContactHours ??
      totalTheoryContactHours + totalPracticalContactHours;
    const requiresTheorySplit = theoryCredits > 0;
    const requiresPracticalSplit = practicalCredits > 0;

    const course = await prisma.course.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: c.code } },
      update: {
        title: c.title,
        credits: totalCredits,
        deliveryType,
        creditCalculationMode,
        requiresTheorySplit,
        requiresPracticalSplit,
        hasPractical,
        theoryCredits,
        practicalCredits,
        theoryHoursPerWeek: c.theoryHoursPerWeek ?? 0,
        practicalHoursPerWeek: c.practicalHoursPerWeek ?? 0,
        totalTheoryContactHours,
        totalPracticalContactHours,
        totalContactHours,
        subjectSlug: c.subjectSlug,
        courseType: 'CORE',
        departmentId: department.id,
      },
      create: {
        tenantId: tenant.id,
        code: c.code,
        title: c.title,
        credits: totalCredits,
        deliveryType,
        creditCalculationMode,
        requiresTheorySplit,
        requiresPracticalSplit,
        hasPractical,
        theoryCredits,
        practicalCredits,
        theoryHoursPerWeek: c.theoryHoursPerWeek ?? 0,
        practicalHoursPerWeek: c.practicalHoursPerWeek ?? 0,
        totalTheoryContactHours,
        totalPracticalContactHours,
        totalContactHours,
        courseType: 'CORE',
        subjectSlug: c.subjectSlug,
        departmentId: department.id,
      },
    });

    const existingOff = await prisma.courseOffering.findFirst({
      where: {
        tenantId: tenant.id,
        programVersionId: programVersion.id,
        courseId: course.id,
        semesterSequence: c.sem,
        deletedAt: null,
      },
    });

    const offering =
      existingOff ??
      (await prisma.courseOffering.create({
        data: {
          tenantId: tenant.id,
          programVersionId: programVersion.id,
          courseId: course.id,
          semesterId: semesterBySeq[c.sem]?.id,
          category: c.category,
          semesterSequence: c.sem,
          majorPaperIndex: c.majorPaperIndex,
          capacity: 40,
          waitlistCapacity: 10,
        },
      }));

    const sectionDefs =
      c.code === 'SEC-PY'
        ? [
            { shift: 'MORNING', cap: 40, wl: 10 },
            { shift: 'DAY', cap: 60, wl: 15 },
            { shift: 'EVENING', cap: 30, wl: 8 },
          ]
        : [{ shift: 'DAY', cap: 40, wl: 10 }];

    for (const sd of sectionDefs) {
      const sectionKey = `${programVersion.id}:${c.code}:${c.sem}:${sd.shift}:A`;
      if (excludedCurriculum.has(sectionKey)) {
        console.log(`Seed skip (removed section): ${c.code} ${sd.shift}`);
        continue;
      }

      const shiftId = shifts[sd.shift]!.id;
      let section = await prisma.offeringSection.findFirst({
        where: {
          courseOfferingId: offering.id,
          shiftId,
          sectionCode: 'A',
        },
      });
      if (!section) {
        section = await prisma.offeringSection.create({
          data: {
            tenantId: tenant.id,
            courseOfferingId: offering.id,
            shiftId,
            sectionCode: 'A',
            capacity: sd.cap,
            waitlistCapacity: sd.wl,
          },
        });
      }
      await prisma.offeringSeatLedger.upsert({
        where: { offeringSectionId: section.id },
        create: { tenantId: tenant.id, offeringSectionId: section.id },
        update: {},
      });

      const streamCodesForSection: string[] = (() => {
        if (c.category !== 'AEC') return [];
        if (c.code === 'AEC-170') return ['ARTS', 'SCIENCE', 'COMMERCE'];
        if (c.code === 'AEC-220') return ['SCIENCE'];
        if (c.code === 'AEC-221') return ['COMMERCE'];
        if (c.code === 'AEC-223') return ['ARTS'];
        return [];
      })();

      for (const sc of streamCodesForSection) {
        const st = streamByCode[sc as keyof typeof streamByCode];
        if (!st) continue;
        await prisma.offeringSectionStream.upsert({
          where: {
            offeringSectionId_academicStreamId: {
              offeringSectionId: section.id,
              academicStreamId: st.id,
            },
          },
          create: {
            offeringSectionId: section.id,
            academicStreamId: st.id,
          },
          update: {},
        });
      }
    }
  }

  await seedArtsFyugpCatalog({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    semesterBySeq,
    shifts,
    createdById: adminUser.id,
  });

  await seedArtsOddTimetable({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    createdById: adminUser.id,
  });

  await seedArtsShiftIiTimetable({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    createdById: adminUser.id,
  });

  await seedDemoLiveReady({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    createdById: adminUser.id,
    shifts,
    semesterBySeq,
  });

  for (const [code, cap] of [
    ['MORNING', 30],
    ['DAY', 60],
    ['SHIFT_II', 40],
    ['EVENING', 30],
  ] as const) {
    const shiftId = shifts[code]!.id;
    const existingCap = await prisma.admissionIntakeShift.findFirst({
      where: { intakeId: intake.id, shiftId },
    });
    if (!existingCap) {
      await prisma.admissionIntakeShift.create({
        data: {
          tenantId: tenant.id,
          intakeId: intake.id,
          shiftId,
          totalSeats: cap,
          reservedSeats: {
            SC: Math.floor(cap * 0.15),
            ST: Math.floor(cap * 0.075),
          },
        },
      });
    }
  }

  const lookupDefaults: {
    lookupType: string;
    code: string;
    label: string;
    sortOrder: number;
  }[] = [
    { lookupType: 'CATEGORY', code: 'GENERAL', label: 'General', sortOrder: 1 },
    { lookupType: 'CATEGORY', code: 'OBC', label: 'OBC', sortOrder: 2 },
    { lookupType: 'CATEGORY', code: 'SC', label: 'SC', sortOrder: 3 },
    { lookupType: 'CATEGORY', code: 'ST', label: 'ST', sortOrder: 4 },
    { lookupType: 'RELIGION', code: 'HINDU', label: 'Hindu', sortOrder: 1 },
    { lookupType: 'RELIGION', code: 'MUSLIM', label: 'Muslim', sortOrder: 2 },
    {
      lookupType: 'RELIGION',
      code: 'CHRISTIAN',
      label: 'Christian',
      sortOrder: 3,
    },
    { lookupType: 'RELIGION', code: 'OTHER', label: 'Other', sortOrder: 4 },
    { lookupType: 'BLOOD_GROUP', code: 'A_POS', label: 'A+', sortOrder: 1 },
    { lookupType: 'BLOOD_GROUP', code: 'B_POS', label: 'B+', sortOrder: 2 },
    { lookupType: 'BLOOD_GROUP', code: 'O_POS', label: 'O+', sortOrder: 3 },
    { lookupType: 'BLOOD_GROUP', code: 'AB_POS', label: 'AB+', sortOrder: 4 },
    { lookupType: 'NATIONALITY', code: 'IN', label: 'Indian', sortOrder: 1 },
    {
      lookupType: 'ADMISSION_STATUS',
      code: 'ACTIVE',
      label: 'Active',
      sortOrder: 1,
    },
    {
      lookupType: 'ADMISSION_STATUS',
      code: 'PENDING',
      label: 'Pending',
      sortOrder: 2,
    },
    {
      lookupType: 'ADMISSION_STATUS',
      code: 'CANCELLED',
      label: 'Cancelled',
      sortOrder: 3,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'TEACHING',
      label: 'Teaching',
      sortOrder: 1,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'NON_TEACHING',
      label: 'Non Teaching',
      sortOrder: 2,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'ADMIN',
      label: 'Administrative',
      sortOrder: 3,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'GUEST',
      label: 'Guest Faculty',
      sortOrder: 4,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'VISITING',
      label: 'Visiting Faculty',
      sortOrder: 5,
    },
    {
      lookupType: 'STAFF_TYPE',
      code: 'CONTRACT',
      label: 'Contract Staff',
      sortOrder: 6,
    },
    {
      lookupType: 'EMPLOYMENT_TYPE',
      code: 'PERMANENT',
      label: 'Permanent',
      sortOrder: 1,
    },
    {
      lookupType: 'EMPLOYMENT_TYPE',
      code: 'CONTRACT',
      label: 'Contract',
      sortOrder: 2,
    },
    {
      lookupType: 'EMPLOYMENT_TYPE',
      code: 'GUEST',
      label: 'Guest',
      sortOrder: 3,
    },
    {
      lookupType: 'EMPLOYMENT_TYPE',
      code: 'VISITING',
      label: 'Visiting',
      sortOrder: 4,
    },
    {
      lookupType: 'STAFF_STATUS',
      code: 'ACTIVE',
      label: 'Active',
      sortOrder: 1,
    },
    {
      lookupType: 'STAFF_STATUS',
      code: 'ON_LEAVE',
      label: 'On Leave',
      sortOrder: 2,
    },
    {
      lookupType: 'STAFF_STATUS',
      code: 'RETIRED',
      label: 'Retired',
      sortOrder: 3,
    },
    {
      lookupType: 'STAFF_STATUS',
      code: 'RELIEVED',
      label: 'Relieved',
      sortOrder: 4,
    },
    {
      lookupType: 'STAFF_STATUS',
      code: 'SUSPENDED',
      label: 'Suspended',
      sortOrder: 5,
    },
    {
      lookupType: 'STUDENT_STATUS',
      code: 'STUDYING',
      label: 'Studying',
      sortOrder: 1,
    },
    {
      lookupType: 'STUDENT_STATUS',
      code: 'ALUMNI',
      label: 'Alumni',
      sortOrder: 2,
    },
    {
      lookupType: 'ADMISSION_TYPE',
      code: 'REGULAR',
      label: 'Regular',
      sortOrder: 1,
    },
    {
      lookupType: 'ADMISSION_TYPE',
      code: 'LATERAL',
      label: 'Lateral Entry',
      sortOrder: 2,
    },
    { lookupType: 'GENDER', code: 'MALE', label: 'Male', sortOrder: 1 },
    { lookupType: 'GENDER', code: 'FEMALE', label: 'Female', sortOrder: 2 },
    { lookupType: 'GENDER', code: 'OTHER', label: 'Other', sortOrder: 3 },
    { lookupType: 'NEP_CATEGORY', code: 'MAJOR', label: 'Major', sortOrder: 1 },
    { lookupType: 'NEP_CATEGORY', code: 'MDC', label: 'MDC', sortOrder: 2 },
    { lookupType: 'NEP_CATEGORY', code: 'AEC', label: 'AEC', sortOrder: 3 },
    { lookupType: 'NEP_CATEGORY', code: 'SEC', label: 'SEC', sortOrder: 4 },
    { lookupType: 'NEP_CATEGORY', code: 'VAC', label: 'VAC', sortOrder: 5 },
    {
      lookupType: 'PROGRAMME_TYPE',
      code: 'UG',
      label: 'Undergraduate',
      sortOrder: 1,
    },
    {
      lookupType: 'PROGRAMME_MODE',
      code: 'REGULAR',
      label: 'Regular',
      sortOrder: 1,
    },
    { lookupType: 'BOARD_NAME', code: 'MBOSE', label: 'MBOSE', sortOrder: 1 },
    { lookupType: 'BOARD_NAME', code: 'CBSE', label: 'CBSE', sortOrder: 2 },
    { lookupType: 'BOARD_NAME', code: 'ISC', label: 'ISC', sortOrder: 3 },
    {
      lookupType: 'BOARD_NAME',
      code: 'STATE',
      label: 'State Board',
      sortOrder: 4,
    },
  ];

  for (const d of lookupDefaults) {
    await prisma.masterLookup.upsert({
      where: {
        tenantId_lookupType_code: {
          tenantId: tenant.id,
          lookupType: d.lookupType,
          code: d.code,
        },
      },
      create: { tenantId: tenant.id, ...d },
      update: { label: d.label, sortOrder: d.sortOrder, isActive: true },
    });
  }

  const boardSubjectDefaults = [
    {
      subjectCode: 'ENG',
      subjectName: 'English',
      category: 'LANGUAGE',
      sortOrder: 1,
    },
    {
      subjectCode: 'ALT_ENG',
      subjectName: 'Alternative English',
      category: 'LANGUAGE',
      sortOrder: 2,
    },
    {
      subjectCode: 'MIL',
      subjectName: 'MIL',
      category: 'LANGUAGE',
      sortOrder: 3,
    },
    {
      subjectCode: 'GARO',
      subjectName: 'Garo',
      category: 'LANGUAGE',
      sortOrder: 4,
    },
    {
      subjectCode: 'KHASI',
      subjectName: 'Khasi',
      category: 'LANGUAGE',
      sortOrder: 5,
    },
    {
      subjectCode: 'HINDI',
      subjectName: 'Hindi',
      category: 'LANGUAGE',
      sortOrder: 6,
    },
    {
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      category: 'SCIENCE',
      sortOrder: 7,
    },
    {
      subjectCode: 'PHY',
      subjectName: 'Physics',
      category: 'SCIENCE',
      sortOrder: 8,
    },
    {
      subjectCode: 'CHEM',
      subjectName: 'Chemistry',
      category: 'SCIENCE',
      sortOrder: 9,
    },
    {
      subjectCode: 'BIO',
      subjectName: 'Biology',
      category: 'SCIENCE',
      sortOrder: 10,
    },
    {
      subjectCode: 'BOT',
      subjectName: 'Botany',
      category: 'SCIENCE',
      sortOrder: 11,
    },
    {
      subjectCode: 'ZOO',
      subjectName: 'Zoology',
      category: 'SCIENCE',
      sortOrder: 12,
    },
    {
      subjectCode: 'ECO',
      subjectName: 'Economics',
      category: 'ARTS',
      sortOrder: 13,
    },
    {
      subjectCode: 'EDU',
      subjectName: 'Education',
      category: 'ARTS',
      sortOrder: 14,
    },
    {
      subjectCode: 'GEO',
      subjectName: 'Geography',
      category: 'ARTS',
      sortOrder: 15,
    },
    {
      subjectCode: 'HIS',
      subjectName: 'History',
      category: 'ARTS',
      sortOrder: 16,
    },
    {
      subjectCode: 'POL',
      subjectName: 'Political Science',
      category: 'ARTS',
      sortOrder: 17,
    },
    {
      subjectCode: 'SOC',
      subjectName: 'Sociology',
      category: 'ARTS',
      sortOrder: 18,
    },
    {
      subjectCode: 'CS',
      subjectName: 'Computer Science',
      category: 'VOCATIONAL',
      sortOrder: 19,
    },
    {
      subjectCode: 'ACC',
      subjectName: 'Accountancy',
      category: 'COMMERCE',
      sortOrder: 20,
    },
    {
      subjectCode: 'BST',
      subjectName: 'Business Studies',
      category: 'COMMERCE',
      sortOrder: 21,
    },
    {
      subjectCode: 'ENT',
      subjectName: 'Entrepreneurship',
      category: 'COMMERCE',
      sortOrder: 22,
    },
    {
      subjectCode: 'EVS',
      subjectName: 'Environmental Studies',
      category: 'GENERAL',
      sortOrder: 23,
    },
    {
      subjectCode: 'STAT',
      subjectName: 'Statistics',
      category: 'SCIENCE',
      sortOrder: 24,
    },
  ];

  for (const subject of boardSubjectDefaults) {
    await prisma.supportBoardSubject.upsert({
      where: {
        tenantId_subjectCode: {
          tenantId: tenant.id,
          subjectCode: subject.subjectCode,
        },
      },
      create: { tenantId: tenant.id, boardType: 'GENERAL', ...subject },
      update: {
        subjectName: subject.subjectName,
        category: subject.category,
        sortOrder: subject.sortOrder,
        isActive: true,
      },
    });
  }

  await seedNehuFyugpTemplate(tenant.id, adminUser.id);
  await seedDonBoscoFeeCycles(prisma, tenant.id, adminUser.id);
  await seedDonBoscoMonthlyPlans(prisma, tenant.id);
  const governanceSeed = await seedDbcCommittees(
    prisma,
    tenant.id,
    adminUser.id,
  );
  console.log(
    'Governance committees seeded:',
    governanceSeed.committeeCount,
    'committees,',
    governanceSeed.memberCount,
    'ex-officio members',
  );
  const naacSeed = await seedNaacIqac(prisma, tenant.id);
  console.log(
    'NAAC & IQAC seeded:',
    naacSeed.criterionCount,
    'criteria,',
    naacSeed.metricCount,
    'metrics, AQAR:',
    naacSeed.aqarId,
  );
  await seedCategoryPools(tenant.id, institution.id, adminUser.id);
  const fyugpRules = await seedDbcFyugpRules(prisma, tenant.id, institution.id);
  console.log(
    'FYUGP major/minor rules seeded:',
    fyugpRules.subjectCount,
    'subject paths',
  );

  await seedTenantLicensing(tenant.id, adminUser.id, passwordHash);

  console.log(
    'Seed completed. Tenant:',
    tenant.slug,
    'Admin:',
    adminUser.email,
    '/ Admin@123',
  );
}

async function seedTenantLicensing(
  demoTenantId: string,
  adminUserId: string,
  passwordHash: string,
) {
  const start = new Date();
  const expiry = new Date(start);
  expiry.setFullYear(expiry.getFullYear() + 1);

  await prisma.tenantLicense.upsert({
    where: { tenantId: demoTenantId },
    update: {},
    create: {
      tenantId: demoTenantId,
      licenseNumber: 'BCL-2026-0001',
      licenseType: 'ANNUAL_1Y',
      subscriptionPlan: 'Annual License',
      startDate: start,
      expiryDate: expiry,
      gracePeriodDays: 15,
      maxStudents: 5000,
      maxStaff: 500,
      storageLimitMb: 10240,
      createdById: adminUserId,
    },
  });

  const basecodeTenant = await prisma.tenant.upsert({
    where: { slug: 'basecode' },
    update: { name: 'BaseCode Labs Pvt. Ltd.' },
    create: {
      name: 'BaseCode Labs Pvt. Ltd.',
      slug: 'basecode',
      status: 'active',
    },
  });

  await prisma.tenantDomain.upsert({
    where: { host: 'basecode.localhost' },
    update: { tenantId: basecodeTenant.id, verified: true },
    create: {
      tenantId: basecodeTenant.id,
      host: 'basecode.localhost',
      verified: true,
    },
  });

  const platformPerms = [
    'platform:licenses:read',
    'platform:licenses:manage',
    'notifications:read',
  ];
  const allPerms = await prisma.permission.findMany();

  const platformRole = await prisma.role.upsert({
    where: {
      tenantId_slug: { tenantId: basecodeTenant.id, slug: 'platform-admin' },
    },
    update: { name: 'Platform Admin' },
    create: {
      tenantId: basecodeTenant.id,
      slug: 'platform-admin',
      name: 'Platform Admin',
      isSystem: true,
    },
  });

  await prisma.rolePermission.deleteMany({
    where: { roleId: platformRole.id },
  });
  for (const slug of platformPerms) {
    const perm = allPerms.find((p) => p.slug === slug);
    if (perm) {
      await prisma.rolePermission.create({
        data: { roleId: platformRole.id, permissionId: perm.id },
      });
    }
  }

  const platformUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: basecodeTenant.id,
        email: 'platform@basecodelabs.com',
      },
    },
    update: { passwordHash, isActive: true },
    create: {
      tenantId: basecodeTenant.id,
      email: 'platform@basecodelabs.com',
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
      displayName: 'Platform Operator',
    },
  });

  await prisma.userRole.deleteMany({
    where: { userId: platformUser.id, roleId: platformRole.id },
  });
  await prisma.userRole.create({
    data: { userId: platformUser.id, roleId: platformRole.id },
  });

  console.log(
    'Platform tenant:',
    basecodeTenant.slug,
    'User:',
    platformUser.email,
    '/ Admin@123',
  );

  await seedLicenseNotificationTemplates(demoTenantId, adminUserId);
  await seedBackupNotificationTemplates(demoTenantId, adminUserId);
  await seedBackupDefaults();

  await prisma.licenseActivationKey.upsert({
    where: { activationKey: 'BCLK-DEMO-2026-0001-KEY1' },
    update: { status: 'PENDING' },
    create: {
      activationKey: 'BCLK-DEMO-2026-0001-KEY1',
      label: 'Demo 1-year renewal key',
      licenseType: 'ANNUAL_1Y',
      subscriptionPlan: 'Annual License',
      termDays: 365,
      gracePeriodDays: 15,
      maxStudents: 5000,
      maxStaff: 500,
      storageLimitMb: 10240,
      createdById: adminUserId,
    },
  });
  console.log(
    'Sample license key: BCLK-DEMO-2026-0001-KEY1 (365-day extension)',
  );

  await promoteOwnerSuperAdmin('johnsathish16@gmail.com');
  await seedCampusAccessDemo(tenant.id);
}

async function seedCampusAccessDemo(tenantId: string) {
  const existing = await prisma.accessPoint.findFirst({
    where: { tenantId, code: 'library', deletedAt: null },
  });
  if (existing) return;

  const { createHash, randomBytes } = await import('crypto');
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const prefix = token.slice(0, 8);
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  const point = await prisma.accessPoint.create({
    data: {
      tenantId,
      code: 'library',
      name: 'Library Entry Gate',
      accessType: 'LIBRARY',
      location: 'Main Library Entrance',
      blockOnFine: false,
      voiceEnabled: true,
    },
  });
  await prisma.accessKioskDevice.create({
    data: {
      tenantId,
      accessPointId: point.id,
      name: 'Library Scanner 1',
      tokenHash: hash,
      tokenPrefix: prefix,
    },
  });
  console.log(
    'CAMS library kiosk:',
    `${origin.replace(/\/$/, '')}/kiosk/library?token=${token}`,
  );
}

async function promoteOwnerSuperAdmin(email: string) {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
    },
  });
  if (!user) return;

  const superAdminRole = await prisma.role.findFirst({
    where: { tenantId: user.tenantId, slug: 'super-admin', deletedAt: null },
  });
  const collegeAdminRole = await prisma.role.findFirst({
    where: { tenantId: user.tenantId, slug: 'college-admin', deletedAt: null },
  });
  if (!superAdminRole && !collegeAdminRole) return;

  const facultyRole = await prisma.role.findFirst({
    where: { tenantId: user.tenantId, slug: 'faculty', deletedAt: null },
  });
  if (facultyRole) {
    await prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: facultyRole.id },
    });
  }

  for (const role of [superAdminRole, collegeAdminRole].filter(Boolean)) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role!.id, deletedAt: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role!.id },
      });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: true,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  console.log('Owner super-admin:', email);
}

const LICENSE_NOTIFICATION_TEMPLATES = [
  {
    code: 'LICENSE_EXPIRY_60',
    name: 'License Expiry — 60 Days',
    subject: 'ERP license renewal reminder — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Please contact {{renewal_contact}} to renew.</p>',
    bodyText:
      'ERP license for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
  },
  {
    code: 'LICENSE_EXPIRY_30',
    name: 'License Expiry — 30 Days',
    subject: 'ERP license expires in 30 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Contact {{renewal_contact}}.</p>',
    bodyText:
      'License for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
  },
  {
    code: 'LICENSE_EXPIRY_15',
    name: 'License Expiry — 15 Days',
    subject: 'Urgent: ERP license expires in 15 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p><strong>Urgent:</strong> Your ERP license expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Contact {{renewal_contact}}.</p>',
    bodyText:
      'Urgent: License expires {{expiry_date}}. Contact {{renewal_contact}}.',
  },
  {
    code: 'LICENSE_EXPIRY_7',
    name: 'License Expiry — 7 Days',
    subject: 'Critical: ERP license expires in 7 days — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p><strong>Critical:</strong> Your ERP license expires on {{expiry_date}} ({{days_remaining}} days remaining).</p><p>Contact {{renewal_contact}}.</p>',
    bodyText:
      'Critical: License expires {{expiry_date}}. Contact {{renewal_contact}}.',
  },
  {
    code: 'LICENSE_EXPIRY_0',
    name: 'License Expired',
    subject: 'ERP license expired — {{institution_name}}',
    bodyHtml:
      '<p>Dear administrator,</p><p>Your ERP license for <strong>{{institution_name}}</strong> has expired.</p><p>Contact {{renewal_contact}} immediately.</p>',
    bodyText: 'License expired. Contact {{renewal_contact}}.',
  },
];

async function seedBackupDefaults() {
  await prisma.backupRetentionPolicy.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', keepDays: 30, autoCleanupEnabled: true },
    update: {},
  });
  await prisma.systemMaintenanceFlag.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', active: false },
    update: {},
  });
  const existingSchedule = await prisma.backupSchedule.findFirst({
    where: { tenantId: null },
  });
  if (!existingSchedule) {
    const tomorrow2am = new Date();
    tomorrow2am.setUTCDate(tomorrow2am.getUTCDate() + 1);
    tomorrow2am.setUTCHours(2, 0, 0, 0);
    await prisma.backupSchedule.create({
      data: {
        frequency: 'DAILY',
        backupType: 'DATABASE_DOCUMENTS',
        enabled: true,
        nextRunAt: tomorrow2am,
      },
    });
  }
  for (const provider of ['AWS_S3', 'BACKBLAZE_B2'] as const) {
    await prisma.backupCloudTarget.upsert({
      where: { provider },
      create: { provider, bucket: '', enabled: false },
      update: {},
    });
  }
}

const BACKUP_NOTIFICATION_TEMPLATES = [
  {
    code: 'BACKUP_SUCCESS',
    name: 'Backup Completed Successfully',
    subject: 'Backup completed — {{institution_name}}',
    bodyHtml:
      '<p>Backup <strong>{{backup_type}}</strong> completed successfully at {{completed_at}}.</p><p>Size: {{size_bytes}} · Run ID: {{run_id}}</p>',
    bodyText:
      'Backup {{backup_type}} completed at {{completed_at}}. Size: {{size_bytes}}. Run: {{run_id}}',
  },
  {
    code: 'BACKUP_FAILED',
    name: 'Backup Failed',
    subject: 'Backup failed — {{institution_name}}',
    bodyHtml:
      '<p>Backup <strong>{{backup_type}}</strong> failed at {{completed_at}}.</p><p>Error: {{error_message}}</p><p>Run ID: {{run_id}}</p>',
    bodyText:
      'Backup {{backup_type}} failed at {{completed_at}}. Error: {{error_message}}. Run: {{run_id}}',
  },
];

async function seedBackupNotificationTemplates(
  tenantId: string,
  createdById: string,
) {
  for (const tpl of BACKUP_NOTIFICATION_TEMPLATES) {
    await prisma.communicationTemplate.upsert({
      where: { tenantId_code: { tenantId, code: tpl.code } },
      create: {
        tenantId,
        code: tpl.code,
        name: tpl.name,
        category: 'GENERAL',
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        variables: [
          'institution_name',
          'backup_type',
          'completed_at',
          'size_bytes',
          'run_id',
          'error_message',
        ],
        channels: ['EMAIL', 'IN_APP'],
        createdById,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
      },
    });
  }
}

async function seedLicenseNotificationTemplates(
  tenantId: string,
  createdById: string,
) {
  for (const tpl of LICENSE_NOTIFICATION_TEMPLATES) {
    await prisma.communicationTemplate.upsert({
      where: { tenantId_code: { tenantId, code: tpl.code } },
      create: {
        tenantId,
        code: tpl.code,
        name: tpl.name,
        category: 'GENERAL',
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        variables: [
          'institution_name',
          'expiry_date',
          'days_remaining',
          'renewal_contact',
        ],
        channels: ['EMAIL', 'IN_APP'],
        createdById,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
      },
    });
  }
}

async function seedCategoryPools(
  tenantId: string,
  institutionId: string,
  createdById?: string,
) {
  const poolDefs = [
    {
      poolName: 'MDC Semester 1 Pool',
      semesterNo: 1,
      categoryType: 'MDC',
      courseCodes: ['MDC101'],
    },
    {
      poolName: 'AEC Semester 1 Pool',
      semesterNo: 1,
      categoryType: 'AEC',
      courseCodes: ['AEC-ENG'],
    },
    {
      poolName: 'SEC Semester 1 Pool',
      semesterNo: 1,
      categoryType: 'SEC',
      courseCodes: ['SEC-PY'],
    },
    {
      poolName: 'VAC Semester 1 Pool',
      semesterNo: 1,
      categoryType: 'VAC',
      courseCodes: ['VAC-ENV'],
    },
  ] as const;

  const ugVersions = await prisma.programVersion.findMany({
    where: {
      tenantId,
      deletedAt: null,
      program: { level: 'UG' },
    },
    select: { id: true },
  });

  for (const def of poolDefs) {
    const pool = await prisma.categoryPool.upsert({
      where: {
        tenantId_institutionId_poolName: {
          tenantId,
          institutionId,
          poolName: def.poolName,
        },
      },
      create: {
        tenantId,
        institutionId,
        poolName: def.poolName,
        semesterNo: def.semesterNo,
        categoryType: def.categoryType,
        active: true,
        createdById,
      },
      update: {
        active: true,
        semesterNo: def.semesterNo,
        categoryType: def.categoryType,
      },
    });

    let order = 0;
    for (const code of def.courseCodes) {
      const course = await prisma.course.findFirst({
        where: { tenantId, code, deletedAt: null },
      });
      if (!course) continue;

      await prisma.categoryPoolCourse.upsert({
        where: { poolId_courseId: { poolId: pool.id, courseId: course.id } },
        create: {
          poolId: pool.id,
          courseId: course.id,
          displayOrder: order++,
          active: true,
        },
        update: { active: true, displayOrder: order - 1 },
      });

      await prisma.courseOffering.upsert({
        where: {
          categoryPoolId_courseId: {
            categoryPoolId: pool.id,
            courseId: course.id,
          },
        },
        create: {
          tenantId,
          categoryPoolId: pool.id,
          mappingSource: 'SHARED_POOL',
          courseId: course.id,
          semesterSequence: def.semesterNo,
          category: def.categoryType,
          displayOrder: order - 1,
          programVersionId: null,
        },
        update: {
          deletedAt: null,
          semesterSequence: def.semesterNo,
          category: def.categoryType,
        },
      });
    }

    for (const version of ugVersions) {
      await prisma.programmePoolAssignment.upsert({
        where: {
          programVersionId_semesterNo_poolId: {
            programVersionId: version.id,
            semesterNo: def.semesterNo,
            poolId: pool.id,
          },
        },
        create: {
          tenantId,
          programVersionId: version.id,
          semesterNo: def.semesterNo,
          poolId: pool.id,
          active: true,
        },
        update: { active: true },
      });
    }
  }

  // Use require here because this seed file is outside src and typecheck uses NodeNext resolution.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    PoolSectionProvisioningService,
  } = require('../src/modules/academic-engine/services/pool-section-provisioning.service');
  const poolProvisioner = new PoolSectionProvisioningService(prisma as never);
  await poolProvisioner.provisionPoolOfferings(tenantId, {
    semesterNo: 1,
    categories: ['MDC', 'AEC', 'SEC', 'VAC'],
    shiftCode: 'DAY',
  });

  if (ugVersions.length) {
    await prisma.courseOffering.updateMany({
      where: {
        tenantId,
        mappingSource: 'DIRECT',
        semesterSequence: 1,
        category: { in: ['MDC', 'AEC', 'SEC', 'VAC'] },
        programVersionId: { in: ugVersions.map((v) => v.id) },
      },
      data: { deletedAt: new Date() },
    });
  }
}

async function seedNehuFyugpTemplate(tenantId: string, createdById?: string) {
  const existing = await prisma.fyugpStructureTemplate.findFirst({
    where: { tenantId, templateName: NEHU_FYUGP_DEFAULT_TEMPLATE_NAME },
  });
  if (existing) {
    await prisma.fyugpStructureTemplateLine.deleteMany({
      where: { templateId: existing.id },
    });
    await prisma.fyugpStructureTemplateLine.createMany({
      data: defaultNehuTemplateLines().map((line) => ({
        templateId: existing.id,
        semesterNo: line.semesterNo,
        categoryType: line.categoryType,
        subjectCount: line.subjectCount,
        continuityRule: line.continuityRule ?? null,
        creditRule: line.creditRule ?? null,
        optionalFlag: line.optionalFlag ?? false,
      })),
    });
    await prisma.fyugpStructureTemplate.update({
      where: { id: existing.id },
      data: {
        totalSemesters: DEFAULT_NEHU_TOTAL_SEMESTERS,
        regulationYear: 2026,
        active: true,
      },
    });
    return existing;
  }

  return prisma.fyugpStructureTemplate.create({
    data: {
      tenantId,
      templateName: NEHU_FYUGP_DEFAULT_TEMPLATE_NAME,
      regulationYear: 2026,
      programmeLevel: 'UG',
      totalSemesters: DEFAULT_NEHU_TOTAL_SEMESTERS,
      active: true,
      createdById,
      lines: {
        create: defaultNehuTemplateLines().map((line) => ({
          semesterNo: line.semesterNo,
          categoryType: line.categoryType,
          subjectCount: line.subjectCount,
          continuityRule: line.continuityRule ?? null,
          creditRule: line.creditRule ?? null,
          optionalFlag: line.optionalFlag ?? false,
        })),
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
