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
            pathname: `/../../web/.next/types/app/admin/naac/page`;
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
            pathname: `/../../web/.next/types/app/admin/naac/page`;
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
        | `/../../web/.next/types/app/admin/naac/page${`?${string}` | `#${string}` | ''}`
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
            pathname: `/../../web/.next/types/app/admin/naac/page`;
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
