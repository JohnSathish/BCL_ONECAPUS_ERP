'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  GraduationCap,
  Home,
  MessageSquareWarning,
  Printer,
  Ticket,
  UserCheck,
} from 'lucide-react';

import { GatePassPrintSlip } from '@/components/front-office/front-office-phase2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  checkInFrontOfficeGatePass,
  checkOutFrontOfficeGatePass,
  createEnquiryFromAdmission,
  createFrontOfficeComplaint,
  createFrontOfficeEnquiry,
  createFrontOfficeGatePass,
  fetchFrontOfficeAdmissionsDesk,
  fetchFrontOfficeComplaints,
  fetchFrontOfficeDashboard,
  fetchFrontOfficeEnquiries,
  fetchFrontOfficeGatePasses,
  linkEnquiryToAdmission,
  printFrontOfficeGatePass,
  updateFrontOfficeComplaint,
  updateFrontOfficeEnquiry,
} from '@/services/front-office';
import type { FrontOfficeGatePass } from '@/types/front-office';
import { apiErrorMessage } from '@/utils/api-error';

type Page = 'dashboard' | 'enquiries' | 'gate-passes' | 'complaints';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function FrontOfficeWorkspace({ page = 'dashboard' }: { page?: Page }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [printPass, setPrintPass] = useState<FrontOfficeGatePass | null>(null);
  const [linkEnquiryId, setLinkEnquiryId] = useState<string | null>(null);
  const [linkApplicationId, setLinkApplicationId] = useState('');

  const dashboard = useQuery({
    queryKey: ['front-office', 'dashboard'],
    queryFn: fetchFrontOfficeDashboard,
    enabled,
  });
  const admissionsDesk = useQuery({
    queryKey: ['front-office', 'admissions-desk'],
    queryFn: fetchFrontOfficeAdmissionsDesk,
    enabled: enabled && (page === 'dashboard' || page === 'enquiries'),
  });
  const enquiries = useQuery({
    queryKey: ['front-office', 'enquiries'],
    queryFn: () => fetchFrontOfficeEnquiries({ limit: 50 }),
    enabled: enabled && page === 'enquiries',
  });
  const gatePasses = useQuery({
    queryKey: ['front-office', 'gate-passes'],
    queryFn: () => fetchFrontOfficeGatePasses({ limit: 50 }),
    enabled: enabled && page === 'gate-passes',
  });
  const complaints = useQuery({
    queryKey: ['front-office', 'complaints'],
    queryFn: () => fetchFrontOfficeComplaints({ limit: 50 }),
    enabled: enabled && page === 'complaints',
  });

  const [enquiryForm, setEnquiryForm] = useState({
    enquiryType: 'ADMISSION',
    fullName: '',
    mobile: '',
    programmeInterest: '',
    source: 'WALK_IN',
    notes: '',
  });
  const [gatePassForm, setGatePassForm] = useState({
    visitorName: '',
    mobile: '',
    hostName: '',
    hostDepartment: '',
    purpose: '',
    vehicleNo: '',
  });
  const [complaintForm, setComplaintForm] = useState({
    category: 'ADMIN',
    priority: 'MEDIUM',
    complainantName: '',
    complainantMobile: '',
    subject: '',
    description: '',
  });

  const enquiryMut = useMutation({
    mutationFn: () => createFrontOfficeEnquiry(enquiryForm),
    onSuccess: () => {
      setMessage('Enquiry registered');
      setEnquiryForm({
        enquiryType: 'ADMISSION',
        fullName: '',
        mobile: '',
        programmeInterest: '',
        source: 'WALK_IN',
        notes: '',
      });
      void qc.invalidateQueries({ queryKey: ['front-office'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const gatePassMut = useMutation({
    mutationFn: () => createFrontOfficeGatePass(gatePassForm),
    onSuccess: (row) => {
      setMessage(`Gate pass issued — ${row.passNumber}`);
      setPrintPass(row);
      setGatePassForm({
        visitorName: '',
        mobile: '',
        hostName: '',
        hostDepartment: '',
        purpose: '',
        vehicleNo: '',
      });
      void qc.invalidateQueries({ queryKey: ['front-office'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const linkAdmissionMut = useMutation({
    mutationFn: () => linkEnquiryToAdmission(linkEnquiryId!, linkApplicationId.trim()),
    onSuccess: () => {
      setMessage('Enquiry linked to admission application');
      setLinkEnquiryId(null);
      setLinkApplicationId('');
      void qc.invalidateQueries({ queryKey: ['front-office'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const complaintMut = useMutation({
    mutationFn: () => createFrontOfficeComplaint(complaintForm),
    onSuccess: (row) => {
      setMessage(`Complaint logged — ${row.ticketNo}`);
      setComplaintForm({
        category: 'ADMIN',
        priority: 'MEDIUM',
        complainantName: '',
        complainantMobile: '',
        subject: '',
        description: '',
      });
      void qc.invalidateQueries({ queryKey: ['front-office'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  if (page === 'dashboard') {
    const d = dashboard.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Home className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Front Office</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Today's Enquiries" value={d?.todayEnquiries ?? '—'} />
          <Kpi label="Open Enquiries" value={d?.openEnquiries ?? '—'} />
          <Kpi label="Visitors Inside" value={d?.visitorsInside ?? '—'} />
          <Kpi label="Open Complaints" value={d?.openComplaints ?? '—'} />
          <Kpi label="High Priority" value={d?.highPriorityComplaints ?? '—'} />
          <Kpi label="Active Gate Passes" value={d?.activeGatePasses ?? '—'} />
          <Kpi label="Gate Passes Today" value={d?.todayGatePasses ?? '—'} />
          <Kpi
            label="Pending Admissions"
            value={d?.pendingAdmissions ?? admissionsDesk.data?.pendingReview ?? '—'}
          />
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="h-4 w-4" /> Admissions desk
            </h2>
            <Button size="sm" variant="outline" asChild>
              <Link
                href={
                  d?.admissionsHref ?? admissionsDesk.data?.admissionsHref ?? '/admin/admissions'
                }
              >
                Open admissions <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
            <p>
              Pending review: <strong>{admissionsDesk.data?.pendingReview ?? '—'}</strong>
            </p>
            <p>
              Submitted today: <strong>{admissionsDesk.data?.submittedToday ?? '—'}</strong>
            </p>
            <p>
              Linked enquiries: <strong>{admissionsDesk.data?.linkedEnquiries ?? '—'}</strong>
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            {admissionsDesk.data?.recentApplications.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t py-1 first:border-t-0"
              >
                <span>
                  {a.applicationNumber} — {a.fullName} ({a.status})
                </span>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={a.adminHref}>View</Link>
                </Button>
              </li>
            ))}
            {!admissionsDesk.data?.recentApplications.length ? (
              <li className="text-muted-foreground">No recent applications</li>
            ) : null}
          </ul>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">Recent enquiries</h2>
            <ul className="space-y-1 text-sm">
              {d?.recentEnquiries.map((e) => (
                <li key={e.id}>
                  {e.enquiryNo} — {e.fullName} ({e.status})
                </li>
              ))}
              {!d?.recentEnquiries.length ? (
                <li className="text-muted-foreground">No enquiries yet</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">Recent complaints</h2>
            <ul className="space-y-1 text-sm">
              {d?.recentComplaints.map((c) => (
                <li key={c.id}>
                  {c.ticketNo} — {c.subject} ({c.priority})
                </li>
              ))}
              {!d?.recentComplaints.length ? (
                <li className="text-muted-foreground">No complaints yet</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'enquiries') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Enquiries</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-6">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={enquiryForm.enquiryType}
            onChange={(e) => setEnquiryForm({ ...enquiryForm, enquiryType: e.target.value })}
          >
            <option value="ADMISSION">Admission</option>
            <option value="GENERAL">General</option>
            <option value="PLACEMENT">Placement</option>
            <option value="OTHER">Other</option>
          </select>
          <Input
            placeholder="Full name"
            value={enquiryForm.fullName}
            onChange={(e) => setEnquiryForm({ ...enquiryForm, fullName: e.target.value })}
          />
          <Input
            placeholder="Mobile"
            value={enquiryForm.mobile}
            onChange={(e) => setEnquiryForm({ ...enquiryForm, mobile: e.target.value })}
          />
          <Input
            placeholder="Programme interest"
            value={enquiryForm.programmeInterest}
            onChange={(e) => setEnquiryForm({ ...enquiryForm, programmeInterest: e.target.value })}
          />
          <Input
            placeholder="Source"
            value={enquiryForm.source}
            onChange={(e) => setEnquiryForm({ ...enquiryForm, source: e.target.value })}
          />
          <Button disabled={enquiryMut.isPending} onClick={() => enquiryMut.mutate()}>
            Register
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">No</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Admission</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.data?.items.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2 font-mono text-xs">{e.enquiryNo}</td>
                <td className="p-2">{e.fullName}</td>
                <td className="p-2">{e.enquiryType}</td>
                <td className="p-2">
                  {e.admissionApplicationId ? (
                    <Link
                      className="text-primary underline"
                      href={`/admin/admissions?application=${e.admissionApplicationId}`}
                    >
                      Linked
                    </Link>
                  ) : linkEnquiryId === e.id ? (
                    <div className="flex gap-1">
                      <Input
                        className="h-8 w-36 font-mono text-xs"
                        placeholder="Application UUID"
                        value={linkApplicationId}
                        onChange={(ev) => setLinkApplicationId(ev.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={linkAdmissionMut.isPending}
                        onClick={() => linkAdmissionMut.mutate()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLinkEnquiryId(null);
                          setLinkApplicationId('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setLinkEnquiryId(e.id)}>
                      Link
                    </Button>
                  )}
                </td>
                <td className="p-2">{e.status}</td>
                <td className="p-2">
                  {e.status === 'OPEN' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateFrontOfficeEnquiry(e.id, { status: 'IN_PROGRESS' });
                        void qc.invalidateQueries({ queryKey: ['front-office'] });
                      }}
                    >
                      Start
                    </Button>
                  ) : e.status === 'IN_PROGRESS' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateFrontOfficeEnquiry(e.id, { status: 'RESOLVED' });
                        void qc.invalidateQueries({ queryKey: ['front-office'] });
                      }}
                    >
                      Resolve
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admissionsDesk.data?.recentApplications.length ? (
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">Create enquiry from application</h2>
            <ul className="space-y-1 text-sm">
              {admissionsDesk.data.recentApplications.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {a.applicationNumber} — {a.fullName}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await createEnquiryFromAdmission(a.id);
                      setMessage(`Enquiry created from ${a.applicationNumber}`);
                      void qc.invalidateQueries({ queryKey: ['front-office'] });
                    }}
                  >
                    Create enquiry
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (page === 'gate-passes') {
    return (
      <div className="space-y-4">
        {printPass ? (
          <GatePassPrintSlip pass={printPass} onClose={() => setPrintPass(null)} />
        ) : null}
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Gate Pass</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-6">
          <Input
            placeholder="Visitor name"
            value={gatePassForm.visitorName}
            onChange={(e) => setGatePassForm({ ...gatePassForm, visitorName: e.target.value })}
          />
          <Input
            placeholder="Mobile"
            value={gatePassForm.mobile}
            onChange={(e) => setGatePassForm({ ...gatePassForm, mobile: e.target.value })}
          />
          <Input
            placeholder="Host name"
            value={gatePassForm.hostName}
            onChange={(e) => setGatePassForm({ ...gatePassForm, hostName: e.target.value })}
          />
          <Input
            placeholder="Department"
            value={gatePassForm.hostDepartment}
            onChange={(e) => setGatePassForm({ ...gatePassForm, hostDepartment: e.target.value })}
          />
          <Input
            placeholder="Purpose"
            value={gatePassForm.purpose}
            onChange={(e) => setGatePassForm({ ...gatePassForm, purpose: e.target.value })}
          />
          <Button disabled={gatePassMut.isPending} onClick={() => gatePassMut.mutate()}>
            Issue Pass
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Pass</th>
              <th className="p-2 text-left">Visitor</th>
              <th className="p-2 text-left">Host</th>
              <th className="p-2 text-left">Valid until</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {gatePasses.data?.items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-mono text-xs">{p.passNumber}</td>
                <td className="p-2">{p.visitorName}</td>
                <td className="p-2">{p.hostName ?? '—'}</td>
                <td className="p-2">{new Date(p.validUntil).toLocaleString()}</td>
                <td className="p-2">{p.status}</td>
                <td className="p-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const label = await printFrontOfficeGatePass(p.id);
                      setPrintPass(label);
                    }}
                  >
                    <Printer className="h-3 w-3" />
                  </Button>
                  {p.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await checkInFrontOfficeGatePass(p.id);
                        void qc.invalidateQueries({ queryKey: ['front-office'] });
                      }}
                    >
                      Check in
                    </Button>
                  ) : null}
                  {p.status === 'CHECKED_IN' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await checkOutFrontOfficeGatePass(p.id);
                        void qc.invalidateQueries({ queryKey: ['front-office'] });
                      }}
                    >
                      Check out
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (page === 'complaints') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Complaints</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-2">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={complaintForm.category}
            onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
          >
            <option value="ACADEMIC">Academic</option>
            <option value="ADMIN">Admin</option>
            <option value="FACILITY">Facility</option>
            <option value="HOSTEL">Hostel</option>
            <option value="TRANSPORT">Transport</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            className="rounded border px-2 py-2 text-sm"
            value={complaintForm.priority}
            onChange={(e) => setComplaintForm({ ...complaintForm, priority: e.target.value })}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <Input
            placeholder="Complainant name"
            value={complaintForm.complainantName}
            onChange={(e) =>
              setComplaintForm({ ...complaintForm, complainantName: e.target.value })
            }
          />
          <Input
            placeholder="Mobile"
            value={complaintForm.complainantMobile}
            onChange={(e) =>
              setComplaintForm({ ...complaintForm, complainantMobile: e.target.value })
            }
          />
          <Input
            placeholder="Subject"
            value={complaintForm.subject}
            onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
          />
          <Input
            placeholder="Description"
            value={complaintForm.description}
            onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
          />
          <Button disabled={complaintMut.isPending} onClick={() => complaintMut.mutate()}>
            Log complaint
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Ticket</th>
              <th className="p-2 text-left">Subject</th>
              <th className="p-2 text-left">Priority</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {complaints.data?.items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2 font-mono text-xs">{c.ticketNo}</td>
                <td className="p-2">{c.subject}</td>
                <td className="p-2">{c.priority}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">
                  {c.status !== 'RESOLVED' && c.status !== 'CLOSED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateFrontOfficeComplaint(c.id, {
                          status: 'RESOLVED',
                          resolution: 'Resolved at front office desk',
                        });
                        void qc.invalidateQueries({ queryKey: ['front-office'] });
                      }}
                    >
                      Resolve
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
