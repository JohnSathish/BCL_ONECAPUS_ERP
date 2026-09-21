import { useEffect, useState } from 'react';
import { getUser } from '@/auth/session';
import { isPrincipalUser, isStaffUser } from '@/persona';
import { StudentAttendance } from '@/screens/student-attendance';
import { TakeAttendanceForm } from '@/screens/take-attendance';
import { Loader, Screen } from '@/ui/kit';

export default function AttendanceScreen() {
  const [mode, setMode] = useState<'boot' | 'student' | 'staff'>('boot');

  useEffect(() => {
    void getUser().then((user) => {
      setMode(isStaffUser(user) || isPrincipalUser(user) ? 'staff' : 'student');
    });
  }, []);

  if (mode === 'boot') {
    return (
      <Screen title="Attendance" onBack>
        <Loader />
      </Screen>
    );
  }
  if (mode === 'staff') return <TakeAttendanceForm />;
  return <StudentAttendance />;
}
