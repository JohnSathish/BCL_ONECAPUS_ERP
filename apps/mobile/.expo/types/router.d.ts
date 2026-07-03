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
        | {
            pathname: `/../src/components/student-portal/theme`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-portal-context`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-drawer`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-tab-bar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-header`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-shell`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/fees` | `/fees`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-avatar`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/components/auth/auth-theme`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/components/auth/captcha-widget`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/faculty-portal/theme`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-portal-context`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-header`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-shell`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-tab-bar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-drawer`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/students` | `/students`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/auth/device-sessions-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/index` | `/marks/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/auth/premium-splash-screen`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../app.config`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/change-password` | `/change-password`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(auth)'}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(auth)'}/guest` | `/guest`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/splash` | `/splash`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/welcome` | `/welcome`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/assignments` | `/assignments`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}/exam-schedule` | `/exam-schedule`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(student)'}/leave` | `/leave`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/library` | `/library`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/results` | `/results`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/timetable` | `/timetable`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}/leave` | `/leave`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(staff)'}/timetable` | `/timetable`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/class-roster/[sectionId]` | `/class-roster/[sectionId]`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/mark-attendance/[sessionId]` | `/mark-attendance/[sessionId]`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/[paperId]` | `/marks/[paperId]`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/auth/identifier-hint`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/login-flow`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/logout`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/role-router`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/academics`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/auth-account`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-leave`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-marks`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-payroll`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-roster`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-timetable`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-dashboard`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-exams`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-leave`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-library`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-lms`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/academics`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/faculty-home`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/utils/upload-asset-url`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/constants/release`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/auth/auth-text-field`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/drawer-menu`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/components/ui/date-field`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/student-portal/drawer-menu`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/utils/password-policy`; params?: Router.UnknownInputParams }
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
        | {
            pathname: `/../src/components/student-portal/theme`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-portal-context`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-drawer`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-tab-bar`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-header`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-shell`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/fees` | `/fees`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/notifications` | `/notifications`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-avatar`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../src/components/auth/auth-theme`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../src/components/auth/captcha-widget`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/theme`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-portal-context`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-header`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-shell`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-tab-bar`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-drawer`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/students` | `/students`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/auth/device-sessions-panel`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/index` | `/marks/index`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/auth/premium-splash-screen`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../app.config`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(auth)'}/change-password` | `/change-password`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(auth)'}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(auth)'}/guest` | `/guest`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(auth)'}/splash` | `/splash`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(auth)'}/welcome` | `/welcome`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(student)'}/assignments` | `/assignments`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(student)'}/exam-schedule` | `/exam-schedule`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(student)'}/leave` | `/leave`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(student)'}/library` | `/library`; params?: Router.UnknownOutputParams }
        | { pathname: `${'/(student)'}/results` | `/results`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(student)'}/timetable` | `/timetable`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${'/(staff)'}/leave` | `/leave`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${'/(staff)'}/timetable` | `/timetable`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/attendance` | `/attendance`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}/class-roster/[sectionId]` | `/class-roster/[sectionId]`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}/mark-attendance/[sessionId]` | `/mark-attendance/[sessionId]`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/[paperId]` | `/marks/[paperId]`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../src/auth/identifier-hint`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/auth/login-flow`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/auth/logout`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/auth/role-router`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/academics`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/auth-account`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-attendance`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-leave`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-marks`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-payroll`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-roster`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/faculty-timetable`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/student-dashboard`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/student-exams`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/student-leave`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/student-library`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/services/student-lms`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/types/academics`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/types/faculty-home`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/utils/upload-asset-url`; params?: Router.UnknownOutputParams }
        | { pathname: `/../src/constants/release`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../src/components/auth/auth-text-field`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/drawer-menu`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../src/components/ui/date-field`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../src/components/student-portal/drawer-menu`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/../src/utils/password-policy`; params?: Router.UnknownOutputParams }
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
        | `/../src/components/student-portal/theme${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-portal-context${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-drawer${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-tab-bar${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-screen-header${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-screen-shell${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${'/(tabs)'}/fees${`?${string}` | `#${string}` | ''}`
        | `/fees${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${'/(tabs)'}/notifications${`?${string}` | `#${string}` | ''}`
        | `/notifications${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${'/(tabs)'}/index${`?${string}` | `#${string}` | ''}`
        | `/index${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${'/(tabs)'}/academics${`?${string}` | `#${string}` | ''}`
        | `/academics${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}${'/(tabs)'}/profile${`?${string}` | `#${string}` | ''}`
        | `/profile${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/student-avatar${`?${string}` | `#${string}` | ''}`
        | `/../src/components/auth/auth-theme${`?${string}` | `#${string}` | ''}`
        | `/../src/components/auth/captcha-widget${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/theme${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/faculty-portal-context${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/faculty-screen-header${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/faculty-screen-shell${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/faculty-tab-bar${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/faculty-drawer${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${'/(tabs)'}/students${`?${string}` | `#${string}` | ''}`
        | `/students${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${'/(tabs)'}/profile${`?${string}` | `#${string}` | ''}`
        | `/profile${`?${string}` | `#${string}` | ''}`
        | `/../src/components/auth/device-sessions-panel${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/marks/index${`?${string}` | `#${string}` | ''}`
        | `/marks/index${`?${string}` | `#${string}` | ''}`
        | `/../src/components/auth/premium-splash-screen${`?${string}` | `#${string}` | ''}`
        | `/../app.config${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/change-password${`?${string}` | `#${string}` | ''}`
        | `/change-password${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/forgot-password${`?${string}` | `#${string}` | ''}`
        | `/forgot-password${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/guest${`?${string}` | `#${string}` | ''}`
        | `/guest${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/splash${`?${string}` | `#${string}` | ''}`
        | `/splash${`?${string}` | `#${string}` | ''}`
        | `${'/(auth)'}/welcome${`?${string}` | `#${string}` | ''}`
        | `/welcome${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/assignments${`?${string}` | `#${string}` | ''}`
        | `/assignments${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/exam-schedule${`?${string}` | `#${string}` | ''}`
        | `/exam-schedule${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/leave${`?${string}` | `#${string}` | ''}`
        | `/leave${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/library${`?${string}` | `#${string}` | ''}`
        | `/library${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/results${`?${string}` | `#${string}` | ''}`
        | `/results${`?${string}` | `#${string}` | ''}`
        | `${'/(student)'}/timetable${`?${string}` | `#${string}` | ''}`
        | `/timetable${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/leave${`?${string}` | `#${string}` | ''}`
        | `/leave${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/timetable${`?${string}` | `#${string}` | ''}`
        | `/timetable${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${'/(tabs)'}/academics${`?${string}` | `#${string}` | ''}`
        | `/academics${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${'/(tabs)'}/attendance${`?${string}` | `#${string}` | ''}`
        | `/attendance${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}${'/(tabs)'}/index${`?${string}` | `#${string}` | ''}`
        | `/index${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/class-roster/[sectionId]${`?${string}` | `#${string}` | ''}`
        | `/class-roster/[sectionId]${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/mark-attendance/[sessionId]${`?${string}` | `#${string}` | ''}`
        | `/mark-attendance/[sessionId]${`?${string}` | `#${string}` | ''}`
        | `${'/(staff)'}/marks/[paperId]${`?${string}` | `#${string}` | ''}`
        | `/marks/[paperId]${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/identifier-hint${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/login-flow${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/logout${`?${string}` | `#${string}` | ''}`
        | `/../src/auth/role-router${`?${string}` | `#${string}` | ''}`
        | `/../src/services/academics${`?${string}` | `#${string}` | ''}`
        | `/../src/services/auth-account${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-attendance${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-leave${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-marks${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-payroll${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-roster${`?${string}` | `#${string}` | ''}`
        | `/../src/services/faculty-timetable${`?${string}` | `#${string}` | ''}`
        | `/../src/services/student-dashboard${`?${string}` | `#${string}` | ''}`
        | `/../src/services/student-exams${`?${string}` | `#${string}` | ''}`
        | `/../src/services/student-leave${`?${string}` | `#${string}` | ''}`
        | `/../src/services/student-library${`?${string}` | `#${string}` | ''}`
        | `/../src/services/student-lms${`?${string}` | `#${string}` | ''}`
        | `/../src/types/academics${`?${string}` | `#${string}` | ''}`
        | `/../src/types/faculty-home${`?${string}` | `#${string}` | ''}`
        | `/../src/utils/upload-asset-url${`?${string}` | `#${string}` | ''}`
        | `/../src/constants/release${`?${string}` | `#${string}` | ''}`
        | `/../src/components/auth/auth-text-field${`?${string}` | `#${string}` | ''}`
        | `/../src/components/faculty-portal/drawer-menu${`?${string}` | `#${string}` | ''}`
        | `/../src/components/ui/date-field${`?${string}` | `#${string}` | ''}`
        | `/../src/components/student-portal/drawer-menu${`?${string}` | `#${string}` | ''}`
        | `/../src/utils/password-policy${`?${string}` | `#${string}` | ''}`
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
        | {
            pathname: `/../src/components/student-portal/theme`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-portal-context`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-drawer`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-tab-bar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-header`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-screen-shell`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/fees` | `/fees`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/student-portal/student-avatar`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/components/auth/auth-theme`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/components/auth/captcha-widget`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/faculty-portal/theme`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-portal-context`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-header`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-screen-shell`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-tab-bar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/faculty-drawer`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/students` | `/students`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/profile` | `/profile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/auth/device-sessions-panel`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/index` | `/marks/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/auth/premium-splash-screen`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../app.config`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(auth)'}/change-password` | `/change-password`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(auth)'}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(auth)'}/guest` | `/guest`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/splash` | `/splash`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(auth)'}/welcome` | `/welcome`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/assignments` | `/assignments`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(student)'}/exam-schedule` | `/exam-schedule`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(student)'}/leave` | `/leave`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/library` | `/library`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(student)'}/results` | `/results`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(student)'}/timetable` | `/timetable`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${'/(staff)'}/leave` | `/leave`; params?: Router.UnknownInputParams }
        | { pathname: `${'/(staff)'}/timetable` | `/timetable`; params?: Router.UnknownInputParams }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/academics` | `/academics`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/attendance` | `/attendance`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}${'/(tabs)'}/index` | `/index`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/class-roster/[sectionId]` | `/class-roster/[sectionId]`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/mark-attendance/[sessionId]` | `/mark-attendance/[sessionId]`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${'/(staff)'}/marks/[paperId]` | `/marks/[paperId]`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/auth/identifier-hint`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/login-flow`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/logout`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/auth/role-router`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/academics`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/auth-account`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-attendance`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-leave`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-marks`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-payroll`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-roster`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/faculty-timetable`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-dashboard`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-exams`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-leave`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-library`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/services/student-lms`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/academics`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/types/faculty-home`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/utils/upload-asset-url`; params?: Router.UnknownInputParams }
        | { pathname: `/../src/constants/release`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/auth/auth-text-field`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../src/components/faculty-portal/drawer-menu`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/components/ui/date-field`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../src/components/student-portal/drawer-menu`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/../src/utils/password-policy`; params?: Router.UnknownInputParams }
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
