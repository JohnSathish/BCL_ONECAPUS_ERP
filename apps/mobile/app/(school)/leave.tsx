import { SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';

export default function SchoolLeaveScreen() {
  return (
    <SchoolShell title="Leave">
      <SchoolEmpty
        title="No leave applications"
        body="Apply from the school office desk if online leave is not yet opened for your role."
      />
    </SchoolShell>
  );
}
