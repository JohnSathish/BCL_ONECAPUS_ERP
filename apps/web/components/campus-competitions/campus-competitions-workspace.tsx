'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Home, Loader2, Megaphone, Plus, Radio, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CompetitionLiveScoreboard } from '@/components/campus-competitions/competition-live-scoreboard';
import {
  StcEmptyState,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { useCompetitionRealtime } from '@/hooks/use-competition-realtime';
import { fetchAcademicYears } from '@/services/organization';
import {
  allocateByKeys,
  approveResults,
  assignEventBibs,
  assignMeetVolunteer,
  autoAllocateHouses,
  checkInEvent,
  createAnnouncement,
  createCompetitionTeam,
  createEvent,
  createHouse,
  createMeet,
  createTrophy,
  declareHouseOfYear,
  downloadMeetReportCsv,
  ensureDisplayToken,
  ensureEventCheckInToken,
  fetchChampionshipStandings,
  fetchEventCheckIns,
  fetchEventEntries,
  fetchEventFixtures,
  fetchEventResults,
  fetchHouse,
  fetchHouses,
  fetchLiveBoard,
  fetchMeet,
  fetchMeetTypes,
  fetchMeetVolunteers,
  fetchMeets,
  fetchTrophies,
  fetchVolunteerRoles,
  generateFixtures,
  importHouseAllocations,
  issueParticipationCertificates,
  issuePlaceCertificates,
  mergeHouses,
  removeHouseCoordinator,
  removeMeetVolunteer,
  seedDefaultHouses,
  setHouseStatus,
  setLiveEvent,
  submitResultsForApproval,
  transferByKey,
  transitionMeetStatus,
  updatePointRules,
  upsertHouseCoordinatorByKey,
  upsertResults,
  type CompetitionMeet,
} from '@/services/campus-competitions';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'houses' | 'meets' | 'scoring' | 'live' | 'championship' | 'reports';

export function CampusCompetitionsWorkspace() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('houses');
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selectedMeetId, setSelectedMeetId] = useState<string>('');
  const [scoreEventId, setScoreEventId] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [tvUrl, setTvUrl] = useState('');
  const [champYearId, setChampYearId] = useState('');
  const [trophyForm, setTrophyForm] = useState({
    name: '',
    code: '',
    trophyType: 'CUP',
  });
  const [awardTrophyId, setAwardTrophyId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [kioskUrl, setKioskUrl] = useState('');
  const [selectedHouseId, setSelectedHouseId] = useState('');
  const [pasteKeys, setPasteKeys] = useState('');
  const [importCsv, setImportCsv] = useState('');
  const [transferKey, setTransferKey] = useState('');
  const [transferHouseId, setTransferHouseId] = useState('');
  const [opsEventId, setOpsEventId] = useState('');
  const [fixtureEventId, setFixtureEventId] = useState('');
  const [teamForm, setTeamForm] = useState({
    eventId: '',
    houseId: '',
    name: '',
    memberKeys: '',
  });
  const [coordForm, setCoordForm] = useState({
    staffKey: '',
    role: 'FACULTY_COORDINATOR',
  });
  const [mergeIntoId, setMergeIntoId] = useState('');
  const [volForm, setVolForm] = useState({
    personKey: '',
    role: 'GENERAL',
    personType: 'STAFF',
    eventId: '',
    notes: '',
  });

  const housesQ = useQuery({
    queryKey: ['campus-competitions', 'houses'],
    queryFn: () => fetchHouses(),
  });
  const houseDetailQ = useQuery({
    queryKey: ['campus-competitions', 'house', selectedHouseId],
    queryFn: () => fetchHouse(selectedHouseId),
    enabled: Boolean(selectedHouseId) && tab === 'houses',
  });
  const yearsQ = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
  });
  const trophiesQ = useQuery({
    queryKey: ['campus-competitions', 'trophies'],
    queryFn: () => fetchTrophies(),
    enabled: tab === 'championship',
  });
  const champQ = useQuery({
    queryKey: ['campus-competitions', 'championship', champYearId],
    queryFn: () => fetchChampionshipStandings(champYearId),
    enabled: Boolean(champYearId) && tab === 'championship',
  });
  const activeCheckInEventId = tab === 'live' ? opsEventId : scoreEventId;
  const checkInsQ = useQuery({
    queryKey: ['campus-competitions', 'check-ins', activeCheckInEventId],
    queryFn: () => fetchEventCheckIns(activeCheckInEventId),
    enabled: Boolean(activeCheckInEventId) && (tab === 'scoring' || tab === 'live'),
    refetchInterval: 8_000,
  });
  const fixturesQ = useQuery({
    queryKey: ['campus-competitions', 'fixtures', fixtureEventId],
    queryFn: () => fetchEventFixtures(fixtureEventId),
    enabled: Boolean(fixtureEventId) && tab === 'meets',
  });
  const fixtureEntriesQ = useQuery({
    queryKey: ['campus-competitions', 'entries', fixtureEventId, 'fixtures'],
    queryFn: () => fetchEventEntries(fixtureEventId),
    enabled: Boolean(fixtureEventId) && tab === 'meets',
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
  const liveQ = useQuery({
    queryKey: ['campus-competitions', 'live', selectedMeetId],
    queryFn: () => fetchLiveBoard(selectedMeetId),
    enabled: Boolean(selectedMeetId) && (tab === 'live' || tab === 'scoring'),
    refetchInterval: 20_000,
  });
  const entriesQ = useQuery({
    queryKey: ['campus-competitions', 'entries', scoreEventId],
    queryFn: () => fetchEventEntries(scoreEventId),
    enabled: Boolean(scoreEventId) && tab === 'scoring',
  });
  const resultsQ = useQuery({
    queryKey: ['campus-competitions', 'results', scoreEventId],
    queryFn: () => fetchEventResults(scoreEventId),
    enabled: Boolean(scoreEventId) && tab === 'scoring',
  });
  const volunteerRolesQ = useQuery({
    queryKey: ['campus-competitions', 'volunteer-roles'],
    queryFn: fetchVolunteerRoles,
    enabled: tab === 'live',
  });
  const volunteersQ = useQuery({
    queryKey: ['campus-competitions', 'volunteers', selectedMeetId],
    queryFn: () => fetchMeetVolunteers(selectedMeetId),
    enabled: Boolean(selectedMeetId) && tab === 'live',
  });

  useCompetitionRealtime(selectedMeetId || null, {
    onLeaderboard: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
    },
    onResult: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'results', scoreEventId] });
    },
    onAnnouncement: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
    },
    onLiveEvent: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'meet', selectedMeetId] });
    },
  });

  const houses = housesQ.data ?? [];
  const meets = meetsQ.data ?? [];
  const selectedMeet = meetQ.data;

  useEffect(() => {
    if (selectedMeet?.displayToken && typeof window !== 'undefined') {
      setTvUrl(`${window.location.origin}/tv/competitions/${selectedMeet.displayToken}`);
    } else {
      setTvUrl('');
    }
  }, [selectedMeet?.displayToken]);

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
    academicYearId: '',
  });
  const [eventName, setEventName] = useState('');
  const [entryMode, setEntryMode] = useState('INDIVIDUAL');
  const [pointsForm, setPointsForm] = useState({
    firstPoints: 10,
    secondPoints: 7,
    thirdPoints: 5,
    participationPoints: 2,
  });
  const [placeDrafts, setPlaceDrafts] = useState<
    Record<string, { position: string; metricValue: string }>
  >({});

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
    mutationFn: () =>
      createMeet({
        ...meetForm,
        academicYearId: meetForm.academicYearId || undefined,
      }),
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

  const saveResultsMut = useMutation({
    mutationFn: async (publish: boolean) => {
      const results = Object.entries(placeDrafts)
        .filter(([, v]) => v.position.trim())
        .map(([entryId, v]) => ({
          entryId,
          position: Number(v.position),
          metricValue: v.metricValue.trim() || undefined,
        }));
      if (!results.length) throw new Error('Enter at least one position');
      return upsertResults(scoreEventId, results, publish);
    },
    onSuccess: (data) => {
      const submitted = Boolean((data as { submitted?: number })?.submitted);
      setMessage({
        tone: 'ok',
        text: submitted
          ? 'Results submitted for approval.'
          : (data as { published?: boolean })?.published
            ? 'Results published.'
            : 'Draft results saved.',
      });
      void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Save failed') }),
  });

  const tabs = useMemo(
    () =>
      [
        ['houses', 'Houses', Home],
        ['meets', 'Meets', Trophy],
        ['scoring', 'Scoring', Award],
        ['live', 'Live ops', Radio],
        ['championship', 'Championship', Trophy],
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
        <div className="space-y-4">
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
                <div className="flex flex-wrap gap-2">
                  {houses.length === 0 ? (
                    <Button
                      size="sm"
                      type="button"
                      onClick={() =>
                        void seedDefaultHouses()
                          .then((r) => {
                            setMessage({
                              tone: 'ok',
                              text: `Seeded ${r.created?.length ?? 0} houses.`,
                            });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'houses'],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Seed failed'),
                            }),
                          )
                      }
                    >
                      Seed Blue/Red/Green/Yellow
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={autoAllocMut.isPending || houses.length < 2}
                    onClick={() => autoAllocMut.mutate()}
                  >
                    Auto-allocate
                  </Button>
                </div>
              }
            >
              {housesQ.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : houses.length === 0 ? (
                <StcEmptyState
                  icon={Home}
                  title="No houses yet"
                  description="Seed Blue / Red / Green / Yellow or create named houses."
                />
              ) : (
                <div className="space-y-2">
                  {houses.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                        selectedHouseId === h.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-200 bg-white'
                      }`}
                      onClick={() => setSelectedHouseId(h.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: h.color }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{h.name}</p>
                          <p className="text-xs text-slate-500">
                            {h.code} · {h._count?.memberships ?? 0} members
                          </p>
                        </div>
                      </div>
                      <StcStatusBadge status={h.status} />
                    </button>
                  ))}
                </div>
              )}
            </StcPanel>
          </div>

          {selectedHouseId ? (
            <StcPanel
              title={houseDetailQ.data?.name ?? 'House detail'}
              description="Roster, allocate, and status"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() =>
                    void setHouseStatus(
                      selectedHouseId,
                      houseDetailQ.data?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                    )
                      .then(() => {
                        setMessage({ tone: 'ok', text: 'House status updated.' });
                        void qc.invalidateQueries({ queryKey: ['campus-competitions', 'houses'] });
                        void qc.invalidateQueries({
                          queryKey: ['campus-competitions', 'house', selectedHouseId],
                        });
                      })
                      .catch((e) =>
                        setMessage({ tone: 'err', text: apiErrorMessage(e, 'Status failed') }),
                      )
                  }
                >
                  Toggle {houseDetailQ.data?.status === 'ACTIVE' ? 'Inactive' : 'Active'}
                </Button>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <Label>Paste enrollments / rolls (one per line)</Label>
                    <textarea
                      className="mt-1.5 min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={pasteKeys}
                      onChange={(e) => setPasteKeys(e.target.value)}
                      placeholder="ENR001&#10;ENR002"
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      type="button"
                      disabled={!pasteKeys.trim()}
                      onClick={() => {
                        const keys = pasteKeys
                          .split(/[\n,]+/)
                          .map((k) => k.trim())
                          .filter(Boolean);
                        void allocateByKeys({ houseId: selectedHouseId, studentKeys: keys })
                          .then((r) => {
                            setMessage({
                              tone: 'ok',
                              text: `Allocated ${r.allocated ?? 0} students.`,
                            });
                            setPasteKeys('');
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'houses'],
                            });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'house', selectedHouseId],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Allocate failed'),
                            }),
                          );
                      }}
                    >
                      Allocate to this house
                    </Button>
                  </div>
                  <div>
                    <Label>CSV import (enrollment,HOUSECODE)</Label>
                    <textarea
                      className="mt-1.5 min-h-[80px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={importCsv}
                      onChange={(e) => setImportCsv(e.target.value)}
                      placeholder="ENR001,BLUE&#10;ENR002,RED"
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={!importCsv.trim()}
                      onClick={() => {
                        const rows = importCsv
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [studentKey, houseCode] = line.split(/[,;\t]/);
                            return {
                              studentKey: (studentKey ?? '').trim(),
                              houseCode: (houseCode ?? '').trim(),
                            };
                          })
                          .filter((r) => r.studentKey && r.houseCode);
                        void importHouseAllocations(rows)
                          .then((r) => {
                            setMessage({
                              tone: 'ok',
                              text: `Imported ${r.imported ?? 0} allocations.`,
                            });
                            setImportCsv('');
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'houses'],
                            });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'house', selectedHouseId],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Import failed'),
                            }),
                          );
                      }}
                    >
                      Import CSV
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[140px] flex-1">
                      <Label>Transfer enrollment</Label>
                      <Input
                        value={transferKey}
                        onChange={(e) => setTransferKey(e.target.value)}
                        placeholder="Enrollment / roll"
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <Label>To house</Label>
                      <select
                        className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={transferHouseId}
                        onChange={(e) => setTransferHouseId(e.target.value)}
                      >
                        <option value="">Select</option>
                        {houses.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      disabled={!transferKey.trim() || !transferHouseId}
                      onClick={() =>
                        void transferByKey({
                          studentKey: transferKey.trim(),
                          toHouseId: transferHouseId,
                        })
                          .then(() => {
                            setMessage({ tone: 'ok', text: 'Student transferred.' });
                            setTransferKey('');
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'houses'],
                            });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'house'],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Transfer failed'),
                            }),
                          )
                      }
                    >
                      Transfer
                    </Button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold">Coordinators</p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-[160px]"
                        placeholder="Employee code"
                        value={coordForm.staffKey}
                        onChange={(e) => setCoordForm((f) => ({ ...f, staffKey: e.target.value }))}
                      />
                      <select
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={coordForm.role}
                        onChange={(e) => setCoordForm((f) => ({ ...f, role: e.target.value }))}
                      >
                        <option value="FACULTY_COORDINATOR">Faculty coordinator</option>
                        <option value="HOUSE_MASTER">House master</option>
                        <option value="HOUSE_MISTRESS">House mistress</option>
                        <option value="HOUSE_CAPTAIN">House captain</option>
                        <option value="VICE_CAPTAIN">Vice captain</option>
                      </select>
                      <Button
                        size="sm"
                        type="button"
                        disabled={!coordForm.staffKey.trim()}
                        onClick={() =>
                          void upsertHouseCoordinatorByKey(selectedHouseId, {
                            staffKey: coordForm.staffKey.trim(),
                            role: coordForm.role,
                          })
                            .then(() => {
                              setMessage({ tone: 'ok', text: 'Coordinator saved.' });
                              setCoordForm((f) => ({ ...f, staffKey: '' }));
                              void qc.invalidateQueries({
                                queryKey: ['campus-competitions', 'house', selectedHouseId],
                              });
                            })
                            .catch((e) =>
                              setMessage({
                                tone: 'err',
                                text: apiErrorMessage(e, 'Coordinator failed'),
                              }),
                            )
                        }
                      >
                        Add
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {(houseDetailQ.data?.coordinators ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1 text-xs"
                        >
                          <span>
                            {c.staff?.fullName ?? c.staffId.slice(0, 8)} · {c.role}
                            {c.staff?.employeeCode ? ` · ${c.staff.employeeCode}` : ''}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              void removeHouseCoordinator(c.id)
                                .then(() => {
                                  setMessage({ tone: 'ok', text: 'Coordinator removed.' });
                                  void qc.invalidateQueries({
                                    queryKey: ['campus-competitions', 'house', selectedHouseId],
                                  });
                                })
                                .catch((e) =>
                                  setMessage({
                                    tone: 'err',
                                    text: apiErrorMessage(e, 'Remove failed'),
                                  }),
                                )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                    <div className="min-w-[160px]">
                      <Label>Merge this house into</Label>
                      <select
                        className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={mergeIntoId}
                        onChange={(e) => setMergeIntoId(e.target.value)}
                      >
                        <option value="">Select target</option>
                        {houses
                          .filter((h) => h.id !== selectedHouseId)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={!mergeIntoId}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Merge moves all members into the target house and archives this house. Continue?',
                          )
                        ) {
                          return;
                        }
                        void mergeHouses(selectedHouseId, mergeIntoId)
                          .then(() => {
                            setMessage({ tone: 'ok', text: 'Houses merged.' });
                            setSelectedHouseId(mergeIntoId);
                            setMergeIntoId('');
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'houses'],
                            });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'house'],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Merge failed'),
                            }),
                          );
                      }}
                    >
                      Merge houses
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Roster ({houseDetailQ.data?.memberships?.length ?? 0})
                  </p>
                  {houseDetailQ.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (houseDetailQ.data?.memberships?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-500">No members yet.</p>
                  ) : (
                    <div className="max-h-80 space-y-1 overflow-y-auto">
                      {(houseDetailQ.data?.memberships ?? []).map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        >
                          <p className="font-medium">
                            {m.student?.fullName ?? m.studentId.slice(0, 8)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {m.student?.enrollmentNumber ?? '—'}
                            {m.student?.rollNumber ? ` · Roll ${m.student.rollNumber}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </StcPanel>
          ) : null}
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
              <div>
                <Label>Academic year</Label>
                <select
                  className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={meetForm.academicYearId}
                  onChange={(e) => setMeetForm((f) => ({ ...f, academicYearId: e.target.value }))}
                >
                  <option value="">Select year</option>
                  {(yearsQ.data ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
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

              <div className="mb-4 space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold">Nominate team</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={teamForm.eventId}
                    onChange={(e) => setTeamForm((f) => ({ ...f, eventId: e.target.value }))}
                  >
                    <option value="">Team event</option>
                    {(selectedMeet.events ?? [])
                      .filter((ev) => ev.entryMode === 'TEAM')
                      .map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                  </select>
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={teamForm.houseId}
                    onChange={(e) => setTeamForm((f) => ({ ...f, houseId: e.target.value }))}
                  >
                    <option value="">House</option>
                    {houses.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Team name"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Member enrollments (comma/newline)"
                    value={teamForm.memberKeys}
                    onChange={(e) => setTeamForm((f) => ({ ...f, memberKeys: e.target.value }))}
                  />
                </div>
                <Button
                  size="sm"
                  type="button"
                  disabled={
                    !teamForm.eventId ||
                    !teamForm.houseId ||
                    !teamForm.name.trim() ||
                    !teamForm.memberKeys.trim()
                  }
                  onClick={() => {
                    const memberKeys = teamForm.memberKeys
                      .split(/[\n,]+/)
                      .map((k) => k.trim())
                      .filter(Boolean);
                    void createCompetitionTeam({
                      eventId: teamForm.eventId,
                      houseId: teamForm.houseId,
                      name: teamForm.name.trim(),
                      memberKeys,
                    })
                      .then(() => {
                        setMessage({ tone: 'ok', text: 'Team nominated.' });
                        setTeamForm({ eventId: '', houseId: '', name: '', memberKeys: '' });
                        void qc.invalidateQueries({
                          queryKey: ['campus-competitions', 'meet', selectedMeetId],
                        });
                      })
                      .catch((e) =>
                        setMessage({
                          tone: 'err',
                          text: apiErrorMessage(e, 'Team create failed'),
                        }),
                      );
                  }}
                >
                  Create team entry
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setFixtureEventId(ev.id);
                          void generateFixtures(
                            ev.id,
                            ev.entryMode === 'TEAM' ? 'KNOCKOUT' : 'HEATS',
                          )
                            .then(() => {
                              setMessage({
                                tone: 'ok',
                                text: `Fixtures generated for ${ev.name}`,
                              });
                              void qc.invalidateQueries({
                                queryKey: ['campus-competitions', 'fixtures', ev.id],
                              });
                              void qc.invalidateQueries({
                                queryKey: ['campus-competitions', 'entries', ev.id],
                              });
                            })
                            .catch((e) =>
                              setMessage({
                                tone: 'err',
                                text: apiErrorMessage(e, 'Fixture generation failed'),
                              }),
                            );
                        }}
                      >
                        Generate fixtures
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setFixtureEventId(ev.id)}
                      >
                        View fixtures
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() =>
                          void ensureEventCheckInToken(ev.id)
                            .then((event) => {
                              if (event.checkInToken && typeof window !== 'undefined') {
                                const url = `${window.location.origin}/kiosk/competitions/${ev.id}?token=${event.checkInToken}`;
                                setKioskUrl(url);
                                setMessage({ tone: 'ok', text: 'Kiosk URL ready.' });
                              }
                            })
                            .catch((e) =>
                              setMessage({
                                tone: 'err',
                                text: apiErrorMessage(e, 'Kiosk token failed'),
                              }),
                            )
                        }
                      >
                        Kiosk
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {fixtureEventId ? (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold">
                    Fixtures ·{' '}
                    {(selectedMeet.events ?? []).find((e) => e.id === fixtureEventId)?.name ??
                      fixtureEventId.slice(0, 8)}
                  </p>
                  {fixturesQ.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (fixturesQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">No fixtures yet — generate first.</p>
                  ) : (
                    (fixturesQ.data ?? []).map((fx) => {
                      const ids = Array.isArray(fx.entryIds) ? (fx.entryIds as string[]) : [];
                      const byId = new Map(
                        (Array.isArray(fixtureEntriesQ.data) ? fixtureEntriesQ.data : []).map(
                          (en: {
                            id: string;
                            bibNumber?: string | null;
                            lane?: number | null;
                            house?: { name?: string } | null;
                            team?: { name?: string } | null;
                          }) => [en.id, en],
                        ),
                      );
                      return (
                        <div
                          key={fx.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <p className="font-medium">
                            {fx.round}
                            {fx.heatNumber != null ? ` · Heat ${fx.heatNumber}` : ''}
                            {fx.bracketSlot != null ? ` · Slot ${fx.bracketSlot}` : ''}
                          </p>
                          <p className="text-xs text-slate-600">
                            {ids
                              .map((id) => {
                                const en = byId.get(id);
                                if (!en) return id.slice(0, 6);
                                return [
                                  en.team?.name ?? en.house?.name ?? 'Entry',
                                  en.bibNumber ? `bib ${en.bibNumber}` : null,
                                  en.lane != null ? `lane ${en.lane}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ');
                              })
                              .join(' | ')}
                          </p>
                        </div>
                      );
                    })
                  )}
                  {kioskUrl ? (
                    <a
                      className="break-all text-xs text-sky-700 underline"
                      href={kioskUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {kioskUrl}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </StcPanel>
          ) : null}
        </div>
      ) : null}

      {tab === 'scoring' ? (
        <div className="space-y-4">
          <StcPanel
            title="Live scoring"
            description={
              selectedMeet?.requireResultApproval
                ? 'Draft → submit for approval → publish to leaderboard'
                : 'Save drafts or publish immediately'
            }
          >
            {!selectedMeetId ? (
              <p className="text-sm text-slate-500">Select a meet from the Meets tab first.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Event</Label>
                  <select
                    className="mt-1.5 w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={scoreEventId}
                    onChange={(e) => {
                      setScoreEventId(e.target.value);
                      setPlaceDrafts({});
                    }}
                  >
                    <option value="">Select event</option>
                    {(selectedMeet?.events ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {scoreEventId ? (
                  <>
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 space-y-3">
                      <p className="text-sm font-semibold">RFID / QR check-in</p>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          className="max-w-xs"
                          placeholder="Scan RFID / QR / enrollment"
                          value={scanCode}
                          onChange={(e) => setScanCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && scanCode.trim()) {
                              void checkInEvent(scoreEventId, { scanCode: scanCode.trim() })
                                .then((r) => {
                                  setMessage({
                                    tone: 'ok',
                                    text: r.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
                                  });
                                  setScanCode('');
                                  void qc.invalidateQueries({
                                    queryKey: ['campus-competitions', 'check-ins', scoreEventId],
                                  });
                                })
                                .catch((err) =>
                                  setMessage({
                                    tone: 'err',
                                    text: apiErrorMessage(err, 'Check-in failed'),
                                  }),
                                );
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!scanCode.trim()}
                          onClick={() =>
                            void checkInEvent(scoreEventId, { scanCode: scanCode.trim() })
                              .then((r) => {
                                setMessage({
                                  tone: 'ok',
                                  text: r.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
                                });
                                setScanCode('');
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'check-ins', scoreEventId],
                                });
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Check-in failed'),
                                }),
                              )
                          }
                        >
                          Check in
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void ensureEventCheckInToken(scoreEventId)
                              .then((ev) => {
                                if (ev.checkInToken && typeof window !== 'undefined') {
                                  const url = `${window.location.origin}/kiosk/competitions/${scoreEventId}?token=${ev.checkInToken}`;
                                  setKioskUrl(url);
                                  setMessage({ tone: 'ok', text: 'Kiosk URL ready.' });
                                }
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Token failed'),
                                }),
                              )
                          }
                        >
                          Kiosk URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void assignEventBibs(scoreEventId)
                              .then((r) => {
                                setMessage({
                                  tone: 'ok',
                                  text: `Assigned ${r.assigned ?? 0} bibs.`,
                                });
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'entries', scoreEventId],
                                });
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'check-ins', scoreEventId],
                                });
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Bib assign failed'),
                                }),
                              )
                          }
                        >
                          Assign bibs
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const rows = checkInsQ.data ?? [];
                            const html = `<!doctype html><html><head><title>Event roster</title>
                              <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
                              th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body>
                              <h1>Check-in roster</h1>
                              <table><thead><tr><th>Bib</th><th>House</th><th>QR pass</th><th>In</th></tr></thead>
                              <tbody>${rows
                                .map(
                                  (r) =>
                                    `<tr><td>${r.bibNumber ?? ''}</td><td>${r.house?.name ?? ''}</td><td>${r.qrPassToken ?? ''}</td><td>${r.checkedIn ? 'Yes' : ''}</td></tr>`,
                                )
                                .join('')}</tbody></table>
                              <script>window.print()</script></body></html>`;
                            const w = window.open('', '_blank');
                            if (w) {
                              w.document.write(html);
                              w.document.close();
                            }
                          }}
                        >
                          Print roster
                        </Button>
                      </div>
                      {kioskUrl ? (
                        <a
                          className="break-all text-xs text-sky-700 underline"
                          href={kioskUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {kioskUrl}
                        </a>
                      ) : null}
                      <p className="text-xs text-slate-600">
                        Checked in: {(checkInsQ.data ?? []).filter((c) => c.checkedIn).length}/
                        {(checkInsQ.data ?? []).length}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {(Array.isArray(entriesQ.data) ? entriesQ.data : []).map(
                        (entry: {
                          id: string;
                          bibNumber?: string | null;
                          lane?: number | null;
                          studentId?: string | null;
                          house?: { name?: string; code?: string } | null;
                          team?: { name?: string } | null;
                        }) => (
                          <div
                            key={entry.id}
                            className="grid gap-2 rounded-xl border border-slate-200 px-3 py-2 md:grid-cols-[1fr_100px_120px]"
                          >
                            <div>
                              <p className="font-medium">
                                {entry.team?.name ?? entry.house?.name ?? 'Entry'}
                                {entry.bibNumber ? ` · Bib ${entry.bibNumber}` : ''}
                                {entry.lane != null ? ` · Lane ${entry.lane}` : ''}
                              </p>
                              <p className="text-xs text-slate-500">
                                {entry.house?.code ?? '—'}
                                {entry.studentId ? ` · ${entry.studentId.slice(0, 8)}` : ''}
                              </p>
                            </div>
                            <Input
                              placeholder="Place"
                              value={placeDrafts[entry.id]?.position ?? ''}
                              onChange={(e) =>
                                setPlaceDrafts((d) => ({
                                  ...d,
                                  [entry.id]: {
                                    position: e.target.value,
                                    metricValue: d[entry.id]?.metricValue ?? '',
                                  },
                                }))
                              }
                            />
                            <Input
                              placeholder="Metric"
                              value={placeDrafts[entry.id]?.metricValue ?? ''}
                              onChange={(e) =>
                                setPlaceDrafts((d) => ({
                                  ...d,
                                  [entry.id]: {
                                    position: d[entry.id]?.position ?? '',
                                    metricValue: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        ),
                      )}
                      {entriesQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                      {!entriesQ.isLoading &&
                      (!Array.isArray(entriesQ.data) || entriesQ.data.length === 0) ? (
                        <p className="text-sm text-slate-500">No entries for this event yet.</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saveResultsMut.isPending}
                        onClick={() => saveResultsMut.mutate(false)}
                      >
                        Save draft
                      </Button>
                      <Button
                        type="button"
                        disabled={saveResultsMut.isPending}
                        onClick={() => saveResultsMut.mutate(true)}
                      >
                        {selectedMeet?.requireResultApproval
                          ? 'Save & submit for approval'
                          : 'Save & publish'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void submitResultsForApproval(scoreEventId)
                            .then(() => {
                              setMessage({ tone: 'ok', text: 'Submitted for approval.' });
                              void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
                            })
                            .catch((e) =>
                              setMessage({
                                tone: 'err',
                                text: apiErrorMessage(e, 'Submit failed'),
                              }),
                            )
                        }
                      >
                        Submit drafts
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          void approveResults(scoreEventId)
                            .then(() => {
                              setMessage({ tone: 'ok', text: 'Approved and published.' });
                              void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
                            })
                            .catch((e) =>
                              setMessage({
                                tone: 'err',
                                text: apiErrorMessage(e, 'Approve failed'),
                              }),
                            )
                        }
                      >
                        Approve & publish
                      </Button>
                    </div>

                    {(resultsQ.data ?? []).length > 0 ? (
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="mb-2 text-sm font-semibold">Current results</p>
                        <div className="space-y-1 text-sm">
                          {(resultsQ.data ?? []).map((r) => (
                            <div key={r.id} className="flex justify-between gap-2">
                              <span>
                                #{r.position} · {r.entry?.house?.name ?? '—'}
                              </span>
                              <StcStatusBadge status={r.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </StcPanel>

          <StcPanel
            title="Leaderboard preview"
            description="Socket.IO updates when results publish"
          >
            <CompetitionLiveScoreboard
              board={liveQ.data}
              loading={liveQ.isLoading}
              compact
              showChrome={false}
            />
          </StcPanel>
        </div>
      ) : null}

      {tab === 'live' ? (
        <div className="space-y-4">
          <StcPanel
            title="Live operations"
            description="TV display, now-playing event, and announcements"
            actions={
              selectedMeetId ? (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void ensureDisplayToken(selectedMeetId)
                      .then((meet) => {
                        setMessage({ tone: 'ok', text: 'TV display token ready.' });
                        void qc.invalidateQueries({
                          queryKey: ['campus-competitions', 'meet', selectedMeetId],
                        });
                        if (meet.displayToken && typeof window !== 'undefined') {
                          setTvUrl(
                            `${window.location.origin}/tv/competitions/${meet.displayToken}`,
                          );
                        }
                      })
                      .catch((e) =>
                        setMessage({ tone: 'err', text: apiErrorMessage(e, 'Token failed') }),
                      )
                  }
                >
                  Ensure TV token
                </Button>
              ) : null
            }
          >
            {!selectedMeetId ? (
              <p className="text-sm text-slate-500">Select a meet from the Meets tab first.</p>
            ) : (
              <div className="space-y-4">
                {tvUrl ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium">TV mode URL</p>
                    <Link className="break-all text-sky-700 underline" href={tvUrl} target="_blank">
                      {tvUrl}
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Generate a display token to open TV mode.
                  </p>
                )}

                <div>
                  <Label>Now playing event</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={selectedMeet?.liveEventId ?? ''}
                      onChange={(e) =>
                        void setLiveEvent(selectedMeetId, e.target.value || null)
                          .then(() => {
                            setMessage({ tone: 'ok', text: 'Live event updated.' });
                            void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
                          })
                          .catch((err) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(err, 'Live event failed'),
                            }),
                          )
                      }
                    >
                      <option value="">None</option>
                      {(selectedMeet?.events ?? []).map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 space-y-3">
                  <p className="text-sm font-semibold">RFID / QR check-in</p>
                  <select
                    className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={opsEventId}
                    onChange={(e) => setOpsEventId(e.target.value)}
                  >
                    <option value="">Select event</option>
                    {(selectedMeet?.events ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                  {opsEventId ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          className="max-w-xs"
                          placeholder="Scan RFID / QR / enrollment"
                          value={scanCode}
                          onChange={(e) => setScanCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && scanCode.trim()) {
                              void checkInEvent(opsEventId, { scanCode: scanCode.trim() })
                                .then((r) => {
                                  setMessage({
                                    tone: 'ok',
                                    text: r.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
                                  });
                                  setScanCode('');
                                  void qc.invalidateQueries({
                                    queryKey: ['campus-competitions', 'check-ins', opsEventId],
                                  });
                                })
                                .catch((err) =>
                                  setMessage({
                                    tone: 'err',
                                    text: apiErrorMessage(err, 'Check-in failed'),
                                  }),
                                );
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!scanCode.trim()}
                          onClick={() =>
                            void checkInEvent(opsEventId, { scanCode: scanCode.trim() })
                              .then((r) => {
                                setMessage({
                                  tone: 'ok',
                                  text: r.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
                                });
                                setScanCode('');
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'check-ins', opsEventId],
                                });
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Check-in failed'),
                                }),
                              )
                          }
                        >
                          Check in
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void ensureEventCheckInToken(opsEventId)
                              .then((ev) => {
                                if (ev.checkInToken && typeof window !== 'undefined') {
                                  const url = `${window.location.origin}/kiosk/competitions/${opsEventId}?token=${ev.checkInToken}`;
                                  setKioskUrl(url);
                                  setMessage({ tone: 'ok', text: 'Kiosk URL ready.' });
                                }
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Token failed'),
                                }),
                              )
                          }
                        >
                          Kiosk URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void assignEventBibs(opsEventId)
                              .then((r) => {
                                setMessage({
                                  tone: 'ok',
                                  text: `Assigned ${r.assigned ?? 0} bibs.`,
                                });
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'check-ins', opsEventId],
                                });
                              })
                              .catch((err) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(err, 'Bib assign failed'),
                                }),
                              )
                          }
                        >
                          Assign bibs
                        </Button>
                      </div>
                      {kioskUrl ? (
                        <a
                          className="break-all text-xs text-sky-700 underline"
                          href={kioskUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {kioskUrl}
                        </a>
                      ) : null}
                      <p className="text-xs text-slate-600">
                        Checked in: {(checkInsQ.data ?? []).filter((c) => c.checkedIn).length}/
                        {(checkInsQ.data ?? []).length}
                      </p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {(checkInsQ.data ?? []).map((c) => (
                          <div
                            key={c.entryId}
                            className="flex justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            <span>
                              {c.house?.name ?? 'Entry'}
                              {c.bibNumber ? ` · Bib ${c.bibNumber}` : ''}
                            </span>
                            <span className={c.checkedIn ? 'text-emerald-700' : 'text-slate-400'}>
                              {c.checkedIn ? 'In' : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                <div>
                  <Label>Announcement</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Input
                      className="max-w-lg"
                      placeholder="Now calling finalists to lane 3…"
                      value={announceText}
                      onChange={(e) => setAnnounceText(e.target.value)}
                    />
                    <Button
                      type="button"
                      disabled={!announceText.trim()}
                      onClick={() =>
                        void createAnnouncement(selectedMeetId, {
                          message: announceText.trim(),
                          severity: 'INFO',
                        })
                          .then(() => {
                            setAnnounceText('');
                            setMessage({ tone: 'ok', text: 'Announcement sent.' });
                            void qc.invalidateQueries({
                              queryKey: ['campus-competitions', 'live', selectedMeetId],
                            });
                          })
                          .catch((e) =>
                            setMessage({
                              tone: 'err',
                              text: apiErrorMessage(e, 'Announcement failed'),
                            }),
                          )
                      }
                    >
                      <Megaphone className="mr-1 h-4 w-4" />
                      Broadcast
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </StcPanel>

          <StcPanel
            title="Day-of volunteers"
            description="Marshal, timekeeper, check-in desk, and more"
          >
            {!selectedMeetId ? (
              <p className="text-sm text-slate-500">Select a meet first.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-[160px]"
                    placeholder="Employee / enrollment"
                    value={volForm.personKey}
                    onChange={(e) => setVolForm((f) => ({ ...f, personKey: e.target.value }))}
                  />
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={volForm.personType}
                    onChange={(e) => setVolForm((f) => ({ ...f, personType: e.target.value }))}
                  >
                    <option value="STAFF">Staff</option>
                    <option value="STUDENT">Student</option>
                  </select>
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={volForm.role}
                    onChange={(e) => setVolForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {(volunteerRolesQ.data ?? [{ code: 'GENERAL', label: 'General' }]).map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={volForm.eventId}
                    onChange={(e) => setVolForm((f) => ({ ...f, eventId: e.target.value }))}
                  >
                    <option value="">All events</option>
                    {(selectedMeet?.events ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    type="button"
                    disabled={!volForm.personKey.trim()}
                    onClick={() =>
                      void assignMeetVolunteer(selectedMeetId, {
                        personKey: volForm.personKey.trim(),
                        personType: volForm.personType,
                        role: volForm.role,
                        eventId: volForm.eventId || undefined,
                        notes: volForm.notes || undefined,
                      })
                        .then(() => {
                          setMessage({ tone: 'ok', text: 'Volunteer assigned.' });
                          setVolForm((f) => ({ ...f, personKey: '', notes: '' }));
                          void qc.invalidateQueries({
                            queryKey: ['campus-competitions', 'volunteers', selectedMeetId],
                          });
                        })
                        .catch((e) =>
                          setMessage({
                            tone: 'err',
                            text: apiErrorMessage(e, 'Assign failed'),
                          }),
                        )
                    }
                  >
                    Assign
                  </Button>
                </div>
                {(volunteersQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No volunteers assigned yet.</p>
                ) : (
                  <div className="space-y-1">
                    {(volunteersQ.data ?? []).map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {v.displayName} · {v.role}
                          </p>
                          <p className="text-xs text-slate-500">
                            {v.personType}
                            {v.personCode ? ` · ${v.personCode}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() =>
                            void removeMeetVolunteer(v.id)
                              .then(() => {
                                setMessage({ tone: 'ok', text: 'Volunteer removed.' });
                                void qc.invalidateQueries({
                                  queryKey: ['campus-competitions', 'volunteers', selectedMeetId],
                                });
                              })
                              .catch((e) =>
                                setMessage({
                                  tone: 'err',
                                  text: apiErrorMessage(e, 'Remove failed'),
                                }),
                              )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </StcPanel>

          <StcPanel title="Live board" description="Realtime via Socket.IO + fallback poll">
            <CompetitionLiveScoreboard board={liveQ.data} loading={liveQ.isLoading} />
          </StcPanel>
        </div>
      ) : null}

      {tab === 'championship' ? (
        <div className="space-y-4">
          <StcPanel
            title="Annual championship"
            description="Year standings from all meets linked to an academic year"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={champYearId}
                onChange={(e) => setChampYearId(e.target.value)}
              >
                <option value="">Select academic year</option>
                {(yearsQ.data ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                disabled={!champYearId}
                onClick={() =>
                  void declareHouseOfYear(champYearId, {
                    trophyId: awardTrophyId || undefined,
                  })
                    .then((r) => {
                      setMessage({
                        tone: 'ok',
                        text: `House of the Year: ${r.house?.name ?? 'declared'}`,
                      });
                      void qc.invalidateQueries({
                        queryKey: ['campus-competitions', 'championship'],
                      });
                      void qc.invalidateQueries({
                        queryKey: ['campus-competitions', 'trophies'],
                      });
                    })
                    .catch((e) =>
                      setMessage({
                        tone: 'err',
                        text: apiErrorMessage(e, 'Declare failed'),
                      }),
                    )
                }
              >
                Declare House of the Year
              </Button>
            </div>
            {!champYearId ? (
              <p className="text-sm text-slate-500">Pick an academic year to view standings.</p>
            ) : champQ.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  {champQ.data?.meetCount ?? 0} meets · leader:{' '}
                  {champQ.data?.houseOfYear?.name ?? '—'}
                </p>
                {(champQ.data?.standings ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 font-semibold text-slate-500">#{row.rank}</span>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
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

          <StcPanel title="Trophy inventory" description="Cups, shields, plaques">
            <div className="mb-4 grid gap-2 md:grid-cols-4">
              <Input
                placeholder="Name"
                value={trophyForm.name}
                onChange={(e) => setTrophyForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Code"
                value={trophyForm.code}
                onChange={(e) => setTrophyForm((f) => ({ ...f, code: e.target.value }))}
              />
              <select
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={trophyForm.trophyType}
                onChange={(e) => setTrophyForm((f) => ({ ...f, trophyType: e.target.value }))}
              >
                <option value="CUP">Cup</option>
                <option value="SHIELD">Shield</option>
                <option value="PLAQUE">Plaque</option>
                <option value="MEDAL_SET">Medal set</option>
              </select>
              <Button
                type="button"
                disabled={!trophyForm.name || !trophyForm.code}
                onClick={() =>
                  void createTrophy(trophyForm)
                    .then(() => {
                      setTrophyForm({ name: '', code: '', trophyType: 'CUP' });
                      setMessage({ tone: 'ok', text: 'Trophy added.' });
                      void qc.invalidateQueries({
                        queryKey: ['campus-competitions', 'trophies'],
                      });
                    })
                    .catch((e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Failed') }))
                }
              >
                Add trophy
              </Button>
            </div>
            <div className="mb-3">
              <Label>Trophy for House of the Year (optional)</Label>
              <select
                className="mt-1.5 w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={awardTrophyId}
                onChange={(e) => setAwardTrophyId(e.target.value)}
              >
                <option value="">None</option>
                {(trophiesQ.data ?? [])
                  .filter((t) => t.status === 'AVAILABLE')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              {(trophiesQ.data ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {t.name} · {t.trophyType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.code}
                      {t.awards?.[0]?.house ? ` · held by ${t.awards[0].house.name}` : ''}
                    </p>
                  </div>
                  <StcStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </StcPanel>
        </div>
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
