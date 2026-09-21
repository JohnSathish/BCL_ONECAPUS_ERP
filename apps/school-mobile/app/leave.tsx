import { useEffect, useState } from 'react';
import { getUser } from '@/auth/session';
import { isPrincipalUser, isStaffUser } from '@/persona';
import { StaffLeave } from '@/screens/staff-leave';
import FeatureScreen from '@/ui/feature-screen';
import { Loader, Screen } from '@/ui/kit';

export default function LeavePage() {
  const [mode, setMode] = useState<'boot' | 'staff' | 'other'>('boot');

  useEffect(() => {
    void getUser().then((user) => {
      setMode(isStaffUser(user) || isPrincipalUser(user) ? 'staff' : 'other');
    });
  }, []);

  if (mode === 'boot') {
    return (
      <Screen title="Leave Application" onBack>
        <Loader />
      </Screen>
    );
  }
  if (mode === 'staff') return <StaffLeave />;
  return (
    <FeatureScreen
      title="Leave Application"
      body="Apply for leave and track remaining balance from the school office. Approvals are recorded in the ERP."
    />
  );
}
