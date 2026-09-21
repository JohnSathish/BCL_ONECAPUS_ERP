import { useEffect, useState } from 'react';
import { getUser } from '@/auth/session';
import { isPrincipalUser, isStaffUser } from '@/persona';
import { StaffHomeworkScreen } from '@/screens/staff-homework';
import { StudentHomeworkScreen } from '@/screens/student-homework';
import { Loader, Screen } from '@/ui/kit';

export default function HomeworkScreen() {
  const [mode, setMode] = useState<'boot' | 'staff' | 'student'>('boot');

  useEffect(() => {
    void getUser().then((user) => {
      setMode(isStaffUser(user) || isPrincipalUser(user) ? 'staff' : 'student');
    });
  }, []);

  if (mode === 'boot') {
    return (
      <Screen title="Homework" onBack>
        <Loader />
      </Screen>
    );
  }
  if (mode === 'staff') return <StaffHomeworkScreen />;
  return <StudentHomeworkScreen />;
}
