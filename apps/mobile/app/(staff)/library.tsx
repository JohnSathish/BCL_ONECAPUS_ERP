import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { LibraryDesk } from '../(student)/library';

export default function StaffLibraryScreen() {
  return (
    <FacultyScreenShell
      title="Library / OPAC"
      subtitle="Catalogue, loans, and due dates"
      tone="brand"
    >
      <LibraryDesk />
    </FacultyScreenShell>
  );
}
