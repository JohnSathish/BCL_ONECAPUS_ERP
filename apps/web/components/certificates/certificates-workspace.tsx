'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BadgeCheck,
  BarChart3,
  ClipboardCheck,
  Copy,
  FileBadge,
  FileCheck2,
  Fingerprint,
  LayoutTemplate,
  QrCode,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Printer,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StudentName } from '@/components/students/student-name';
import { Input } from '@/components/ui/input';
import {
  actOnCertificateApproval,
  bulkIssueCertificates,
  cloneCertificateTemplate,
  createCertificateRequest,
  createCertificateTemplate,
  createMyCertificateRequest,
  fetchCertificateAuditLogs,
  fetchCertificateCategories,
  fetchCertificateDashboard,
  fetchCertificateIssues,
  fetchCertificateRequests,
  fetchCertificateSequences,
  fetchCertificateTemplates,
  fetchMyCertificateIssues,
  fetchMyCertificateProfile,
  fetchMyCertificateRequests,
  issueCertificate,
  previewCertificate,
  previewMyCertificate,
  publishCertificateTemplate,
  revokeCertificate,
  seedCertificateDefaults,
  seedDbcOfficialCertificateTemplates,
  fetchCertificateSignatures,
  upsertCertificateSignature,
  upsertCertificateSequence,
  uploadCertificateSignatureAsset,
  downloadCertificateIssue,
  downloadMyCertificateIssue,
  fetchCertificateRegister,
} from '@/services/certificates';
import { fetchStudents, fetchLifecycleEvents } from '@/services/students';
import { useAuth, useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { groupCertificateCategories } from '@/lib/certificate-categories';
import { ApiError, isApiUnavailableError, apiErrorMessage } from '@/utils/api-error';
import type {
  CertificateCategory,
  CertificateIssue,
  CertificateRequest,
  CertificateTemplate,
} from '@/types/certificates';

type Page =
  | 'dashboard'
  | 'templates'
  | 'generator'
  | 'requests'
  | 'bulk'
  | 'verification'
  | 'workflow'
  | 'analytics'
  | 'audit'
  | 'settings'
  | 'student';

type Props = {
  page?: Page;
  portal?: 'admin' | 'student';
};

const DEFAULT_HTML =
  '<section style="font-family: Georgia, serif; padding: 56px; border: 12px double #0f172a; min-height: 780px; text-align: center;"><h1>{{college_name}}</h1><p>Certificate No: {{certificate_number}}</p><h2>Certificate of Verification</h2><p>This certifies that <strong>{{student_name}}</strong> bearing registration number <strong>{{registration_number}}</strong> is/was a student of <strong>{{programme}}</strong>.</p><p>Issued on {{date_of_issue}}</p><p style="margin-top: 80px;">{{principal_name}}</p></section>';

function openCertificatePrint(issueId: string, autoprint = false) {
  const params = new URLSearchParams({ issueId });
  if (autoprint) params.set('autoprint', '1');
  window.open(`/admin/certificates/print?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

export function CertificatesWorkspace({ page = 'dashboard', portal = 'admin' }: Props) {
  useRequireAuth();
  const { session: authSession } = useAuth();
  const isStudentPortal = portal === 'student';
  const permissions = authSession?.user?.permissions ?? [];
  const roles = authSession?.user?.roles ?? [];
  const canManageCertificates =
    permissions.includes('certificates:manage') || permissions.includes('students:manage');
  const canApproveCertificates =
    permissions.includes('certificates:approve') ||
    permissions.includes('certificates:manage') ||
    permissions.includes('students:manage') ||
    permissions.includes('academic:manage');
  const searchParams = useSearchParams();
  const authReady = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [activePage, setActivePage] = useState<Page>(page);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [tcFields, setTcFields] = useState({
    conduct: 'Good',
    attendance: 'Satisfactory',
    industry: 'Satisfactory',
    fee_clearance: 'All dues cleared',
    reason_for_leaving: 'Completed Programme',
    date_of_leaving: '',
    remarks: '',
  });

  const dashboard = useQuery({
    queryKey: ['certificates', 'dashboard'],
    queryFn: fetchCertificateDashboard,
    enabled: authReady && !isStudentPortal,
  });
  const categories = useQuery({
    queryKey: ['certificates', 'categories'],
    queryFn: fetchCertificateCategories,
    enabled: authReady,
  });
  const templates = useQuery({
    queryKey: ['certificates', 'templates'],
    queryFn: () => fetchCertificateTemplates(),
    enabled: authReady,
  });
  const myProfile = useQuery({
    queryKey: ['certificates', 'me', 'profile'],
    queryFn: fetchMyCertificateProfile,
    enabled: authReady && isStudentPortal,
  });
  const requests = useQuery({
    queryKey: ['certificates', 'requests'],
    queryFn: () => fetchCertificateRequests(),
    enabled: authReady && !isStudentPortal,
  });
  const myRequests = useQuery({
    queryKey: ['certificates', 'me', 'requests'],
    queryFn: fetchMyCertificateRequests,
    enabled: authReady && isStudentPortal,
  });
  const issues = useQuery({
    queryKey: ['certificates', 'issues'],
    queryFn: () => fetchCertificateIssues(),
    enabled: authReady && !isStudentPortal,
  });
  const myIssues = useQuery({
    queryKey: ['certificates', 'me', 'issues'],
    queryFn: fetchMyCertificateIssues,
    enabled: authReady && isStudentPortal,
  });
  const audits = useQuery({
    queryKey: ['certificates', 'audit'],
    queryFn: fetchCertificateAuditLogs,
    enabled: authReady && activePage === 'audit',
  });
  const students = useQuery({
    queryKey: ['students', 'certificates', studentSearch],
    queryFn: () => fetchStudents({ limit: 20, search: studentSearch || undefined }),
    enabled: authReady && !isStudentPortal && studentSearch.length >= 2,
  });

  const seedDefaults = useMutation({
    mutationFn: seedCertificateDefaults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage('Default certificate categories are ready.');
    },
  });
  const seedDbcOfficial = useMutation({
    mutationFn: seedDbcOfficialCertificateTemplates,
    onSuccess: (templates) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage(
        `DBC official templates seeded and published (${templates.length}): Character, Provisional, and Transfer Certificate.`,
      );
    },
  });
  const createTemplate = useMutation({
    mutationFn: createCertificateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates', 'templates'] });
      setMessage('Template created with dynamic variables and preview HTML.');
    },
  });
  const publishTemplate = useMutation({
    mutationFn: publishCertificateTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
  const cloneTemplate = useMutation({
    mutationFn: cloneCertificateTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
  const createRequest = useMutation({
    mutationFn: createCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage('Certificate request submitted for workflow approval.');
    },
  });
  const createMyRequestMutation = useMutation({
    mutationFn: createMyCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage('Certificate request submitted for workflow approval.');
    },
  });
  const issue = useMutation({
    mutationFn: issueCertificate,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage(
        `Certificate ${result.certificateNo} issued with QR verification. Opening print preview…`,
      );
      openCertificatePrint(result.id);
    },
    onError: (error) => {
      if (isApiUnavailableError(error)) {
        setMessage(
          'Cannot reach the API. Ensure the backend is running on port 3001, then try again.',
        );
        return;
      }
      const status = error instanceof ApiError ? error.status : undefined;
      const normalized = apiErrorMessage(error, 'Unable to issue certificate.');
      if (status === 401 || normalized.toLowerCase().includes('session')) {
        setMessage('Session expired or invalid. Log out, sign in again, then retry Final Issue.');
        return;
      }
      if (status === 403) {
        setMessage(
          'You do not have permission to issue certificates (certificates:manage required).',
        );
        return;
      }
      setMessage(normalized);
    },
  });
  const bulkIssue = useMutation({
    mutationFn: bulkIssueCertificates,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage(`${result.issuedCount} certificates issued from the bulk center.`);
    },
  });
  const approvalAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      actOnCertificateApproval(id, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => revokeCertificate(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setMessage('Certificate revoked successfully.');
    },
  });

  const categoryList = categories.data ?? [];
  const templateList = useMemo(() => templates.data ?? [], [templates.data]);
  const requestList = isStudentPortal ? (myRequests.data ?? []) : (requests.data ?? []);
  const issueList = isStudentPortal ? (myIssues.data ?? []) : (issues.data ?? []);
  const selectedTemplateData = templateList.find((row) => row.id === selectedTemplate);
  const selectedCategoryCode = categoryList.find((row) => row.id === selectedCategory)?.code ?? '';
  const isTransferCertificate = selectedCategoryCode === 'TRANSFER';
  const transferVariableData = isTransferCertificate
    ? Object.fromEntries(Object.entries(tcFields).filter(([, value]) => value.trim().length > 0))
    : undefined;

  const previewPayload = useMemo(() => {
    if (!selectedCategory || !studentId) return null;
    return {
      categoryId: selectedCategory,
      templateId: selectedTemplate || undefined,
      studentId,
      variableData: transferVariableData,
    };
  }, [selectedCategory, selectedTemplate, studentId, transferVariableData]);

  const preview = useQuery({
    queryKey: ['certificates', 'preview', previewPayload, isStudentPortal],
    queryFn: () =>
      isStudentPortal
        ? previewMyCertificate({
            categoryId: previewPayload!.categoryId,
            templateId: previewPayload!.templateId,
            variableData: previewPayload!.variableData,
          })
        : previewCertificate(previewPayload!),
    enabled:
      authReady &&
      Boolean(previewPayload) &&
      (isStudentPortal ? Boolean(myProfile.data?.studentId) : true),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isStudentPortal && myProfile.data?.studentId) {
      setStudentId(myProfile.data.studentId);
    }
  }, [isStudentPortal, myProfile.data?.studentId]);

  useEffect(() => {
    if (!studentId || !isTransferCertificate) return;
    let cancelled = false;
    void fetchLifecycleEvents(studentId).then((events) => {
      if (cancelled) return;
      const latest = events.find((event) =>
        ['LEAVING', 'MIGRATION', 'ALUMNI', 'DROPOUT'].includes(event.eventType),
      );
      if (!latest) return;
      const meta = (latest.metadata ?? {}) as Record<string, string>;
      setTcFields((current) => ({
        conduct: meta.conduct ?? current.conduct,
        attendance: meta.attendance ?? current.attendance,
        industry: meta.industry ?? current.industry,
        fee_clearance: meta.fee_clearance ?? meta.fee_status ?? current.fee_clearance,
        reason_for_leaving:
          meta.reason_for_leaving ??
          latest.reason ??
          (latest.eventType === 'MIGRATION' ? 'Migration' : current.reason_for_leaving),
        date_of_leaving: latest.effectiveDate?.slice(0, 10) ?? current.date_of_leaving,
        remarks: meta.remarks ?? latest.reason ?? current.remarks,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, isTransferCertificate]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (selectedTemplate) {
      const current = templateList.find((row) => row.id === selectedTemplate);
      if (current && current.categoryId !== categoryId) setSelectedTemplate('');
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const template = templateList.find((row) => row.id === templateId);
    if (template?.categoryId) setSelectedCategory(template.categoryId);
  };

  const issueBlockers = [
    !authReady ? 'signed-in session' : null,
    !selectedCategory ? 'certificate type' : null,
    !studentId ? 'student' : null,
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (selectedCategory || !selectedTemplate || !templates.data?.length) return;
    const template = templates.data.find((row) => row.id === selectedTemplate);
    if (template?.categoryId) setSelectedCategory(template.categoryId);
  }, [selectedCategory, selectedTemplate, templates.data]);

  useEffect(() => {
    const paramStudentId = searchParams.get('studentId');
    const paramCategory = searchParams.get('category');
    if (paramStudentId) setStudentId(paramStudentId);
    if (!paramCategory || !categories.data?.length) return;
    const match = categories.data.find((row) => row.code === paramCategory.toUpperCase());
    if (match) setSelectedCategory(match.id);
  }, [searchParams, categories.data]);

  const nav = useMemo(
    () =>
      [
        ['dashboard', 'Dashboard', BarChart3],
        ['templates', 'Templates', LayoutTemplate],
        ['generator', 'Generator', FileBadge],
        ['requests', 'Requests', Send],
        ['bulk', 'Bulk Issue', Copy],
        ['verification', 'Verification', QrCode],
        ['workflow', 'Workflow', ClipboardCheck],
        ['analytics', 'Analytics', Sparkles],
        ['audit', 'Audit', Fingerprint],
        ['settings', 'Settings', Settings],
      ] as const,
    [],
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_36%),linear-gradient(135deg,#ffffff,#f8fafc)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Certificate Intelligence
            </div>
            {isStudentPortal ? (
              <>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  My Certificates
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Request certificates, track approval status, and download issued documents.
                  {myProfile.data?.fullName ? ` Signed in as ${myProfile.data.fullName}.` : ''}
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  Student Certificates Management Ecosystem
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Template-driven issuing, workflow approvals, bulk generation, QR verification,
                  transcript-ready variables, audit safety, and digital institutional branding.
                </p>
              </>
            )}
          </div>
          {!isStudentPortal ? (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Metric label="Issued Today" value={dashboard.data?.kpis.issuedToday ?? 0} />
              <Metric label="Pending" value={dashboard.data?.kpis.pendingRequests ?? 0} />
              <Metric label="Approvals" value={dashboard.data?.kpis.pendingApprovals ?? 0} />
              <Metric label="Verified" value={dashboard.data?.kpis.verificationRequests ?? 0} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="My Requests" value={requestList.length} />
              <Metric
                label="Issued"
                value={issueList.filter((row) => row.status === 'ISSUED').length}
              />
            </div>
          )}
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${message.includes('expired') || message.includes('Cannot reach') || message.includes('permission') ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {message}
        </div>
      ) : null}

      {!authReady ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Restoring your session…
        </div>
      ) : null}

      {portal === 'admin' ? (
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePage(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                activePage === id
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      ) : null}

      {activePage === 'dashboard' || activePage === 'analytics' ? (
        <>
          {!isStudentPortal ? (
            <DashboardPanel data={dashboard.data} requests={requestList} issues={issueList} />
          ) : null}
          {activePage === 'analytics' ? <CertificateRegisterPanel authReady={authReady} /> : null}
        </>
      ) : null}
      {activePage === 'templates' ? (
        <TemplateStudio
          categories={categoryList}
          templates={templateList}
          onSeed={() => seedDefaults.mutate()}
          onSeedDbcOfficial={() => seedDbcOfficial.mutate()}
          seedDbcPending={seedDbcOfficial.isPending}
          onCreate={() =>
            createTemplate.mutate({
              categoryId: selectedCategory || categoryList[0]?.id,
              code: `CERT_${Date.now()}`,
              name: 'Dynamic Certificate Template',
              html: DEFAULT_HTML,
              variables: [
                'student_name',
                'registration_number',
                'programme',
                'certificate_number',
                'date_of_issue',
                'qr_code',
              ],
            })
          }
          onPublish={(id) => publishTemplate.mutate(id)}
          onClone={(id) => cloneTemplate.mutate(id)}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
      ) : null}
      {activePage === 'generator' || activePage === 'bulk' || activePage === 'student' ? (
        <IssueConsole
          categories={categoryList}
          templates={templateList}
          students={students.data?.data ?? []}
          studentSearch={studentSearch}
          setStudentSearch={setStudentSearch}
          studentId={studentId}
          setStudentId={setStudentId}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleCategoryChange}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={handleTemplateChange}
          selectedTemplateData={selectedTemplateData}
          previewHtml={preview.data?.renderedHtml}
          previewLoading={preview.isFetching}
          issueBlockers={issueBlockers}
          issuePending={issue.isPending}
          isTransferCertificate={isTransferCertificate}
          tcFields={tcFields}
          setTcFields={setTcFields}
          onRequest={() => {
            const payload = {
              categoryId: selectedCategory,
              templateId: selectedTemplate || undefined,
              studentId,
              requestType: selectedCategoryCode || 'CUSTOM',
              purpose: 'Student certificate request',
              variableData: transferVariableData,
            };
            if (isStudentPortal) createMyRequestMutation.mutate(payload);
            else createRequest.mutate(payload);
          }}
          onIssue={() =>
            issue.mutate({
              categoryId: selectedCategory,
              templateId: selectedTemplate || undefined,
              studentId,
              variableData: transferVariableData,
            })
          }
          onBulkIssue={() =>
            bulkIssue.mutate({
              categoryId: selectedCategory,
              templateId: selectedTemplate || undefined,
              studentIds: (students.data?.data ?? []).slice(0, 10).map((row) => row.id),
            })
          }
          bulkMode={activePage === 'bulk'}
          studentMode={portal === 'student' || activePage === 'student'}
          studentProfile={myProfile.data}
        />
      ) : null}
      {isStudentPortal ? (
        <>
          <StudentRequestsPanel requests={requestList} />
          <StudentIssuesPanel issues={issueList} onDownload={downloadMyCertificateIssue} />
        </>
      ) : null}
      {activePage === 'requests' || activePage === 'workflow' ? (
        <RequestsPanel
          requests={requestList}
          roles={roles}
          canApprove={canApproveCertificates}
          canManage={canManageCertificates}
          onAction={(id, action) => approvalAction.mutate({ id, action })}
          onIssueApproved={(request) =>
            issue.mutate({
              categoryId: request.categoryId,
              templateId: request.templateId || undefined,
              studentId: request.studentId,
              requestId: request.id,
              variableData:
                (request.variableData as Record<string, unknown> | undefined) ?? undefined,
            })
          }
        />
      ) : null}
      {activePage === 'verification' ? (
        <VerificationPanel
          issues={issueList}
          onPrint={openCertificatePrint}
          onDownload={downloadCertificateIssue}
          canRevoke={canManageCertificates}
          onRevoke={(id, reason) => revoke.mutate({ id, reason })}
        />
      ) : null}
      {activePage === 'audit' ? <AuditPanel logs={audits.data ?? []} /> : null}
      {activePage === 'settings' ? (
        <SettingsPanel categories={categoryList} authReady={authReady} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-3 text-center shadow-sm">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function DashboardPanel({
  data,
  requests,
  issues,
}: {
  data?: any;
  requests: CertificateRequest[];
  issues: CertificateIssue[];
}) {
  const cards = [
    ['Categories', data?.kpis.categories ?? 0, Award],
    ['Templates', data?.kpis.templates ?? 0, LayoutTemplate],
    ['Total Requests', data?.kpis.requests ?? requests.length, Send],
    ['Total Issued', data?.kpis.totalIssued ?? issues.length, FileCheck2],
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <Panel title="Certificate Intelligence Dashboard" icon={Sparkles}>
        <div className="grid gap-3 md:grid-cols-4">
          {cards.map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Icon className="h-5 w-5 text-blue-600" />
              <p className="mt-3 text-2xl font-semibold">{value}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MiniList title="Most Requested" rows={data?.mostRequested ?? []} />
          <MiniList title="Request Status" rows={data?.statusMix ?? []} />
        </div>
      </Panel>
      <Panel title="Fraud & Verification Signals" icon={ShieldCheck}>
        <div className="space-y-3 text-sm">
          <Signal
            label="QR verification enabled"
            value="Every issued certificate gets a public verification token."
          />
          <Signal label="Revocation safe" value="Revoked certificates verify as invalid." />
          <Signal
            label="Audit protected"
            value="Template, approval, issue, and revoke actions are logged."
          />
        </div>
      </Panel>
    </div>
  );
}

function TemplateStudio(props: {
  categories: CertificateCategory[];
  templates: CertificateTemplate[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  onSeed: () => void;
  onSeedDbcOfficial: () => void;
  seedDbcPending?: boolean;
  onCreate: () => void;
  onPublish: (id: string) => void;
  onClone: (id: string) => void;
}) {
  return (
    <Panel title="Certificate Template Builder Studio" icon={LayoutTemplate}>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Button type="button" onClick={props.onSeed} className="w-full">
            Load Institutional Category Master
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={props.onSeedDbcOfficial}
            disabled={props.seedDbcPending}
            className="w-full"
          >
            {props.seedDbcPending
              ? 'Seeding…'
              : 'Seed DBC Official Templates (TC · Provisional · Character)'}
          </Button>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={props.selectedCategory}
            onChange={(e) => props.setSelectedCategory(e.target.value)}
          >
            <option value="">Select certificate category</option>
            {groupCertificateCategories(props.categories).map((group) => (
              <optgroup key={group.group} label={group.label}>
                {group.items.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={props.onCreate}
            disabled={!props.selectedCategory}
            className="w-full"
          >
            Create Dynamic Template
          </Button>
          <div className="rounded-xl bg-white p-3 text-xs text-slate-600">
            Supports HTML mode, live preview, versioned layouts, variables, logo, QR, student photo,
            signatures, seal, watermark, border, and A4/Legal settings.
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {template.category?.name} / {template.orientation} / {template.pageSize}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                  {template.status}
                </span>
              </div>
              <div
                className="mt-3 h-36 overflow-hidden rounded-xl border bg-slate-50 p-3 text-[10px]"
                dangerouslySetInnerHTML={{ __html: template.versions?.[0]?.html ?? DEFAULT_HTML }}
              />
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={() => props.onPublish(template.id)}>
                  Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => props.onClone(template.id)}
                >
                  Clone
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function IssueConsole(props: {
  categories: CertificateCategory[];
  templates: CertificateTemplate[];
  students: any[];
  studentSearch: string;
  setStudentSearch: (value: string) => void;
  studentId: string;
  setStudentId: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedTemplate: string;
  setSelectedTemplate: (value: string) => void;
  selectedTemplateData?: CertificateTemplate;
  previewHtml?: string;
  previewLoading?: boolean;
  issueBlockers?: string[];
  issuePending?: boolean;
  isTransferCertificate?: boolean;
  tcFields?: {
    conduct: string;
    attendance: string;
    industry: string;
    fee_clearance: string;
    reason_for_leaving: string;
    date_of_leaving: string;
    remarks: string;
  };
  setTcFields?: (value: IssueConsole['tcFields']) => void;
  onRequest: () => void;
  onIssue: () => void;
  onBulkIssue: () => void;
  bulkMode?: boolean;
  studentMode?: boolean;
  studentProfile?: { studentId: string; enrollmentNumber: string; fullName: string };
}) {
  const visibleTemplates = props.selectedCategory
    ? props.templates.filter((template) => template.categoryId === props.selectedCategory)
    : props.templates;
  const canIssue = (props.issueBlockers?.length ?? 0) === 0 && !props.issuePending;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel
        title={
          props.studentMode
            ? 'Student Certificate Request Portal'
            : props.bulkMode
              ? 'Bulk Certificate Issue Center'
              : 'Certificate Generator'
        }
        icon={FileBadge}
      >
        <div className="space-y-3">
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={props.selectedCategory}
            onChange={(e) => props.setSelectedCategory(e.target.value)}
          >
            <option value="">Certificate type (required)</option>
            {groupCertificateCategories(props.categories).map((group) => (
              <optgroup key={group.group} label={group.label}>
                {group.items.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={props.selectedTemplate}
            onChange={(e) => props.setSelectedTemplate(e.target.value)}
          >
            <option value="">Auto-select published template</option>
            {visibleTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {props.studentMode ? (
            props.studentProfile ? (
              <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">
                  <StudentName name={props.studentProfile.fullName} />
                </p>
                <p className="text-xs text-slate-500">{props.studentProfile.enrollmentNumber}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading your student profile…</p>
            )
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search student by name / roll / registration"
                  value={props.studentSearch}
                  onChange={(e) => props.setStudentSearch(e.target.value)}
                />
              </div>
              <div className="max-h-56 overflow-auto rounded-xl border">
                {props.students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => props.setStudentId(student.id)}
                    className={`flex w-full justify-between px-3 py-2 text-left text-sm ${props.studentId === student.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
                  >
                    <span>
                      <StudentName name={student.fullName} />
                    </span>
                    <span className="text-xs text-slate-500">{student.enrollmentNumber}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className={`grid gap-2 ${props.studentMode ? '' : 'sm:grid-cols-2'}`}>
            <Button
              type="button"
              variant={props.studentMode ? 'default' : 'outline'}
              disabled={!canIssue}
              onClick={props.onRequest}
            >
              {props.studentMode ? 'Submit Request' : 'Submit Request'}
            </Button>
            {!props.studentMode ? (
              <Button type="button" disabled={!canIssue} onClick={props.onIssue}>
                {props.issuePending ? 'Issuing…' : 'Final Issue'}
              </Button>
            ) : null}
          </div>
          {!canIssue && props.issueBlockers?.length ? (
            <p className="text-xs text-amber-700">
              Select {props.issueBlockers.join(' and ')} to enable issue.
            </p>
          ) : null}
          {props.bulkMode ? (
            <Button
              type="button"
              className="w-full"
              disabled={!props.selectedCategory || props.students.length === 0}
              onClick={props.onBulkIssue}
            >
              Issue for Current Search Result
            </Button>
          ) : null}
          {props.isTransferCertificate && props.tcFields && props.setTcFields ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Transfer Certificate Details
              </p>
              <select
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={props.tcFields.conduct}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, conduct: e.target.value })
                }
              >
                {['Excellent', 'Very Good', 'Good', 'Satisfactory'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Attendance status or %"
                value={props.tcFields.attendance}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, attendance: e.target.value })
                }
              />
              <Input
                placeholder="Industry / diligence"
                value={props.tcFields.industry}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, industry: e.target.value })
                }
              />
              <select
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={props.tcFields.fee_clearance}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, fee_clearance: e.target.value })
                }
              >
                <option value="All dues cleared">All dues cleared</option>
                <option value="Pending">Pending</option>
              </select>
              <select
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={props.tcFields.reason_for_leaving}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, reason_for_leaving: e.target.value })
                }
              >
                {['Completed Programme', 'Transfer', 'Migration', 'Other'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={props.tcFields.date_of_leaving}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, date_of_leaving: e.target.value })
                }
              />
              <Input
                placeholder="Remarks (optional)"
                value={props.tcFields.remarks}
                onChange={(e) =>
                  props.setTcFields?.({ ...props.tcFields!, remarks: e.target.value })
                }
              />
            </div>
          ) : null}
        </div>
      </Panel>
      <Panel title="Live Certificate Preview" icon={BadgeCheck}>
        {props.previewLoading ? (
          <p className="text-sm text-slate-500">Rendering preview with student data…</p>
        ) : null}
        {!props.studentId ? (
          <p className="mb-3 text-sm text-slate-500">Select a student to preview with real data.</p>
        ) : null}
        <div className="overflow-auto rounded-2xl border bg-white p-4">
          <div
            className="mx-auto max-w-3xl origin-top scale-[0.82] rounded bg-white shadow-xl"
            dangerouslySetInnerHTML={{
              __html:
                props.previewHtml ??
                props.selectedTemplateData?.versions?.[0]?.html ??
                DEFAULT_HTML,
            }}
          />
        </div>
      </Panel>
    </div>
  );
}

function RequestsPanel({
  requests,
  roles,
  canApprove,
  canManage,
  onAction,
  onIssueApproved,
}: {
  requests: CertificateRequest[];
  roles: string[];
  canApprove: boolean;
  canManage: boolean;
  onAction: (id: string, action: 'APPROVE' | 'REJECT') => void;
  onIssueApproved: (request: CertificateRequest) => void;
}) {
  return (
    <Panel title="Approval Workflow Workspace" icon={ClipboardCheck}>
      <div className="space-y-3">
        {requests.map((request) => {
          const sortedSteps = [...(request.approvals ?? [])].sort(
            (a, b) => a.sequence - b.sequence,
          );
          const currentStep = sortedSteps.find((step) => step.status === 'PENDING');
          const canActOnStep =
            currentStep && canApprove && (canManage || roles.includes(currentStep.roleSlug ?? ''));
          return (
            <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">
                    {request.requestNo} - {request.category?.name ?? request.requestType}
                  </p>
                  <p className="text-xs text-slate-500">
                    Status: {request.status} / Priority: {request.priority}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canActOnStep && currentStep ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onAction(currentStep.id, 'APPROVE')}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAction(currentStep.id, 'REJECT')}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {canManage && request.status === 'APPROVED' && !request.issues?.length ? (
                    <Button type="button" size="sm" onClick={() => onIssueApproved(request)}>
                      Issue Certificate
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sortedSteps.map((step) => (
                  <span key={step.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                    {step.sequence}. {step.stepName} ({step.roleSlug}): {step.status}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function StudentRequestsPanel({ requests }: { requests: CertificateRequest[] }) {
  return (
    <Panel title="My Certificate Requests" icon={Send}>
      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-slate-500">
            No requests yet. Submit a certificate request above.
          </p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold">
                {request.requestNo} · {request.category?.name ?? request.requestType}
              </p>
              <p className="text-sm text-slate-500">Status: {request.status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...(request.approvals ?? [])]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((step) => (
                    <span key={step.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {step.stepName}: {step.status}
                    </span>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function StudentIssuesPanel({
  issues,
  onDownload,
}: {
  issues: CertificateIssue[];
  onDownload: (issueId: string) => Promise<Blob>;
}) {
  const handleDownload = async (issueId: string, certificateNo: string) => {
    const blob = await onDownload(issueId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const ext = blob.type.includes('pdf') ? '.pdf' : '.html';
    anchor.download = `${certificateNo.replace(/\//g, '-')}${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="My Issued Certificates" icon={FileCheck2}>
      <div className="grid gap-3 md:grid-cols-2">
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">No certificates issued yet.</p>
        ) : (
          issues.map((issue) => (
            <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">{issue.certificateNo}</p>
              <p className="text-sm text-slate-500">
                {issue.category?.name} · {issue.status}
              </p>
              {issue.status === 'ISSUED' ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => void handleDownload(issue.id, issue.certificateNo)}
                >
                  Download
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function VerificationPanel({
  issues,
  onPrint,
  onDownload,
  canRevoke,
  onRevoke,
}: {
  issues: CertificateIssue[];
  onPrint: (issueId: string, autoprint?: boolean) => void;
  onDownload: (issueId: string) => Promise<Blob>;
  canRevoke?: boolean;
  onRevoke?: (issueId: string, reason?: string) => void;
}) {
  const handleDownload = async (issueId: string, certificateNo: string) => {
    const blob = await onDownload(issueId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const ext = blob.type.includes('pdf') ? '.pdf' : '.html';
    anchor.download = `${certificateNo.replace(/\//g, '-')}${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleRevoke = (issueId: string) => {
    const reason = window.prompt('Reason for revocation (optional):') ?? undefined;
    onRevoke?.(issueId, reason || undefined);
  };

  return (
    <Panel title="QR Verification Portal" icon={QrCode}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {issues.map((issue) => (
          <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <QrCode className="h-8 w-8 text-slate-900" />
            <p className="mt-3 font-semibold">{issue.certificateNo}</p>
            <p className="text-sm text-slate-500">
              {issue.category?.name} / {issue.status}
            </p>
            <p className="mt-2 break-all rounded-xl bg-slate-50 p-2 text-xs">
              /verify/certificates/{issue.verificationToken}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onPrint(issue.id)}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print
              </Button>
              <Button type="button" size="sm" onClick={() => onPrint(issue.id, true)}>
                Save PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleDownload(issue.id, issue.certificateNo)}
              >
                Download PDF
              </Button>
              {canRevoke && issue.status === 'ISSUED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRevoke(issue.id)}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditPanel({ logs }: { logs: any[] }) {
  return (
    <Panel title="Certificate Audit Logs" icon={Fingerprint}>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border px-3 py-2 text-sm">
            <span className="font-medium">{log.action}</span>{' '}
            <span className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CertificateRegisterPanel({ authReady }: { authReady: boolean }) {
  const register = useQuery({
    queryKey: ['certificates', 'register'],
    queryFn: () => fetchCertificateRegister(),
    enabled: authReady,
  });
  const rows = register.data?.rows ?? [];

  const exportCsv = () => {
    const header = [
      'Certificate No',
      'Type',
      'Student',
      'Enrollment',
      'Programme',
      'Status',
      'Issued',
    ];
    const lines = rows.map((row) =>
      [
        row.certificateNo,
        row.categoryName,
        row.studentName,
        row.enrollmentNumber,
        row.programme,
        row.status,
        new Date(row.issuedAt).toISOString().slice(0, 10),
      ]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `certificate-register-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="Certificate Issuance Register" icon={BarChart3}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-3">
          <Signal label="Total records" value={String(register.data?.summary.total ?? 0)} />
          <Signal label="Issued" value={String(register.data?.summary.issued ?? 0)} />
          <Signal label="Revoked" value={String(register.data?.summary.revoked ?? 0)} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Certificate No</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Programme</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Issued</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{row.certificateNo}</td>
                <td className="px-3 py-2">{row.categoryName}</td>
                <td className="px-3 py-2">
                  <StudentName name={row.studentName} />
                  <br />
                  <span className="text-xs text-slate-500">{row.enrollmentNumber}</span>
                </td>
                <td className="px-3 py-2">{row.programme}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{new Date(row.issuedAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!register.isLoading && rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">No certificates issued yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function SettingsPanel({
  categories,
  authReady,
}: {
  categories: CertificateCategory[];
  authReady: boolean;
}) {
  const queryClient = useQueryClient();
  const [roleSlug, setRoleSlug] = useState('registrar');
  const [displayName, setDisplayName] = useState('');
  const [designation, setDesignation] = useState('');
  const [signaturePath, setSignaturePath] = useState('');
  const [sealPath, setSealPath] = useState('');
  const [message, setMessage] = useState('');
  const [seqCategoryCode, setSeqCategoryCode] = useState('TRANSFER');
  const [seqYear, setSeqYear] = useState(String(new Date().getFullYear()));
  const [seqPrefix, setSeqPrefix] = useState('DBC/TC');
  const [seqFormat, setSeqFormat] = useState('{{prefix}}/{{year}}/{{number}}');

  const signatures = useQuery({
    queryKey: ['certificates', 'signatures'],
    queryFn: fetchCertificateSignatures,
    enabled: authReady,
  });
  const sequences = useQuery({
    queryKey: ['certificates', 'sequences'],
    queryFn: fetchCertificateSequences,
    enabled: authReady,
  });

  const saveSignature = useMutation({
    mutationFn: () =>
      upsertCertificateSignature({
        roleSlug,
        displayName,
        designation: designation || undefined,
        signaturePath: signaturePath || undefined,
        sealPath: sealPath || undefined,
        isActive: true,
      }),
    onSuccess: () => {
      setMessage('Signature record saved.');
      void queryClient.invalidateQueries({ queryKey: ['certificates', 'signatures'] });
    },
  });

  const uploadAsset = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: 'signature' | 'seal' }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('roleSlug', roleSlug);
      form.append('kind', kind);
      return uploadCertificateSignatureAsset(form);
    },
    onSuccess: (result, variables) => {
      if (variables.kind === 'seal') setSealPath(result.path);
      else setSignaturePath(result.path);
      setMessage(`${variables.kind === 'seal' ? 'Seal' : 'Signature'} uploaded.`);
    },
  });

  const saveSequence = useMutation({
    mutationFn: () =>
      upsertCertificateSequence({
        categoryCode: seqCategoryCode,
        year: Number(seqYear),
        prefix: seqPrefix,
        format: seqFormat,
      }),
    onSuccess: () => {
      setMessage('Number sequence saved.');
      void queryClient.invalidateQueries({ queryKey: ['certificates', 'sequences'] });
    },
  });

  return (
    <Panel title="Certificate Settings" icon={Settings}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Registrar & Principal Signatures</p>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={roleSlug}
            onChange={(e) => setRoleSlug(e.target.value)}
          >
            <option value="registrar">Registrar</option>
            <option value="principal">Principal</option>
            <option value="controller">Controller of Examinations</option>
            <option value="seal">Official Seal</option>
          </select>
          <Input
            placeholder="Signatory name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            placeholder="Designation (optional)"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border bg-white px-3 py-2 text-xs">
              Signature image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-1 block w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAsset.mutate({ file, kind: 'signature' });
                }}
              />
            </label>
            <label className="rounded-xl border bg-white px-3 py-2 text-xs">
              Seal image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-1 block w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAsset.mutate({ file, kind: 'seal' });
                }}
              />
            </label>
          </div>
          {signaturePath ? (
            <p className="text-xs text-slate-500">Signature: {signaturePath}</p>
          ) : null}
          {sealPath ? <p className="text-xs text-slate-500">Seal: {sealPath}</p> : null}
          <Button
            type="button"
            disabled={!displayName.trim() || saveSignature.isPending}
            onClick={() => saveSignature.mutate()}
          >
            Save signature record
          </Button>
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        </div>
        <div className="space-y-3">
          <Signal
            label="Numbering"
            value="Category-wise prefixes, year reset, suffix, and auto increment are supported."
          />
          <Signal
            label="Category master"
            value={`${categories.length} certificate categories configured.`}
          />
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">Certificate number sequences</p>
            <div className="mt-3 space-y-2">
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={seqCategoryCode}
                onChange={(e) => setSeqCategoryCode(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Year"
                value={seqYear}
                onChange={(e) => setSeqYear(e.target.value)}
              />
              <Input
                placeholder="Prefix (e.g. DBC/TC)"
                value={seqPrefix}
                onChange={(e) => setSeqPrefix(e.target.value)}
              />
              <Input
                placeholder="Format"
                value={seqFormat}
                onChange={(e) => setSeqFormat(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={saveSequence.isPending}
                onClick={() => saveSequence.mutate()}
              >
                Save sequence
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {(
                sequences.data as
                  | Array<{
                      categoryCode: string;
                      year: number;
                      prefix: string;
                      currentNo: number;
                      format: string;
                    }>
                  | undefined
              )
                ?.slice(0, 8)
                .map((row) => (
                  <div
                    key={`${row.categoryCode}-${row.year}`}
                    className="rounded-lg bg-slate-50 px-3 py-2"
                  >
                    {row.categoryCode} / {row.year}: {row.prefix} · next {row.currentNo + 1} ·{' '}
                    {row.format}
                  </div>
                )) ?? null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">Active signatures</p>
            <div className="mt-3 space-y-2 text-sm">
              {(signatures.data ?? []).length === 0 ? (
                <p className="text-slate-500">No signatures configured yet.</p>
              ) : (
                (
                  signatures.data as Array<{
                    roleSlug: string;
                    displayName: string;
                    signaturePath?: string;
                    sealPath?: string;
                  }>
                ).map((row) => (
                  <div
                    key={row.roleSlug}
                    className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span>
                      {row.roleSlug} · {row.displayName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {row.signaturePath || row.sealPath ? 'Asset linked' : 'Name only'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-2xl bg-blue-50 p-2 text-blue-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MiniList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{value}</p>
    </div>
  );
}
