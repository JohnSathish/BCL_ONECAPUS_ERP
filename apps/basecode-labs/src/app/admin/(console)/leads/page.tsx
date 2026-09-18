import { prisma } from '@/lib/prisma';

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
      <p className="mt-1 text-sm text-slate-600">Enquiries from the public contact form.</p>
      <div className="bcl-table-wrap mt-6">
        <table className="bcl-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Name</th>
              <th>Organisation</th>
              <th>Stage</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{l.createdAt.toLocaleString('en-IN')}</td>
                <td>
                  {l.name}
                  <div className="text-xs text-slate-500">{l.email}</div>
                </td>
                <td>{l.organisation}</td>
                <td>
                  <span className="bcl-badge bg-sky-50 text-sky-700">{l.stage}</span>
                </td>
                <td className="max-w-md">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
