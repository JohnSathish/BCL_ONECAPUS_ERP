import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import {
  fetchCompetitionHouseDashboard,
  fetchCompetitionLeaderboard,
  fetchCompetitionMeet,
  fetchMyCompetitionEntries,
  fetchMyCompetitionHouse,
  fetchMyCompetitionMedals,
  fetchOpenCompetitionMeets,
  registerForCompetitionEvent,
  type CompetitionEntry,
  type CompetitionEvent,
  type CompetitionHouseDashboard,
  type CompetitionMedal,
  type CompetitionMeet,
  type CompetitionHouseMembership,
  type LeaderboardRow,
} from '@/services/campus-competitions';

export default function CampusCompetitionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [house, setHouse] = useState<CompetitionHouseMembership | null>(null);
  const [dash, setDash] = useState<CompetitionHouseDashboard | null>(null);
  const [meets, setMeets] = useState<CompetitionMeet[]>([]);
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [medals, setMedals] = useState<CompetitionMedal[]>([]);
  const [events, setEvents] = useState<CompetitionEvent[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [message, setMessage] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, open, mine, myMedals] = await Promise.all([
        fetchMyCompetitionHouse().catch(() => null),
        fetchOpenCompetitionMeets().catch(() => []),
        fetchMyCompetitionEntries().catch(() => []),
        fetchMyCompetitionMedals().catch(() => []),
      ]);
      setHouse(h);
      setMeets(open ?? []);
      setEntries(mine ?? []);
      setMedals(myMedals ?? []);
      const meetId = selectedMeetId ?? open?.[0]?.id ?? null;
      setSelectedMeetId(meetId);

      if (h?.house?.id) {
        const d = await fetchCompetitionHouseDashboard(h.house.id, meetId ?? undefined).catch(
          () => null,
        );
        setDash(d);
      } else {
        setDash(null);
      }

      if (meetId) {
        const [lb, meet] = await Promise.all([
          fetchCompetitionLeaderboard(meetId).catch(() => []),
          fetchCompetitionMeet(meetId).catch(() => null),
        ]);
        setBoard(lb ?? []);
        setEvents((meet?.events ?? []).filter((e) => e.entryMode === 'INDIVIDUAL'));
      } else {
        setBoard([]);
        setEvents([]);
      }
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to load competitions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMeetId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedMeetId) return;
    const id = setInterval(() => {
      void fetchCompetitionLeaderboard(selectedMeetId)
        .then((lb) => setBoard(lb ?? []))
        .catch(() => undefined);
    }, 8_000);
    return () => clearInterval(id);
  }, [selectedMeetId]);

  const registeredIds = new Set(entries.map((e) => e.event?.id).filter(Boolean));

  const onRegister = async (eventId: string) => {
    setBusyEventId(eventId);
    try {
      await registerForCompetitionEvent(eventId);
      setMessage('Registered for event.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setBusyEventId(null);
    }
  };

  return (
    <StudentScreenShell title="Campus Competitions">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.heading}>My house</Text>
          {!house?.house ? (
            <Text style={styles.empty}>Not allocated to a house yet.</Text>
          ) : (
            <View style={styles.card}>
              <View style={[styles.swatch, { backgroundColor: house.house.color }]} />
              <Text style={styles.title}>{house.house.name}</Text>
              <Text style={styles.meta}>{house.house.code}</Text>
              {dash ? (
                <Text style={styles.meta}>
                  Rank {dash.currentRank ? `#${dash.currentRank}` : '—'} · {dash.championshipPoints}{' '}
                  pts · G{dash.medals.gold} S{dash.medals.silver} B{dash.medals.bronze}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.heading}>My events</Text>
          {entries.length === 0 ? (
            <Text style={styles.empty}>No registrations yet.</Text>
          ) : (
            entries.map((entry) => {
              const published = entry.results?.find((r) => r.status === 'PUBLISHED');
              const checkedIn = (entry.checkIns?.length ?? 0) > 0;
              return (
                <Pressable
                  key={entry.id}
                  style={styles.card}
                  onPress={() => {
                    if (entry.event?.meet?.id) setSelectedMeetId(entry.event.meet.id);
                  }}
                >
                  <Text style={styles.title}>{entry.event?.name ?? 'Event'}</Text>
                  <Text style={styles.meta}>
                    {entry.event?.meet?.name ?? '—'}
                    {published ? ` · Place #${published.position}` : ''}
                    {checkedIn ? ' · Checked in' : ''}
                  </Text>
                  {entry.qrPassToken ? (
                    <Text style={styles.pass} selectable>
                      Pass: {entry.qrPassToken}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}

          <Text style={styles.heading}>My medals</Text>
          {medals.length === 0 ? (
            <Text style={styles.empty}>No medals yet.</Text>
          ) : (
            medals.map((m) => (
              <View key={m.id} style={styles.row}>
                <Text style={styles.title}>
                  {m.metal} · {m.event?.name ?? 'Event'}
                </Text>
                <Text style={styles.meta}>{m.meet?.name ?? ''}</Text>
              </View>
            ))
          )}

          <Text style={styles.heading}>Open meets</Text>
          {meets.length === 0 ? (
            <Text style={styles.empty}>No open competitions.</Text>
          ) : (
            meets.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.card, selectedMeetId === m.id && styles.cardActive]}
                onPress={() => setSelectedMeetId(m.id)}
              >
                <Text style={styles.title}>{m.name}</Text>
                <Text style={styles.meta}>
                  {m.meetType} · {m.status}
                </Text>
              </Pressable>
            ))
          )}

          {selectedMeetId ? (
            <>
              <Text style={styles.heading}>Events</Text>
              {events.length === 0 ? (
                <Text style={styles.empty}>No individual events on this meet.</Text>
              ) : (
                events.map((ev) => {
                  const already = registeredIds.has(ev.id);
                  return (
                    <View key={ev.id} style={styles.row}>
                      <Text style={[styles.title, { flex: 1 }]}>{ev.name}</Text>
                      <Pressable
                        style={[styles.btn, (already || !house?.house) && styles.btnDisabled]}
                        disabled={already || !house?.house || busyEventId === ev.id}
                        onPress={() => void onRegister(ev.id)}
                      >
                        <Text style={styles.btnText}>
                          {already ? 'Registered' : busyEventId === ev.id ? '…' : 'Register'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          <Text style={styles.heading}>Leaderboard</Text>
          {board.length === 0 ? (
            <Text style={styles.empty}>No points yet.</Text>
          ) : (
            board.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    #{row.rank} {row.name}
                  </Text>
                  {row.medals ? (
                    <Text style={styles.meta}>
                      G{row.medals.gold} S{row.medals.silver} B{row.medals.bronze}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.points}>{row.points}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  empty: { color: '#64748b', marginBottom: 8 },
  message: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    padding: 10,
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  cardActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  swatch: { width: 28, height: 28, borderRadius: 14, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b' },
  pass: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  points: { fontWeight: '700', fontSize: 16 },
  btn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
