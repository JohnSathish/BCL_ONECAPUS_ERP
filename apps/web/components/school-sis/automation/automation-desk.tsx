'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  activateSchoolAutoWorkflow,
  archiveSchoolAutoWorkflow,
  fetchSchoolAutoCatalog,
  fetchSchoolAutoDashboard,
  fetchSchoolAutoExecutions,
  fetchSchoolAutoFailed,
  fetchSchoolAutoLogs,
  fetchSchoolAutoReports,
  fetchSchoolAutoSettings,
  fetchSchoolAutoTemplates,
  fetchSchoolAutoWorkflows,
  pauseSchoolAutoWorkflow,
  presetSchoolAutoWorkflow,
  promptSchoolAutoWorkflow,
  retryAllSchoolAutoFailed,
  retrySchoolAutoFailed,
  runSchoolAutoWorkflow,
  saveSchoolAutoSettings,
  saveSchoolAutoTemplate,
  saveSchoolAutoWorkflow,
  testSchoolAutoWorkflow,
} from '@/services/school-automation';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge, WaCard } from '../whatsapp/whatsapp-ui';

const LINKS = [
  { href: '/admin/school-sis/automation', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/automation/workflows', label: 'Workflows' },
  { href: '/admin/school-sis/automation/scheduled', label: 'Scheduled' },
  { href: '/admin/school-sis/automation/rules', label: 'Rules & Triggers' },
  { href: '/admin/school-sis/automation/templates', label: 'Templates' },
  { href: '/admin/school-sis/automation/logs', label: 'Execution Logs' },
  { href: '/admin/school-sis/automation/failed', label: 'Failed Jobs' },
  { href: '/admin/school-sis/automation/reports', label: 'Reports' },
  { href: '/admin/school-sis/automation/settings', label: 'Settings' },
];

type Node = { id: string; type: string; data: Record<string, unknown> };
type Edge = { id: string; source: string; target: string; handle?: string };

function sectionOf(pathname: string | null) {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  const i = parts.indexOf('automation');
  return parts[i + 1] ?? 'dashboard';
}

export function AutomationDesk() {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionOf(pathname);
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [runConfirm, setRunConfirm] = useState<string | null>(null);
  const [name, setName] = useState('Fee Reminder - 3 Days Before');
  const [description, setDescription] = useState('Automatically remind parents');
  const [triggerEvent, setTriggerEvent] = useState('fee.due_soon');
  const [triggerType, setTriggerType] = useState('RELATIVE');
  const [nodes, setNodes] = useState<Node[]>([
    { id: 't1', type: 'TRIGGER', data: { event: 'fee.due_soon' } },
  ]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string>('t1');

  const dash = useQuery({
    queryKey: ['school-auto-dash'],
    queryFn: fetchSchoolAutoDashboard,
    enabled,
  });
  const catalog = useQuery({
    queryKey: ['school-auto-catalog'],
    queryFn: fetchSchoolAutoCatalog,
    enabled,
  });
  const workflows = useQuery({
    queryKey: ['school-auto-wf'],
    queryFn: fetchSchoolAutoWorkflows,
    enabled: enabled && ['dashboard', 'workflows', 'scheduled', 'rules'].includes(section),
  });
  const executions = useQuery({
    queryKey: ['school-auto-ex'],
    queryFn: () => fetchSchoolAutoExecutions(),
    enabled: enabled && ['dashboard', 'logs'].includes(section),
  });
  const failed = useQuery({
    queryKey: ['school-auto-failed'],
    queryFn: fetchSchoolAutoFailed,
    enabled: enabled && section === 'failed',
  });
  const templates = useQuery({
    queryKey: ['school-auto-tpl'],
    queryFn: fetchSchoolAutoTemplates,
    enabled: enabled && section === 'templates',
  });
  const reports = useQuery({
    queryKey: ['school-auto-rep'],
    queryFn: fetchSchoolAutoReports,
    enabled: enabled && section === 'reports',
  });
  const settings = useQuery({
    queryKey: ['school-auto-set'],
    queryFn: fetchSchoolAutoSettings,
    enabled: enabled && section === 'settings',
  });
  const logs = useQuery({
    queryKey: ['school-auto-audit'],
    queryFn: fetchSchoolAutoLogs,
    enabled: enabled && section === 'settings',
  });

  const d = dash.data as Record<string, number> | undefined;
  const cats = catalog.data as
    | {
        triggers?: Array<{ event: string; label: string; category: string; type: string }>;
        presets?: Array<{ id: string; name: string; description: string }>;
        actions?: Array<{ type: string; label: string }>;
        variables?: string[];
      }
    | undefined;

  const addNode = (type: string) => {
    const id = `${type.toLowerCase()}_${Date.now()}`;
    const last = nodes[nodes.length - 1];
    setNodes((n) => [
      ...n,
      {
        id,
        type,
        data: type === 'ACTION' ? { type: 'SEND_WHATSAPP', recipient: 'PARENT', body: '' } : {},
      },
    ]);
    if (last)
      setEdges((e) => [
        ...e,
        {
          id: `e_${id}`,
          source: last.id,
          target: id,
          handle: type === 'CONDITION' ? 'yes' : undefined,
        },
      ]);
    setSelected(id);
  };

  const selectedNode = nodes.find((n) => n.id === selected);

  const saveMut = useMutation({
    mutationFn: () =>
      saveSchoolAutoWorkflow(
        {
          name,
          description,
          triggerType,
          triggerEvent,
          graphJson: { nodes, edges },
          scheduleJson: triggerType === 'RELATIVE' ? { offsetDays: -3, time: '08:00' } : {},
        },
        editingId ?? undefined,
      ),
    onSuccess: (row: { id?: string }) => {
      setEditingId(row.id ?? editingId);
      void qc.invalidateQueries({ queryKey: ['school-auto-wf'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const title =
    section === 'workflows'
      ? 'Workflows'
      : section === 'scheduled'
        ? 'Scheduled Tasks'
        : section === 'rules'
          ? 'Rules & Triggers'
          : section === 'templates'
            ? 'Templates'
            : section === 'logs'
              ? 'Execution Logs'
              : section === 'failed'
                ? 'Failed Jobs'
                : section === 'reports'
                  ? 'Automation Reports'
                  : section === 'settings'
                    ? 'Automation Settings'
                    : 'Automation Dashboard';

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Automation
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Event-driven workflows for attendance, fees, exams and school communication.
          </p>
        </div>
        {canManage ? (
          <PrimaryButton
            onClick={() => {
              setBuilder(true);
              setEditingId(null);
            }}
          >
            Create Workflow
          </PrimaryButton>
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-2">
        {LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
                active
                  ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {section === 'dashboard' ? (
        dash.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <WaCard label="Active Automations" value={d?.active ?? 0} />
              <WaCard label="Executed Today" value={d?.executedToday ?? 0} />
              <WaCard label="Successful" value={d?.successful ?? 0} />
              <WaCard label="Failed" value={d?.failed ?? 0} />
              <WaCard label="Scheduled" value={d?.scheduled ?? 0} />
              <WaCard label="Messages Sent" value={d?.messagesSent ?? 0} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <WaCard label="Pending Jobs" value={d?.queued ?? 0} />
              <WaCard label="Retrying" value={d?.retrying ?? 0} />
              <WaCard label="Paused Workflows" value={d?.paused ?? 0} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-[#1e3a8a]">Recent activity</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {((dash.data as { recent?: Array<Record<string, unknown>> })?.recent ?? []).map(
                  (row) => (
                    <li
                      key={String(row.id)}
                      className="flex flex-wrap justify-between gap-2 border-b border-slate-50 py-2"
                    >
                      <span>
                        {String(
                          (row.workflow as { name?: string } | undefined)?.name ?? row.triggerEvent,
                        )}
                      </span>
                      <WaBadge value={String(row.status)} />
                      <span className="text-slate-400">
                        {new Date(String(row.createdAt)).toLocaleString()}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </>
        )
      ) : null}

      {['workflows', 'scheduled', 'rules'].includes(section) ? (
        <div className="space-y-3">
          {section === 'workflows' && canManage ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-[#1e3a8a]">AI workflow assistant</p>
              <p className="text-xs text-slate-500">
                Describes a draft. Nothing is activated until you review it.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Send parents a WhatsApp reminder three days before unpaid fees are due"
                />
                <PrimaryButton
                  onClick={() =>
                    promptSchoolAutoWorkflow(prompt).then((row: { id?: string }) => {
                      if (row.id) router.push('/admin/school-sis/automation/workflows');
                      void qc.invalidateQueries({ queryKey: ['school-auto-wf'] });
                    })
                  }
                >
                  Generate draft
                </PrimaryButton>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {(cats?.presets ?? []).map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-[#1e3a8a]">{p.name}</p>
                <p className="text-sm text-slate-500">{p.description}</p>
                {canManage ? (
                  <GhostButton
                    className="mt-2"
                    onClick={() =>
                      presetSchoolAutoWorkflow(p.id).then(() => qc.invalidateQueries())
                    }
                  >
                    Use template
                  </GhostButton>
                ) : null}
              </div>
            ))}
          </div>
          <WorkflowTable
            rows={(workflows.data ?? []).filter((w) =>
              section === 'scheduled'
                ? ['SCHEDULE', 'RELATIVE', 'RECURRING'].includes(String(w.triggerType))
                : true,
            )}
            canManage={canManage}
            onEdit={(row) => {
              setEditingId(String(row.id));
              setName(String(row.name));
              setDescription(String(row.description ?? ''));
              setTriggerEvent(String(row.triggerEvent));
              setTriggerType(String(row.triggerType));
              const g = row.graphJson as { nodes?: Node[]; edges?: Edge[] };
              setNodes(g.nodes ?? []);
              setEdges(g.edges ?? []);
              setBuilder(true);
            }}
            onActivate={(id) => activateSchoolAutoWorkflow(id).then(() => qc.invalidateQueries())}
            onPause={(id) => pauseSchoolAutoWorkflow(id).then(() => qc.invalidateQueries())}
            onTest={(id) => testSchoolAutoWorkflow(id, {}).then(() => qc.invalidateQueries())}
            onRun={(id) => setRunConfirm(id)}
            onArchive={(id) => archiveSchoolAutoWorkflow(id).then(() => qc.invalidateQueries())}
          />
        </div>
      ) : null}

      {section === 'templates' ? (
        <Templates
          canManage={canManage}
          rows={templates.data ?? []}
          onSave={(p) => saveSchoolAutoTemplate(p).then(() => qc.invalidateQueries())}
        />
      ) : null}

      {section === 'logs' ? <ExecTable rows={executions.data ?? []} /> : null}

      {section === 'failed' ? (
        <div>
          {canManage ? (
            <PrimaryButton
              className="mb-3"
              onClick={() => retryAllSchoolAutoFailed().then(() => qc.invalidateQueries())}
            >
              Retry all retryable
            </PrimaryButton>
          ) : null}
          <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {['Workflow', 'Channel', 'Error', 'Attempts', ''].map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(failed.data ?? []).map((row) => (
                  <tr key={String(row.id)} className="border-t">
                    <td className="px-3 py-2">
                      {String(
                        (row.execution as { workflow?: { name?: string } })?.workflow?.name ?? '',
                      )}
                    </td>
                    <td className="px-3 py-2">{String(row.channel ?? '')}</td>
                    <td className="px-3 py-2 text-rose-700">{String(row.error ?? '')}</td>
                    <td className="px-3 py-2">{String(row.retryCount ?? 0)}</td>
                    <td className="px-3 py-2">
                      <GhostButton
                        onClick={() =>
                          retrySchoolAutoFailed(String(row.id)).then(() => qc.invalidateQueries())
                        }
                      >
                        Retry
                      </GhostButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'reports' && reports.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <WaCard label="Total executions" value={Number(reports.data.total ?? 0)} />
          <WaCard
            label="Success rate"
            value={`${Math.round(Number(reports.data.successRate ?? 0) * 100)}%`}
          />
          <WaCard
            label="Failure rate"
            value={`${Math.round(Number(reports.data.failureRate ?? 0) * 100)}%`}
          />
          <button
            type="button"
            className="rounded-2xl border bg-white p-4 text-left text-sm font-semibold text-[#1e3a8a] shadow-sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(reports.data, null, 2)], {
                type: 'application/json',
              });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'automation-report.json';
              a.click();
            }}
          >
            Export JSON / CSV source
          </button>
        </div>
      ) : null}

      {section === 'settings' ? (
        <form
          className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            saveSchoolAutoSettings({
              quietHoursEnabled: fd.get('quietHoursEnabled') === 'on',
              quietFrom: String(fd.get('quietFrom')),
              quietTo: String(fd.get('quietTo')),
              holidayPolicy: String(fd.get('holidayPolicy')),
              maxWaPerMinute: Number(fd.get('maxWaPerMinute')),
              retryAttempts: Number(fd.get('retryAttempts')),
            }).then(() => qc.invalidateQueries({ queryKey: ['school-auto-set'] }));
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="quietHoursEnabled"
              defaultChecked={Boolean(settings.data?.quietHoursEnabled)}
            />{' '}
            Quiet hours
          </label>
          <label className="text-sm">
            From{' '}
            <input
              name="quietFrom"
              defaultValue={String(settings.data?.quietFrom ?? '22:00')}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            To{' '}
            <input
              name="quietTo"
              defaultValue={String(settings.data?.quietTo ?? '07:00')}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Holiday policy
            <select
              name="holidayPolicy"
              defaultValue={String(settings.data?.holidayPolicy ?? 'PREVIOUS_WORKING_DAY')}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="PREVIOUS_WORKING_DAY">Previous working day</option>
              <option value="NEXT_WORKING_DAY">Next working day</option>
              <option value="SEND_ANYWAY">Send anyway</option>
            </select>
          </label>
          <label className="text-sm">
            WhatsApp / minute{' '}
            <input
              name="maxWaPerMinute"
              type="number"
              defaultValue={Number(settings.data?.maxWaPerMinute ?? 80)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Retry attempts{' '}
            <input
              name="retryAttempts"
              type="number"
              defaultValue={Number(settings.data?.retryAttempts ?? 5)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          {canManage ? (
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">Save settings</PrimaryButton>
            </div>
          ) : null}
          <div className="sm:col-span-2 text-xs text-slate-500">
            {(logs.data ?? []).slice(0, 8).map((l) => (
              <p key={String(l.id)}>
                {new Date(String(l.createdAt)).toLocaleString()} — {String(l.action)}
              </p>
            ))}
          </div>
        </form>
      ) : null}

      <Dialog open={builder} onOpenChange={setBuilder}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create automation</DialogTitle>
            <DialogDescription>
              Drag components onto the canvas. Review before activating.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-hidden lg:grid-cols-[180px_1fr_260px]">
            <div className="space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2 text-sm">
              {[
                'TRIGGER',
                'CONDITION',
                'DELAY',
                'ACTION',
                'BRANCH',
                'WEBHOOK',
                'WAIT',
                'APPROVAL',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('node', t)}
                  onClick={() => addNode(t === 'TRIGGER' ? 'TRIGGER' : t)}
                  className="w-full rounded-lg bg-white px-3 py-2 text-left font-medium shadow-sm ring-1 ring-slate-200"
                >
                  {t}
                </button>
              ))}
            </div>
            <div
              className="space-y-2 overflow-y-auto rounded-xl bg-[#eef3fb] p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const t = e.dataTransfer.getData('node');
                if (t) addNode(t);
              }}
            >
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {nodes.map((node, i) => (
                <div key={node.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelected(node.id)}
                    className={cn(
                      'w-full max-w-md rounded-2xl border bg-white p-4 text-left shadow-sm',
                      selected === node.id
                        ? 'border-[#2563eb] ring-2 ring-blue-100'
                        : 'border-slate-200',
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase text-slate-400">
                      {node.type}
                    </p>
                    <p className="font-medium text-[#1e3a8a]">
                      {String(node.data.type || node.data.event || node.type)}
                    </p>
                  </button>
                  {i < nodes.length - 1 ? <div className="h-6 w-px bg-slate-300" /> : null}
                </div>
              ))}
            </div>
            <div className="space-y-2 overflow-y-auto rounded-xl border bg-white p-3 text-sm">
              <p className="font-semibold text-[#1e3a8a]">Configuration</p>
              {selectedNode?.type === 'TRIGGER' ? (
                <select
                  className="w-full rounded-lg border px-2 py-2"
                  value={triggerEvent}
                  onChange={(e) => {
                    const ev = e.target.value;
                    const meta = cats?.triggers?.find((t) => t.event === ev);
                    setTriggerEvent(ev);
                    setTriggerType(meta?.type ?? 'EVENT');
                    setNodes((n) =>
                      n.map((x) => (x.id === selected ? { ...x, data: { event: ev } } : x)),
                    );
                  }}
                >
                  {(cats?.triggers ?? []).map((t) => (
                    <option key={t.event} value={t.event}>
                      {t.category}: {t.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {selectedNode?.type === 'ACTION' ? (
                <>
                  <select
                    className="w-full rounded-lg border px-2 py-2"
                    value={String(selectedNode.data.type ?? 'SEND_WHATSAPP')}
                    onChange={(e) =>
                      setNodes((n) =>
                        n.map((x) =>
                          x.id === selected
                            ? { ...x, data: { ...x.data, type: e.target.value } }
                            : x,
                        ),
                      )
                    }
                  >
                    {(cats?.actions ?? []).map((a) => (
                      <option key={a.type} value={a.type}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-lg border px-2 py-2"
                    value={String(selectedNode.data.recipient ?? 'PARENT')}
                    onChange={(e) =>
                      setNodes((n) =>
                        n.map((x) =>
                          x.id === selected
                            ? { ...x, data: { ...x.data, recipient: e.target.value } }
                            : x,
                        ),
                      )
                    }
                  >
                    {[
                      'PARENT',
                      'STUDENT',
                      'GUARDIAN',
                      'CLASS_TEACHER',
                      'ACCOUNTANT',
                      'PRINCIPAL',
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border px-2 py-2"
                    value={String(selectedNode.data.body ?? '')}
                    onChange={(e) =>
                      setNodes((n) =>
                        n.map((x) =>
                          x.id === selected
                            ? { ...x, data: { ...x.data, body: e.target.value } }
                            : x,
                        ),
                      )
                    }
                  />
                  <div className="flex flex-wrap gap-1">
                    {(cats?.variables ?? []).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]"
                        onClick={() =>
                          setNodes((n) =>
                            n.map((x) =>
                              x.id === selected
                                ? {
                                    ...x,
                                    data: {
                                      ...x.data,
                                      body: `${String(x.data.body ?? '')}{{${v}}}`,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl bg-slate-900 p-3 text-xs text-white">
                    <p className="text-slate-400">WhatsApp preview</p>
                    <p className="mt-2 whitespace-pre-wrap">
                      {String(selectedNode.data.body || 'Message preview')}
                    </p>
                  </div>
                </>
              ) : null}
              {selectedNode?.type === 'CONDITION' ? (
                <p className="text-slate-500">
                  AND/OR groups are stored on the node. Use presets for nested fee and attendance
                  rules, then adjust fields in JSON-backed conditions after save.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <GhostButton onClick={() => setBuilder(false)}>Cancel</GhostButton>
            <GhostButton disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Save draft
            </GhostButton>
            <PrimaryButton
              disabled={saveMut.isPending}
              onClick={async () => {
                const row = (await saveMut.mutateAsync()) as { id?: string };
                if (row.id) await activateSchoolAutoWorkflow(row.id);
                setBuilder(false);
                void qc.invalidateQueries();
              }}
            >
              Save & activate
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(runConfirm)} onOpenChange={() => setRunConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run now</DialogTitle>
            <DialogDescription>
              This workflow may send messages to many recipients. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <GhostButton onClick={() => setRunConfirm(null)}>Cancel</GhostButton>
            <PrimaryButton
              onClick={() => {
                if (runConfirm)
                  runSchoolAutoWorkflow(runConfirm).then(() => {
                    setRunConfirm(null);
                    void qc.invalidateQueries();
                  });
              }}
            >
              Confirm & run
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowTable({
  rows,
  canManage,
  onEdit,
  onActivate,
  onPause,
  onTest,
  onRun,
  onArchive,
}: {
  rows: Array<Record<string, unknown>>;
  canManage: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onActivate: (id: string) => void;
  onPause: (id: string) => void;
  onTest: (id: string) => void;
  onRun: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <p className="font-semibold text-[#1e3a8a]">No automations yet</p>
        <p className="text-sm text-slate-500">Use a school preset or create a workflow.</p>
      </div>
    );
  }
  return (
    <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {['Name', 'Trigger', 'Status', 'Version', ''].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)} className="border-t">
              <td className="px-3 py-2">{String(row.name)}</td>
              <td className="px-3 py-2">{String(row.triggerEvent)}</td>
              <td className="px-3 py-2">
                <WaBadge value={String(row.status)} />
              </td>
              <td className="px-3 py-2">v{String(row.version)}</td>
              <td className="px-3 py-2">
                {canManage ? (
                  <>
                    <GhostButton onClick={() => onEdit(row)}>Edit</GhostButton>
                    {row.status === 'ACTIVE' ? (
                      <GhostButton onClick={() => onPause(String(row.id))}>Pause</GhostButton>
                    ) : (
                      <GhostButton onClick={() => onActivate(String(row.id))}>Activate</GhostButton>
                    )}
                    <GhostButton onClick={() => onTest(String(row.id))}>Test</GhostButton>
                    <GhostButton onClick={() => onRun(String(row.id))}>Run now</GhostButton>
                    <GhostButton onClick={() => onArchive(String(row.id))}>Archive</GhostButton>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {['Code', 'Workflow', 'Status', 'When'].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{String(row.code)}</td>
              <td className="px-3 py-2">
                {String((row.workflow as { name?: string } | undefined)?.name ?? '')}
              </td>
              <td className="px-3 py-2">
                <WaBadge value={String(row.status)} />
              </td>
              <td className="px-3 py-2">{new Date(String(row.createdAt)).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Templates({
  rows,
  canManage,
  onSave,
}: {
  rows: Array<Record<string, unknown>>;
  canManage: boolean;
  onSave: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [name, setName] = useState('Fee reminder');
  const [body, setBody] = useState(
    'Dear {{parent_name}}, fee for {{student_name}} is due on {{due_date}}.',
  );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {canManage ? (
        <div className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-lg border px-3 py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <PrimaryButton
            onClick={() => onSave({ name, body, channel: 'WHATSAPP', category: 'FEE' })}
          >
            Save template
          </PrimaryButton>
        </div>
      ) : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={String(row.id)} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="font-semibold text-[#1e3a8a]">{String(row.name)}</p>
            <p className="text-sm text-slate-600">{String(row.body)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
