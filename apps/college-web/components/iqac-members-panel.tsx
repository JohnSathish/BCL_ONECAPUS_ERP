import type { PublicCommitteeMember } from '@/lib/iqac-members';

const ROLE_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  CONVENER: 'Convener',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
  MEMBER_SECRETARY: 'Member Secretary',
  COORDINATOR: 'Coordinator',
  EX_OFFICIO: 'Ex-Officio',
  STUDENT_REPRESENTATIVE: 'Student Representative',
  EXTERNAL_EXPERT: 'External Expert',
  PARENT_REPRESENTATIVE: 'Parent Representative',
  ALUMNI_REPRESENTATIVE: 'Alumni Representative',
  INDUSTRY_EXPERT: 'Industry Expert',
  LEGAL_EXPERT: 'Legal Expert',
  SPECIAL_INVITEE: 'Special Invitee',
  OBSERVER: 'Observer',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

type Props = {
  committeeName?: string | null;
  members: PublicCommitteeMember[];
};

export function IqacMembersPanel({ committeeName, members }: Props) {
  if (!members.length) {
    return (
      <div className="iqac-members-empty">
        <h2>Members</h2>
        <p>
          Members will appear once the IQAC committee is configured in Governance (Committee
          Management).
        </p>
      </div>
    );
  }

  return (
    <div className="iqac-members">
      <h2>{committeeName ? `${committeeName} — Members` : 'IQAC Members'}</h2>
      <p className="iqac-members-note">
        Composition is maintained in the college Committee Management module and updated here
        automatically.
      </p>
      <div className="iqac-members-table-wrap">
        <table className="iqac-members-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Designation</th>
              <th scope="col">Department / Organisation</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={`${member.displayName}-${member.role}-${index}`}>
                <td>
                  <strong>{member.displayName}</strong>
                  {member.exOfficioPosition ? (
                    <span className="iqac-members-meta">{member.exOfficioPosition}</span>
                  ) : null}
                </td>
                <td>{roleLabel(member.role)}</td>
                <td>{member.designation || '—'}</td>
                <td>{member.departmentName || member.organization || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
