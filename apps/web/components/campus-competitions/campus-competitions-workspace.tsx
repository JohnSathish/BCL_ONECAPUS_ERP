'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Home, Loader2, Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  StcEmptyState,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import {
  autoAllocateHouses,
  createEvent,
  createHouse,
  createMeet,
  downloadMeetReportCsv,
  fetchHouses,
  fetchLeaderboard,
  fetchMeet,
  fetchMeetTypes,
  fetchMeets,
  generateFixtures,
  issueParticipationCertificates,
  issuePlaceCertificates,
  transitionMeetStatus,
  updatePointRules,
  type CompetitionMeet,
} from '@/services/campus-competitions';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'houses' | 'meets' | 'scoring' | 'reports';

export function CampusCompetitionsWorkspace() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('houses');
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selectedMeetId, setSelectedMeetId] = useState<string>('');

  const housesQ = useQuery({
    queryKey: ['campus-competitions', 'houses'],
    queryFn: () => fetchHouses(),
  });
  const meetsQ = useQuery({
    queryKey: ['campus-competitions', 'meets'],
    queryFn: () => fetchMeets(),
  });
  const typesQ = useQuery({
    queryKey: ['campus-competitions', 'meet-types'],
    queryFn: fetchMeetTypes,
  });
  const meetQ = useQuery({
    queryKey: ['campus-competitions', 'meet', selectedMeetId],
    queryFn: () => fetchMeet(selectedMeetId),
    enabled: Boolean(selectedMeetId),
  });
  const boardQ = useQuery({
    queryKey: ['campus-competitions', 'leaderboard', selectedMeetId],
    queryFn: () => fetchLeaderboard(selectedMeetId),
    enabled: Boolean(selectedMeetId),
    refetchInterval: 15_000,
  });

  const houses = housesQ.data ?? [];
  const meets = meetsQ.data ?? [];
  const selectedMeet = meetQ.data;

  const [houseForm, setHouseForm] = useState({
    name: '',
    code: '',
    color: '#2563eb',
    motto: '',
  });
  const [meetForm, setMeetForm] = useState({
    name: '',
    meetType: 'SPORTS_DAY',
    startsAt: '',
    endsAt: '',
    venue: '',
    theme: '',
  });
  const [eventName, setEventName] = useState('');
  const [entryMode, setEntryMode] = useState('INDIVIDUAL');
  const [pointsForm, setPointsForm] = useState({
    firstPoints: 10,
    secondPoints: 7,
    thirdPoints: 5,
    participationPoints: 2,
  });

  const createHouseMut = useMutation({
    mutationFn: () => createHouse(houseForm),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'House created.' });
      setHouseForm({ name: '', code: '', color: '#2563eb', motto: '' });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'houses'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }),
  });

  const autoAllocMut = useMutation({
    mutationFn: () => autoAllocateHouses(),
    onSuccess: (data) => {
      setMessage({
        tone: 'ok',
        text: `Auto-allocated ${data.allocated ?? 0} students across houses.`,
      });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'houses'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Auto-allocate failed') }),
  });

  const createMeetMut = useMutation({
    mutationFn: () => createMeet(meetForm),
    onSuccess: (meet: CompetitionMeet) => {
      setMessage({ tone: 'ok', text: 'Meet created with default categories and point rules.' });
      setSelectedMeetId(meet.id);
      setTab('meets');
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'meets'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => transitionMeetStatus(selectedMeetId, status),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Meet status updated.' });
      void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }),
  });

  const createEventMut = useMutation({
    mutationFn: () => createEvent(selectedMeetId, { name: eventName.trim(), entryMode }),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Event added.' });
      setEventName('');
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'meet', selectedMeetId] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }),
  });

  const pointsMut = useMutation({
    mutationFn: () => updatePointRules(selectedMeetId, pointsForm),
    onSuccess: () => setMessage({ tone: 'ok', text: 'Point rules saved.' }),
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }),
  });

  const tabs = useMemo(
    () =>
      [
        ['houses', 'Houses', Home],
        ['meets', 'Meets', Trophy],
        ['scoring', 'Leaderboard', Award],
        ['reports', 'Reports', Award],
      ] as const,
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? 'default' : 'outline'}
            onClick={() => setTab(id)}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {tab === 'houses' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <StcPanel title="Create house" description="Unlimited houses with colour branding">
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={houseForm.name}
                  onChange={(e) => setHouseForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input
                    value={houseForm.code}
                    onChange={(e) => setHouseForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={houseForm.color}
                    onChange={(e) => setHouseForm((f) => ({ ...f, color: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Motto</Label>
                <Input
                  value={houseForm.motto}
                  onChange={(e) => setHouseForm((f) => ({ ...f, motto: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                disabled={!houseForm.name || !houseForm.code || createHouseMut.isPending}
                onClick={() => createHouseMut.mutate()}
              >
                <Plus className="mr-1 h-4 w-4" />
                Create house
              </Button>
            </div>
          </StcPanel>

          <StcPanel
            title="Houses"
            description="Allocate students evenly across active houses"
            actions={
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={autoAllocMut.isPending || houses.length < 2}
                onClick={() => autoAllocMut.mutate()}
              >
                Auto-allocate
              </Button>
            }
          >
            {housesQ.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : houses.length === 0 ? (
              <StcEmptyState
                icon={Home}
                title="No houses yet"
                description="Create Blue / Red / Green / Yellow or named houses."
              />
            ) : (
              <div className="space-y-2">
                {houses.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: h.color }} />
                      <div>
                        <p className="font-medium text-slate-900">{h.name}</p>
                        <p className="text-xs text-slate-500">
                          {h.code} · {h._count?.memberships ?? 0} members
                        </p>
                      </div>
                    </div>
                    <StcStatusBadge status={h.status} />
                  </div>
                ))}
              </div>
            )}
          </StcPanel>
        </div>
      ) : null}

      {tab === 'meets' ? (
        <div className="space-y-4">
          <StcPanel
            title="Create competition meet"
            description="Sports day, cultural fest, quiz, and more"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={meetForm.name}
                  onChange={(e) => setMeetForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={meetForm.meetType}
                  onChange={(e) => setMeetForm((f) => ({ ...f, meetType: e.target.value }))}
                >
                  {(typesQ.data ?? []).map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Start</Label>
                <Input
                  type="date"
                  value={meetForm.startsAt}
                  onChange={(e) => setMeetForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="date"
                  value={meetForm.endsAt}
                  onChange={(e) => setMeetForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label>Venue</Label>
                <Input
                  value={meetForm.venue}
                  onChange={(e) => setMeetForm((f) => ({ ...f, venue: e.target.value }))}
                />
              </div>
              <div>
                <Label>Theme</Label>
                <Input
                  value={meetForm.theme}
                  onChange={(e) => setMeetForm((f) => ({ ...f, theme: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="mt-3"
              type="button"
              disabled={
                !meetForm.name || !meetForm.startsAt || !meetForm.endsAt || createMeetMut.isPending
              }
              onClick={() => createMeetMut.mutate()}
            >
              Create meet
            </Button>
          </StcPanel>

          <StcPanel title="Meets" description="Select a meet to manage events and status">
            <div className="space-y-2">
              {meets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                    selectedMeetId === m.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-200 bg-white'
                  }`}
                  onClick={() => setSelectedMeetId(m.id)}
                >
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-slate-500">
                      {m.meetType} · {m._count?.events ?? 0} events
                    </p>
                  </div>
                  <StcStatusBadge status={m.status} />
                </button>
              ))}
            </div>
          </StcPanel>

          {selectedMeet ? (
            <StcPanel
              title={selectedMeet.name}
              description="Events, point rules, fixtures"
              actions={
                <div className="flex flex-wrap gap-2">
                  {['OPEN', 'LIVE', 'COMPLETED'].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              }
            >
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {(
                  [
                    ['First', 'firstPoints'],
                    ['Second', 'secondPoints'],
                    ['Third', 'thirdPoints'],
                    ['Participation', 'participationPoints'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key}>
                    <Label>{label} pts</Label>
                    <Input
                      type="number"
                      value={pointsForm[key]}
                      onChange={(e) =>
                        setPointsForm((f) => ({
                          ...f,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Button size="sm" type="button" className="mb-4" onClick={() => pointsMut.mutate()}>
                Save point rules
              </Button>

              <div className="mb-3 flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="New event name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={entryMode}
                  onChange={(e) => setEntryMode(e.target.value)}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="TEAM">Team</option>
                </select>
                <Button
                  type="button"
                  disabled={!eventName.trim() || createEventMut.isPending}
                  onClick={() => createEventMut.mutate()}
                >
                  Add event
                </Button>
              </div>

              <div className="space-y-2">
                {(selectedMeet.events ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{ev.name}</p>
                      <p className="text-xs text-slate-500">
                        {ev.entryMode} · {ev._count?.entries ?? 0} entries
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        void generateFixtures(ev.id, ev.entryMode === 'TEAM' ? 'KNOCKOUT' : 'HEATS')
                          .then(() =>
                            setMessage({ tone: 'ok', text: `Fixtures generated for ${ev.name}` }),
                          )
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Fixture generation failed'),
                            }),
                          )
                      }
                    >
                      Generate fixtures
                    </Button>
                  </div>
                ))}
              </div>
            </StcPanel>
          ) : null}
        </div>
      ) : null}

      {tab === 'scoring' ? (
        <StcPanel
          title="Live leaderboard (polling)"
          description="Updates after published results; Socket.IO-ready for Phase C"
        >
          {!selectedMeetId ? (
            <p className="text-sm text-slate-500">Select a meet from the Meets tab first.</p>
          ) : boardQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="space-y-2">
              {(boardQ.data ?? []).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-slate-500">#{row.rank}</span>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        G{row.medals.gold} S{row.medals.silver} B{row.medals.bronze}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{row.points}</p>
                </div>
              ))}
            </div>
          )}
        </StcPanel>
      ) : null}

      {tab === 'reports' ? (
        <StcPanel
          title="Certificates & reports"
          description="Reuse Certificate Engine for participation and place awards"
        >
          {!selectedMeetId ? (
            <p className="text-sm text-slate-500">Select a meet from the Meets tab first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void issueParticipationCertificates(selectedMeetId)
                    .then((r) =>
                      setMessage({
                        tone: 'ok',
                        text: `Issued ${r.issued} participation certificates`,
                      }),
                    )
                    .catch((e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }))
                }
              >
                Issue participation certs
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void issuePlaceCertificates(selectedMeetId)
                    .then((r) =>
                      setMessage({ tone: 'ok', text: `Issued ${r.issued} place certificates` }),
                    )
                    .catch((e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }))
                }
              >
                Issue place certs
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void downloadMeetReportCsv(selectedMeetId).catch((e) =>
                    setMessage({ tone: 'err', text: apiErrorMessage(e, 'CSV failed') }),
                  )
                }
              >
                Download leaderboard CSV
              </Button>
            </div>
          )}
        </StcPanel>
      ) : null}
    </div>
  );
}
