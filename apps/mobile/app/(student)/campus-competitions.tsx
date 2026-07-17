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
  fetchCompetitionLeaderboard,
  fetchMyCompetitionHouse,
  fetchOpenCompetitionMeets,
  type CompetitionMeet,
  type CompetitionHouseMembership,
  type LeaderboardRow,
} from '@/services/campus-competitions';

export default function CampusCompetitionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [house, setHouse] = useState<CompetitionHouseMembership | null>(null);
  const [meets, setMeets] = useState<CompetitionMeet[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [h, open] = await Promise.all([
        fetchMyCompetitionHouse().catch(() => null),
        fetchOpenCompetitionMeets().catch(() => []),
      ]);
      setHouse(h);
      setMeets(open ?? []);
      const meetId = selectedMeetId ?? open?.[0]?.id ?? null;
      setSelectedMeetId(meetId);
      if (meetId) {
        const lb = await fetchCompetitionLeaderboard(meetId).catch(() => []);
        setBoard(lb ?? []);
      } else {
        setBoard([]);
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
            </View>
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

          <Text style={styles.heading}>Leaderboard</Text>
          {board.length === 0 ? (
            <Text style={styles.empty}>No points yet.</Text>
          ) : (
            board.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.title}>
                  #{row.rank} {row.name}
                </Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  points: { fontWeight: '700', fontSize: 16 },
});
