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
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/administration/support-data/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-generation-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-history-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-reports-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-history/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-reports/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/admin/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/admit-cards/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/internal-assessments/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/timetable/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/consolidation/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          };
      hrefOutputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownOutputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownOutputParams }
        | { pathname: `/`; params?: Router.UnknownOutputParams }
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/administration/support-data/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-generation-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-history-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-reports-page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-history/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-reports/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../../web/.next/types/app/admin/page`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/admit-cards/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/internal-assessments/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/timetable/page`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/consolidation/page`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownOutputParams;
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/login/layout${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/login/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/administration/support-data/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/api/[...path]/route${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/administration-module/roll-number-generation-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/administration-module/roll-number-history-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/components/administration-module/roll-number-reports-page${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/roll-number-history/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/validator${`?${string}` | `#${string}` | ''}`
        | `/../../web/app/admin/administration/roll-number-reports/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/academics/examinations/admit-cards/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/academics/examinations/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/academics/examinations/internal-assessments/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/academics/examinations/timetable/page${`?${string}` | `#${string}` | ''}`
        | `/../../web/.next/types/app/admin/academics/examinations/consolidation/page${`?${string}` | `#${string}` | ''}`
        | `/_sitemap${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/login${`?${string}` | `#${string}` | ''}`
        | `/login${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/maintenance${`?${string}` | `#${string}` | ''}`
        | `/maintenance${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${`?${string}` | `#${string}` | ''}`
        | `/${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/attendance${`?${string}` | `#${string}` | ''}`
        | `/attendance${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/fees${`?${string}` | `#${string}` | ''}`
        | `/fees${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${`?${string}` | `#${string}` | ''}`
        | `/${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/notifications${`?${string}` | `#${string}` | ''}`
        | `/notifications${`?${string}` | `#${string}` | ''}`
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | { pathname: `/../../web/.next/types/app/layout`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/layout`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/login/layout`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/login/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/administration/support-data/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/api/[...path]/route`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-generation-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-history-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/components/administration-module/roll-number-reports-page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-history/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/validator`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/app/admin/administration/roll-number-reports/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../../web/.next/types/app/admin/page`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/admit-cards/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/internal-assessments/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/timetable/page`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../web/.next/types/app/admin/academics/examinations/consolidation/page`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/login` | `/login`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/maintenance` | `/maintenance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(student)'}/fees` | `/fees`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          };
    }
  }
}
