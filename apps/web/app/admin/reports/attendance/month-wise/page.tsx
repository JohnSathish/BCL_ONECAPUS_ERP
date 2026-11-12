import { redirect } from 'next/navigation';

export default function MonthWiseAttendancePage() {
  redirect('/admin/reports/attendance/cumulative');
}
