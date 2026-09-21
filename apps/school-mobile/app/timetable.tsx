import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { getUser } from '@/auth/session';
import { isPrincipalUser, isStaffUser } from '@/persona';
import { StudentTimetable } from '@/screens/student-timetable';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { formatDayLabel, istDayKey, weekdayFromKey } from '@/timetable/format';

type Slot = {
  id: string;
  dayOfWeek?: number;
  subject?: { name?: string } | null;
  printedSubject?: string | null;
  roomLabel?: string | null;
  section?: { name?: string; grade?: { name?: string } } | null;
  bell?: { startTime?: string; endTime?: string; label?: string; sortOrder?: number } | null;
};

function StaffTimetable() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ slots?: Slot[] }>('/v1/school-mobile/timetable')
      .then((payload) => setSlots(payload.slots ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const today = weekdayFromKey(istDayKey());
  const ordered = [...slots].sort(
    (a, b) =>
      (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) ||
      (a.bell?.sortOrder ?? 0) - (b.bell?.sortOrder ?? 0),
  );
  const todaySlots = ordered.filter((s) => s.dayOfWeek === today);
  const shown = todaySlots.length ? todaySlots : ordered;

  return (
    <Screen title="Timetable" onBack>
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Timetable unavailable" body={error} /> : null}
      {!loading && !error && !slots.length ? (
        <EmptyState
          title="No periods yet"
          body="Your teaching timetable will appear once it is published."
        />
      ) : null}
      {!loading && !error && slots.length ? (
        <Feed>
          <Text style={{ fontWeight: '800', color: '#1a237e' }}>
            {todaySlots.length ? `Today · ${formatDayLabel(istDayKey())}` : 'This week'}
          </Text>
          {shown.map((slot) => (
            <Card key={slot.id}>
              <Text style={{ fontWeight: '800' }}>
                {slot.subject?.name ?? slot.printedSubject ?? slot.bell?.label ?? 'Period'}
              </Text>
              <Text>
                {slot.bell?.startTime} – {slot.bell?.endTime}
                {slot.roomLabel ? ` · ${slot.roomLabel}` : ''}
              </Text>
              <Text style={{ color: '#5b6573' }}>
                {[slot.section?.grade?.name, slot.section?.name].filter(Boolean).join(' ')}
              </Text>
            </Card>
          ))}
        </Feed>
      ) : null}
    </Screen>
  );
}

export default function TimetableScreen() {
  const [mode, setMode] = useState<'boot' | 'student' | 'staff'>('boot');

  useEffect(() => {
    void getUser().then((user) => {
      setMode(isStaffUser(user) || isPrincipalUser(user) ? 'staff' : 'student');
    });
  }, []);

  if (mode === 'boot') {
    return (
      <Screen title="Timetable" onBack>
        <Loader />
      </Screen>
    );
  }
  if (mode === 'staff') return <StaffTimetable />;
  return <StudentTimetable />;
}
