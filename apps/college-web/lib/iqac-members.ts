import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';

export type PublicCommitteeMember = {
  displayName: string;
  role: string;
  designation: string | null;
  departmentName: string | null;
  memberType: string | null;
  organization: string | null;
  exOfficioPosition: string | null;
};

export type PublicCommitteeMembersPayload = {
  code: string;
  name: string;
  members: PublicCommitteeMember[];
};

function parseMember(row: unknown): PublicCommitteeMember | null {
  if (!isRecord(row) || typeof row.displayName !== 'string') return null;
  return {
    displayName: row.displayName,
    role: typeof row.role === 'string' ? row.role : 'MEMBER',
    designation: typeof row.designation === 'string' ? row.designation : null,
    departmentName: typeof row.departmentName === 'string' ? row.departmentName : null,
    memberType: typeof row.memberType === 'string' ? row.memberType : null,
    organization: typeof row.organization === 'string' ? row.organization : null,
    exOfficioPosition: typeof row.exOfficioPosition === 'string' ? row.exOfficioPosition : null,
  };
}

export async function getPublicCommitteeMembers(
  code = 'IQAC',
): Promise<PublicCommitteeMembersPayload | null> {
  const value = await fetchCms(`committees/${encodeURIComponent(code)}/members`, {}, 300);
  if (!isRecord(value)) return null;
  const members = Array.isArray(value.members)
    ? value.members.map(parseMember).filter((row): row is PublicCommitteeMember => Boolean(row))
    : [];
  return {
    code: typeof value.code === 'string' ? value.code : code.toUpperCase(),
    name: typeof value.name === 'string' ? value.name : 'Internal Quality Assurance Cell',
    members,
  };
}
