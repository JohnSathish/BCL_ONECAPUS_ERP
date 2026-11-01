import { Text } from 'react-native';
import { OpacDesk } from '@/components/library/opac-desk';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';

export function LibraryDesk() {
  return <OpacDesk />;
}

export default function StudentLibraryScreen() {
  return (
    <StudentScreenShell
      title="Library / OPAC"
      subtitle="Search, explore and discover books"
      rightSlot={<Text style={{ fontSize: 28 }}>📚</Text>}
    >
      <LibraryDesk />
    </StudentScreenShell>
  );
}
