/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/utils/currency`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/payments/checkout`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/token-refresh`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/device`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/notifications`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/notifications`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/api/config`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/hooks/useAuthFailureRedirect`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/constants/payment-source.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/services/external-fee-payment.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/external-payment-entry-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/external-payments/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-reconciliation-panel`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/fees/constants/collection-modes.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-cash-register-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/cash-register/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports-center`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/operations-command-center`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/analytics/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/fees-module/student-fee-portal`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/templates/fee-receipt.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../worker/src/lib/fee-receipt.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/student/fees/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/command-center-ui`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/dashboard-analytics/dto/ai-ask.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/monthly-fee-setup-guide`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/bulk-receipt-print-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/dashboard-ai-assistant`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/config/command-palette-items`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/constants/governance.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-prisma.util`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/dto/governance.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-dashboard.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-committee.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-member.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-meeting.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-attendance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-mom.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-atr.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-task.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notice.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-document.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-event.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-naac.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-mom.template`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/types/governance`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-report.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-pdf.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-settings.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notification.service`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/services/governance`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-report.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-analytics.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-performance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/import-review-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-import.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-reports-center`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-portal-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance-portal.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seeds/seed-dbc-committees`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/governance/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/governance/attendance/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/analytics/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/calendar/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/committees/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/events/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/atr/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/documents/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/members/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/meetings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/naac/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/notices/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/settings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/tasks/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/reports/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/staff/governance/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/student/governance/notices/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/student/governance/meetings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-member-picker`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-governance-import`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../api/prisma/seeds/seed-naac-iqac`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/naac-iqac/constants/naac.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-prisma.util`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/dto/naac-iqac.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dashboard.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-criteria.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-evidence.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-vault.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aggregator.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aqar.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-achievement.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-department.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-integration.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dvv.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-report.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac-portal.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.module`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/types/naac-iqac`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/services/naac-iqac`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-page-shell`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/criteria/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/evidence/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/vault/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/aqar/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/department/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/faculty/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/student/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/mous/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/iqac/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/dvv/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/calendar/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/reports/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/settings/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/staff/naac/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../api/scripts/verify-naac-iqac`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/types/naac-evidence`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-upload-form`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-fields`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-evidence-tag-button`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar-notify.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-department-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/achievement-form-fields`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-faculty-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-student-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-aqar-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-mou-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-calendar-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-settings-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/dto/teaching-subject-group.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/services/teaching-subject-groups`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/academics/teaching-subject-groups/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable-runner`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-subject-group-attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-timetable-subject-groups`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation-runner`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/dto/backup.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-audit.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-crypto.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/system-maintenance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-database.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-files.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-settings-export.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/tenant-backup-export.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-verify.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-cloud-sync.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-retention.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-restore.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-run-executor.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-notification.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-orchestrator.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-scheduler.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/processors/backup-run.processor`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../worker/src/jobs/backup/shared`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../worker/src/jobs/backup/backup-run`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/services/backup`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/backup-module/backup-dashboard-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-schedule-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-restore-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-cloud-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-logs-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-disaster-recovery-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/schedule/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/manual/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/cloud/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/logs/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/disaster-recovery/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-utils`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-dialog`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-table`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/committee-members-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-committee-memberships-section`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/students/services/student-abc.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/students-module/abc-bulk/abc-id-bulk-upload-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/students/abc-upload/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownInputParams };
      hrefOutputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownOutputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownOutputParams }
        | { pathname: `/`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/types/fees`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/utils/currency`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/fees`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/payments/checkout`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/auth/token-refresh`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/auth/device`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/types/attendance`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/types/notifications`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/attendance`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/notifications`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/api/config`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/hooks/useAuthFailureRedirect`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/constants/payment-source.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/services/external-fee-payment.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/external-payment-entry-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/external-payments/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-reconciliation-panel`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../api/src/modules/fees/constants/collection-modes.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-cash-register-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/cash-register/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports-center`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/operations-command-center`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/admin/analytics/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/components/fees-module/student-fee-portal`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/templates/fee-receipt.template`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../worker/src/lib/fee-receipt.template`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/student/fees/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/command-center-ui`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/dashboard-analytics/dto/ai-ask.dto`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/monthly-fee-setup-guide`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/bulk-receipt-print-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/dashboard-ai-assistant`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/config/command-palette-items`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/constants/governance.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-prisma.util`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/dto/governance.dto`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-dashboard.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-committee.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-member.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-meeting.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-attendance.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-mom.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-atr.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-task.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notice.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-document.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-event.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-naac.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-mom.template`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/types/governance`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-report.template`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-pdf.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-settings.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notification.service`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/services/governance`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-report.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-analytics.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-performance.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/import-review-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-import.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-reports-center`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-portal-workspace`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.controller`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance-portal.controller`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.module`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-workspace`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seeds/seed-dbc-committees`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/admin/governance/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/admin/governance/attendance/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/analytics/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/calendar/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/committees/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/events/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/atr/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/documents/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/members/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/meetings/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/naac/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/notices/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/settings/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/tasks/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/reports/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/staff/governance/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/student/governance/notices/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/student/governance/meetings/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-member-picker`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-governance-import`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seeds/seed-naac-iqac`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/constants/naac.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-prisma.util`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/dto/naac-iqac.dto`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dashboard.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-criteria.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-evidence.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-vault.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aggregator.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aqar.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-achievement.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-department.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-integration.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dvv.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-report.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.controller`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac-portal.controller`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.module`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/types/naac-iqac`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/services/naac-iqac`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-workspace`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-page-shell`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/admin/naac/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/admin/naac/criteria/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/evidence/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/admin/naac/vault/page`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/app/admin/naac/aqar/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/admin/naac/department/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/faculty/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/student/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/admin/naac/mous/page`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/app/admin/naac/iqac/page`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/app/admin/naac/dvv/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/admin/naac/calendar/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/reports/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/settings/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/app/staff/naac/page`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../api/scripts/verify-naac-iqac`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/types/naac-evidence`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-upload-form`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-fields`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-evidence-tag-button`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar-notify.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-department-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/achievement-form-fields`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-faculty-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-student-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-aqar-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-mou-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-calendar-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-settings-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/dto/teaching-subject-group.dto`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.module`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/services/teaching-subject-groups`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/academics/teaching-subject-groups/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable-runner`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-subject-group-attendance`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-timetable-subject-groups`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation-runner`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup.constants`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/dto/backup.dto`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-audit.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-crypto.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/system-maintenance.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-database.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-files.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-settings-export.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/tenant-backup-export.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-verify.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-cloud-sync.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-retention.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-restore.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-run-executor.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-notification.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-orchestrator.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-scheduler.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.controller`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.module`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/processors/backup-run.processor`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../worker/src/jobs/backup/shared`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../worker/src/jobs/backup/backup-run`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/services/backup`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/components/backup-module/backup-dashboard-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-schedule-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-restore-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-cloud-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-logs-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-disaster-recovery-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/schedule/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/manual/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/cloud/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/logs/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/disaster-recovery/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-utils`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-dialog`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-table`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/committee-members-workspace`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-committee-memberships-section`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../api/src/modules/students/services/student-abc.service`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/students-module/abc-bulk/abc-id-bulk-upload-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/students/abc-upload/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownOutputParams };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/${`?${string}` | `#${string}` | ''}`
        | `/../src/types/fees${`?${string}` | `#${string}` | ''}`
        | `/../src/utils/currency${`?${string}` | `#${string}` | ''}`
        | `/../src/services/fees${`?${string}` | `#${string}` | ''}`
        | `/../src/payments/checkout${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/fees${`?${string}` | `#${string}` | ''}`
        | `/fees${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/token-refresh${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/device${`?${string}` | `#${string}` | ''}`
        | `/../src/types/attendance${`?${string}` | `#${string}` | ''}`
        | `/../src/types/notifications${`?${string}` | `#${string}` | ''}`
        | `/../src/services/attendance${`?${string}` | `#${string}` | ''}`
        | `/../src/services/notifications${`?${string}` | `#${string}` | ''}`
        | `/../src/api/config${`?${string}` | `#${string}` | ''}`
        | `/../src/hooks/useAuthFailureRedirect${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/attendance${`?${string}` | `#${string}` | ''}`
        | `/attendance${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/notifications${`?${string}` | `#${string}` | ''}`
        | `/notifications${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/fees/constants/payment-source.constants${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/fees/services/external-fee-payment.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/external-payment-entry-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/fees/external-payments/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/fee-reconciliation-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/validator${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/fees/constants/collection-modes.constants${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/fee-cash-register-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/fees/cash-register/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/login/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/login/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/api/[...path]/route${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/financial-reports.constants${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/financial-reports-center${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/dashboard/operations-command-center${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/analytics/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/student-fee-portal${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/fees/templates/fee-receipt.template${`?${string}` | `#${string}` | ''}`
        | `/../../worker/src/lib/fee-receipt.template${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/student/fees/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/dashboard/command-center-ui${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/dashboard-analytics/dto/ai-ask.dto${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/monthly-fee-setup-guide${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/fees-module/bulk-receipt-print-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/dashboard/dashboard-ai-assistant${`?${string}` | `#${string}` | ''}`
        | `/../../web/config/command-palette-items${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/constants/governance.constants${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-prisma.util${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/dto/governance.dto${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-dashboard.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-committee.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-member.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-meeting.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-attendance.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-mom.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-atr.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-task.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-notice.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-document.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-event.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-naac.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/templates/governance-mom.template${`?${string}` | `#${string}` | ''}`
        | `/../../web/types/governance${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/templates/governance-report.template${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-pdf.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-settings.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-notification.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/services/governance${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-report.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-analytics.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-performance.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/import-review-panel${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/services/governance-import.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/governance-reports-center${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/governance-portal-workspace${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/governance.controller${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/governance-portal.controller${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/governance/governance.module${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/governance-workspace${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seeds/seed-dbc-committees${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/attendance/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/analytics/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/calendar/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/committees/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/events/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/atr/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/documents/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/members/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/meetings/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/naac/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/notices/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/settings/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/tasks/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/governance/reports/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/staff/governance/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/student/governance/notices/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/student/governance/meetings/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/staff-member-picker${`?${string}` | `#${string}` | ''}`
        | `/../../api/scripts/verify-governance-import${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seeds/seed-naac-iqac${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/constants/naac.constants${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-prisma.util${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/dto/naac-iqac.dto${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-dashboard.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-criteria.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-evidence.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-vault.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-aggregator.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-aqar.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-achievement.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-department.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-integration.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-calendar.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-dvv.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-report.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/naac-iqac.controller${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/naac-iqac-portal.controller${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/naac-iqac.module${`?${string}` | `#${string}` | ''}`
        | `/../../web/types/naac-iqac${`?${string}` | `#${string}` | ''}`
        | `/../../web/services/naac-iqac${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-workspace${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-page-shell${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/criteria/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/evidence/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/vault/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/aqar/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/department/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/faculty/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/student/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/mous/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/iqac/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/dvv/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/calendar/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/reports/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/naac/settings/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/staff/naac/page${`?${string}` | `#${string}` | ''}`
        | `/../../api/scripts/verify-naac-iqac${`?${string}` | `#${string}` | ''}`
        | `/../../web/types/naac-evidence${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/evidence-tag-upload-form${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/evidence-tag-fields${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-evidence-tag-button${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/naac-iqac/services/naac-calendar-notify.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-department-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/achievement-form-fields${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-faculty-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-student-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-aqar-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-mou-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-calendar-panel${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/naac-iqac-module/naac-settings-panel${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/timetable-engine/dto/teaching-subject-group.dto${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/timetable-engine/teaching-subject-group.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/timetable-engine/teaching-subject-group.module${`?${string}` | `#${string}` | ''}`
        | `/../../web/services/teaching-subject-groups${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/academics/teaching-subject-groups/page${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seed-arts-shift-ii-timetable${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seed-arts-shift-ii-timetable-runner${`?${string}` | `#${string}` | ''}`
        | `/../../api/scripts/verify-subject-group-attendance${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seed-timetable-subject-groups${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seed-demo-timetable-foundation${`?${string}` | `#${string}` | ''}`
        | `/../../api/prisma/seed-demo-timetable-foundation-runner${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/backup.constants${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/dto/backup.dto${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-audit.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-crypto.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/system-maintenance.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-database.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-files.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-settings-export.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/tenant-backup-export.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-verify.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-cloud-sync.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-retention.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-restore.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-run-executor.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-notification.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-orchestrator.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/services/backup-scheduler.service${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/backup-engine.controller${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/backup-engine.module${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/backup-engine/processors/backup-run.processor${`?${string}` | `#${string}` | ''}`
        | `/../../worker/src/jobs/backup/shared${`?${string}` | `#${string}` | ''}`
        | `/../../worker/src/jobs/backup/backup-run${`?${string}` | `#${string}` | ''}`
        | `/../../web/services/backup${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-dashboard-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-schedule-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-manual-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-repository-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-restore-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-cloud-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-logs-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-disaster-recovery-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/schedule/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/manual/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/cloud/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/logs/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/backups/disaster-recovery/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-utils${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-manual-dialog${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/backup-module/backup-repository-table${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/committee-members-workspace${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/governance-module/staff-committee-memberships-section${`?${string}` | `#${string}` | ''}`
        | `/../../api/src/modules/students/services/student-abc.service${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/students-module/abc-bulk/abc-id-bulk-upload-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/students/abc-upload/page${`?${string}` | `#${string}` | ''}`
        | `/_sitemap${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/login${`?${string}` | `#${string}` | ''}`
        | `/login${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/maintenance${`?${string}` | `#${string}` | ''}`
        | `/maintenance${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${`?${string}` | `#${string}` | ''}`
        | `/${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${`?${string}` | `#${string}` | ''}`
        | `/${`?${string}` | `#${string}` | ''}`
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/utils/currency`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/payments/checkout`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/token-refresh`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/device`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/notifications`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/notifications`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/api/config`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/hooks/useAuthFailureRedirect`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/constants/payment-source.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/services/external-fee-payment.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/external-payment-entry-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/external-payments/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-reconciliation-panel`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/fees/constants/collection-modes.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/fee-cash-register-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/fees/cash-register/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/financial-reports-center`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/operations-command-center`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/analytics/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/fees-module/student-fee-portal`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/fees/templates/fee-receipt.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../worker/src/lib/fee-receipt.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/student/fees/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/command-center-ui`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/dashboard-analytics/dto/ai-ask.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/monthly-fee-setup-guide`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/fees-module/bulk-receipt-print-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/dashboard/dashboard-ai-assistant`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/config/command-palette-items`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/constants/governance.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-prisma.util`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/dto/governance.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-dashboard.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-committee.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-member.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-meeting.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-attendance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-mom.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-atr.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-task.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notice.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-document.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-event.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-naac.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-mom.template`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/types/governance`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/governance/templates/governance-report.template`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-pdf.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-settings.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-notification.service`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/services/governance`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-report.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-analytics.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-performance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/import-review-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/services/governance-import.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-reports-center`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-portal-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance-portal.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/governance/governance.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/governance-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seeds/seed-dbc-committees`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/governance/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/governance/attendance/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/analytics/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/calendar/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/committees/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/events/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/atr/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/documents/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/members/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/meetings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/naac/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/notices/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/settings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/tasks/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/governance/reports/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/staff/governance/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/student/governance/notices/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/student/governance/meetings/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-member-picker`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-governance-import`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../api/prisma/seeds/seed-naac-iqac`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../api/src/modules/naac-iqac/constants/naac.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-prisma.util`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/dto/naac-iqac.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dashboard.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-criteria.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-evidence.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-vault.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aggregator.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-aqar.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-achievement.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-department.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-integration.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-dvv.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-report.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac-portal.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/naac-iqac.module`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/types/naac-iqac`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/services/naac-iqac`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-page-shell`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/criteria/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/naac/evidence/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/vault/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/aqar/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/department/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/faculty/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/student/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/mous/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/iqac/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/app/admin/naac/dvv/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/calendar/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/admin/naac/reports/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/naac/settings/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/app/staff/naac/page`; params?: Router.UnknownInputParams }
        | { pathname: `/../../api/scripts/verify-naac-iqac`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/types/naac-evidence`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-upload-form`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/evidence-tag-fields`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-evidence-tag-button`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/naac-iqac/services/naac-calendar-notify.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-department-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/achievement-form-fields`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-faculty-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-student-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-aqar-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-mou-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-calendar-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/naac-iqac-module/naac-settings-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/dto/teaching-subject-group.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/timetable-engine/teaching-subject-group.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/services/teaching-subject-groups`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/academics/teaching-subject-groups/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-arts-shift-ii-timetable-runner`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/scripts/verify-subject-group-attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-timetable-subject-groups`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/prisma/seed-demo-timetable-foundation-runner`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup.constants`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/dto/backup.dto`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-audit.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-crypto.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/system-maintenance.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-database.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-files.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-settings-export.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/tenant-backup-export.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-verify.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-cloud-sync.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-retention.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-restore.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-run-executor.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-notification.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-orchestrator.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/services/backup-scheduler.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.controller`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/backup-engine.module`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/backup-engine/processors/backup-run.processor`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../worker/src/jobs/backup/shared`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../worker/src/jobs/backup/backup-run`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/services/backup`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/components/backup-module/backup-dashboard-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-schedule-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-restore-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-cloud-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-logs-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-disaster-recovery-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/schedule/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/manual/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/cloud/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/logs/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/backups/disaster-recovery/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-utils`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-manual-dialog`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/backup-module/backup-repository-table`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/committee-members-workspace`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/governance-module/staff-committee-memberships-section`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../api/src/modules/students/services/student-abc.service`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/students-module/abc-bulk/abc-id-bulk-upload-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/students/abc-upload/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownInputParams };
    }
  }
}
