import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type Slot = {
  id: string;
  dayOfWeek?: number;
  subject?: { name?: string } | null;
  staff?: { fullName?: string } | null;
  startTime?: string;
  endTime?: string;
  room?: string | null;
};

export default function TimetableScreen() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ slots?: Slot[] }>('/v1/school-mobile/timetable')
      .then((payload) => setSlots(payload.slots ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Timetable" onBack>
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Timetable unavailable" body={error} /> : null}
      {!loading && !error && !slots.length ? (
        <EmptyState
          title="No periods yet"
          body="Your class timetable will appear once it is published."
        />
      ) : null}
      <Feed>
        {slots.map((slot) => (
          <Card key={slot.id}>
            <Text style={{ fontWeight: '800' }}>{slot.subject?.name ?? 'Period'}</Text>
            <Text>
              {slot.startTime} – {slot.endTime}
              {slot.room ? ` · ${slot.room}` : ''}
            </Text>
            {slot.staff?.fullName ? (
              <Text style={{ color: '#5b6573' }}>{slot.staff.fullName}</Text>
            ) : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
