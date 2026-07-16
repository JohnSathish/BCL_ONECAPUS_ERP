'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { api } from '@/services/api';
import { fetchAlumniAdminSettings, openAlumniAdminMembershipCard } from '@/services/alumni-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { useEffect, useState } from 'react';

type AlumniRow = {
  id: string;
  fullName: string;
  membershipNumber: string | null;
  graduationYear: number | null;
  programme: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  memberships?: Array<{
    status: string;
    membershipType?: { name: string; code: string };
  }>;
};

type Dashboard = {
  totalAlumni: number;
  activeMembers: number;
  pendingRegistrations: number;
  todaysRegistrations: number;
  annualMembers: number;
  lifeMembers: number;
  donationsInr: number;
  upcomingEvents: number;
};

export default function AdminAlumniPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');

  const dash = useQuery({
    queryKey: ['alumni-admin-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<Dashboard>('/v1/alumni/dashboard');
      return data;
    },
    enabled: Boolean(session),
  });

  const list = useQuery({
    queryKey: ['alumni-admin-list', q],
    queryFn: async () => {
      const { data } = await api.get<AlumniRow[]>('/v1/alumni/profiles', {
        params: { q: q || undefined },
      });
      return data;
    },
    enabled: Boolean(session),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/v1/alumni/${id}/activate`);
      return data;
    },
    onSuccess: () => {
      setMessage('Membership activated.');
      void qc.invalidateQueries({ queryKey: ['alumni-admin-list'] });
      void qc.invalidateQueries({ queryKey: ['alumni-admin-dashboard'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Activation failed')),
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    summary: '',
    venue: '',
    startsAt: '',
    eventType: 'REUNION',
  });
  const [eventMessage, setEventMessage] = useState('');
  const [portalMessage, setPortalMessage] = useState('');
  const [portalForm, setPortalForm] = useState({
    associationName: '',
    tagline: '',
    heroImageUrl: '',
    heroImagesText: '',
  });

  const portalInfo = useQuery({
    queryKey: ['alumni-admin-settings'],
    queryFn: fetchAlumniAdminSettings,
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!portalInfo.data?.settings) return;
    const settings = portalInfo.data.settings;
    setPortalForm({
      associationName: settings.associationName || '',
      tagline: settings.tagline || '',
      heroImageUrl: settings.heroImageUrl || '',
      heroImagesText: (settings.heroImages || []).join('\n'),
    });
  }, [portalInfo.data]);

  const events = useQuery({
    queryKey: ['alumni-admin-events'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: string;
          title: string;
          startsAt: string;
          venue: string | null;
          isPublished: boolean;
          eventType: string;
        }>
      >('/v1/alumni/events');
      return data;
    },
    enabled: Boolean(session),
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/v1/alumni/events', {
        ...eventForm,
        isPublished: true,
      });
      return data;
    },
    onSuccess: () => {
      setEventMessage('Event published on the alumni portal.');
      setEventForm({ title: '', summary: '', venue: '', startsAt: '', eventType: 'REUNION' });
      void qc.invalidateQueries({ queryKey: ['alumni-admin-events'] });
      void qc.invalidateQueries({ queryKey: ['alumni-admin-dashboard'] });
    },
    onError: (e) => setEventMessage(apiErrorMessage(e, 'Could not create event')),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const path = publish
        ? `/v1/alumni/events/${id}/publish`
        : `/v1/alumni/events/${id}/unpublish`;
      const { data } = await api.post(path, publish ? { isPublished: true } : undefined);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alumni-admin-events'] });
      void qc.invalidateQueries({ queryKey: ['alumni-admin-dashboard'] });
    },
  });

  const savePortalSettings = useMutation({
    mutationFn: async () => {
      const heroImages = portalForm.heroImagesText
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
      const { data } = await api.patch('/v1/alumni/settings/portal', {
        associationName: portalForm.associationName,
        tagline: portalForm.tagline,
        heroImageUrl: portalForm.heroImageUrl,
        heroImages,
      });
      return data;
    },
    onSuccess: () => {
      setPortalMessage('Alumni portal slider settings saved.');
      void qc.invalidateQueries({ queryKey: ['alumni-admin-settings'] });
      void qc.invalidateQueries({ queryKey: ['alumni-portal-info'] });
    },
    onError: (e) => setPortalMessage(apiErrorMessage(e, 'Could not save portal settings')),
  });

  const d = dash.data;

  return (
    <DashboardShell role="admin" title="Alumni">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Alumni Management</h1>
          <p className="text-sm text-muted-foreground">
            Membership, events, and verification. Public portal:{' '}
            <code className="text-xs">/alumni-portal</code>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total Alumni" value={d?.totalAlumni} />
          <Metric label="Active Members" value={d?.activeMembers} />
          <Metric label="Pending" value={d?.pendingRegistrations} />
          <Metric label="Today" value={d?.todaysRegistrations} />
          <Metric label="Annual Members" value={d?.annualMembers} />
          <Metric label="Permanent Members" value={d?.lifeMembers} />
          <Metric
            label="Donations (₹)"
            value={d?.donationsInr != null ? Math.round(d.donationsInr) : undefined}
          />
          <Metric label="Upcoming Events" value={d?.upcomingEvents} />
        </div>

        <CompactCard>
          <CompactCardHeader
            title="Homepage slider"
            description="Manage the alumni homepage hero slider. Add one image URL per line."
          />
          <CompactCardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Association name"
                value={portalForm.associationName}
                onChange={(e) =>
                  setPortalForm((form) => ({ ...form, associationName: e.target.value }))
                }
              />
              <Input
                placeholder="Primary hero image URL"
                value={portalForm.heroImageUrl}
                onChange={(e) =>
                  setPortalForm((form) => ({ ...form, heroImageUrl: e.target.value }))
                }
              />
              <Input
                className="sm:col-span-2"
                placeholder="Portal tagline"
                value={portalForm.tagline}
                onChange={(e) => setPortalForm((form) => ({ ...form, tagline: e.target.value }))}
              />
              <textarea
                className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
                placeholder={'One slider image URL per line\n/branding/alumni-campus-hero.png'}
                value={portalForm.heroImagesText}
                onChange={(e) =>
                  setPortalForm((form) => ({ ...form, heroImagesText: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={savePortalSettings.isPending}
                onClick={() => savePortalSettings.mutate()}
              >
                {savePortalSettings.isPending ? 'Saving…' : 'Save slider settings'}
              </Button>
              {portalMessage ? (
                <p className="text-sm text-muted-foreground">{portalMessage}</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Default campus image is already available as{' '}
              <code>/branding/alumni-campus-hero.png</code>.
            </p>
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Publish an event"
            description="Events marked published appear on the public Alumni portal Events page."
          />
          <CompactCardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Event title *"
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Input
                placeholder="Venue"
                value={eventForm.venue}
                onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
              />
              <Input
                type="datetime-local"
                value={eventForm.startsAt}
                onChange={(e) => setEventForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={eventForm.eventType}
                onChange={(e) => setEventForm((f) => ({ ...f, eventType: e.target.value }))}
              >
                <option value="REUNION">Reunion</option>
                <option value="MEETING">Meeting</option>
                <option value="WEBINAR">Webinar</option>
                <option value="DEPARTMENT">Department Event</option>
              </select>
              <Input
                className="sm:col-span-2"
                placeholder="Short summary"
                value={eventForm.summary}
                onChange={(e) => setEventForm((f) => ({ ...f, summary: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={createEvent.isPending || !eventForm.title.trim() || !eventForm.startsAt}
                onClick={() => createEvent.mutate()}
              >
                {createEvent.isPending ? 'Publishing…' : 'Publish event'}
              </Button>
              {eventMessage ? (
                <p className="text-sm text-muted-foreground">{eventMessage}</p>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Venue</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(events.data ?? []).map((ev) => (
                    <tr key={ev.id} className="border-b border-border/40">
                      <td className="py-2 font-medium">{ev.title}</td>
                      <td className="py-2">{new Date(ev.startsAt).toLocaleString('en-IN')}</td>
                      <td className="py-2">{ev.venue || '—'}</td>
                      <td className="py-2">{ev.isPublished ? 'Published' : 'Draft'}</td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={togglePublish.isPending}
                          onClick={() =>
                            togglePublish.mutate({
                              id: ev.id,
                              publish: !ev.isPublished,
                            })
                          }
                        >
                          {ev.isPublished ? 'Unpublish' : 'Publish'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!events.isLoading && (events.data?.length ?? 0) === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No events yet — create one above.
                </p>
              ) : null}
            </div>
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Alumni register"
            description="Activate pending members after office / committee verification."
          />
          <CompactCardBody className="space-y-3">
            <Input
              placeholder="Search name, email, membership number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Year</th>
                    <th className="pb-2 font-medium">Dept / Programme</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Membership</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-border/40">
                      <td className="py-2">
                        <div className="font-medium">{row.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.membershipNumber || row.email || row.phone || '—'}
                        </div>
                      </td>
                      <td className="py-2">{row.graduationYear ?? '—'}</td>
                      <td className="py-2">{row.department || row.programme || '—'}</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2">{row.memberships?.[0]?.membershipType?.name || '—'}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {row.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void openAlumniAdminMembershipCard(row.id).catch((e) =>
                                  setMessage(apiErrorMessage(e, 'Could not open membership card')),
                                );
                              }}
                            >
                              Card PDF
                            </Button>
                          ) : null}
                          {row.status !== 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={activate.isPending}
                              onClick={() => activate.mutate(row.id)}
                            >
                              Activate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.isLoading ? (
                <p className="py-4 text-sm text-muted-foreground">Loading…</p>
              ) : null}
            </div>
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value == null ? '—' : value.toLocaleString('en-IN')}
      </p>
    </div>
  );
}
