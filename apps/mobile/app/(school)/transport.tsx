import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  fetchSchoolParentTransport,
  fetchSchoolTransportMyTrip,
  fetchSchoolTransportRoster,
  postSchoolTransportBoarding,
  postSchoolTransportSos,
} from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolTransportScreen() {
  const features = useSchoolSession((s) => s.features);
  const persona = useSchoolSession((s) => s.persona);
  const childId = useSchoolSession((s) => s.childId);
  const staff = persona === 'transport' || persona === 'teacher' || persona === 'admin';
  if (features.transport === false) {
    return (
      <SchoolShell title="Transport">
        <SchoolEmpty title="Transport is disabled" />
      </SchoolShell>
    );
  }
  if (staff) return <CrewTransport />;
  return <ParentTransport childId={childId} />;
}

function ParentTransport({ childId }: { childId: string | null }) {
  const q = useQuery({
    queryKey: ['school-tr-parent', childId],
    queryFn: () => fetchSchoolParentTransport(childId),
  });
  const cards = Array.isArray(q.data) ? q.data : [];
  return (
    <SchoolShell title="Transport" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {cards.length === 0 ? (
        <SchoolEmpty
          title="No route assigned"
          body="Vehicle, driver, stop and pickup time appear when transport is linked to this student."
        />
      ) : (
        cards.map((c) => {
          const row = c as Record<string, string>;
          return (
            <SchoolCard key={row.studentId}>
              <Text style={styles.h}>{row.studentName}</Text>
              <Text style={styles.m}>{row.route}</Text>
              <Text style={styles.m}>
                Vehicle {row.vehicle ?? '—'} · Stop {row.stop}
              </Text>
              <Text style={styles.m}>
                Today: {String(row.tripStatus ?? 'NOT_STARTED').replaceAll('_', ' ')}
              </Text>
            </SchoolCard>
          );
        })
      )}
    </SchoolShell>
  );
}

function CrewTransport() {
  const qc = useQueryClient();
  const [confirmSos, setConfirmSos] = useState(false);
  const tripQ = useQuery({
    queryKey: ['school-tr-trip'],
    queryFn: fetchSchoolTransportMyTrip,
  });
  const trip = (tripQ.data?.trip ?? null) as Record<string, unknown> | null;
  const tripId = trip && typeof trip.id === 'string' ? trip.id : '';
  const rosterQ = useQuery({
    queryKey: ['school-tr-roster', tripId],
    queryFn: () => fetchSchoolTransportRoster(tripId),
    enabled: Boolean(tripId),
  });
  const board = useMutation({
    mutationFn: (body: Record<string, unknown>) => postSchoolTransportBoarding(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-tr-roster', tripId] }),
  });
  const students = Array.isArray((rosterQ.data as { students?: unknown[] } | undefined)?.students)
    ? (rosterQ.data as { students: Record<string, unknown>[] }).students
    : [];
  return (
    <SchoolShell
      title="Today's trip"
      loading={tripQ.isLoading}
      onRefresh={() => void tripQ.refetch()}
    >
      {!trip ? (
        <SchoolEmpty
          title="No trip assigned"
          body="You will see today's vehicle, route and student list when duty is scheduled."
        />
      ) : (
        <>
          <SchoolCard>
            <Text style={styles.h}>
              {String((trip.route as { name?: string })?.name ?? 'Route')}
            </Text>
            <Text style={styles.m}>
              {(trip.vehicle as { registrationNumber?: string })?.registrationNumber} ·{' '}
              {String(trip.tripType ?? '')}
            </Text>
            <Text style={styles.m}>Status {String(trip.status ?? '')}</Text>
          </SchoolCard>
          <Pressable style={styles.sos} onPress={() => setConfirmSos(true)}>
            <Text style={styles.sosT}>EMERGENCY SOS</Text>
          </Pressable>
          {students.map((s) => {
            const st = s.student as { id: string; fullName: string };
            const stop = s.stop as { id?: string; name?: string } | undefined;
            return (
              <SchoolCard key={st.id}>
                <Text style={styles.h}>{st.fullName}</Text>
                <Text style={styles.m}>
                  {stop?.name ?? '—'} · {String(s.status)}
                </Text>
                <View style={styles.row}>
                  <Pressable
                    style={styles.btn}
                    onPress={() =>
                      board.mutate({
                        tripId,
                        studentId: st.id,
                        eventType: 'BOARDED',
                        stopId: stop?.id,
                      })
                    }
                  >
                    <Text style={styles.btnT}>Boarded</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnAlt}
                    onPress={() => board.mutate({ tripId, studentId: st.id, eventType: 'ABSENT' })}
                  >
                    <Text>Absent</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnAlt}
                    onPress={() =>
                      board.mutate({
                        tripId,
                        studentId: st.id,
                        eventType: 'DROPPED',
                        stopId: stop?.id,
                      })
                    }
                  >
                    <Text>Dropped</Text>
                  </Pressable>
                </View>
              </SchoolCard>
            );
          })}
        </>
      )}
      {confirmSos ? (
        <SchoolCard>
          <Text style={styles.h}>Send emergency SOS?</Text>
          <Text style={styles.m}>
            Transport administrators will be notified with this trip and location if GPS is enabled.
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.btnAlt} onPress={() => setConfirmSos(false)}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.sos}
              onPress={() => {
                void postSchoolTransportSos({
                  tripId,
                  vehicleId: (trip?.vehicle as { id?: string } | undefined)?.id,
                  description: 'Emergency SOS from mobile',
                }).then(() => setConfirmSos(false));
              }}
            >
              <Text style={styles.sosT}>Confirm SOS</Text>
            </Pressable>
          </View>
        </SchoolCard>
      ) : null}
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '700', color: schoolUi.text },
  m: { marginTop: 4, color: schoolUi.muted },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  btnT: { color: '#fff', fontWeight: '700' },
  btnAlt: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sos: {
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  sosT: { color: '#fff', fontWeight: '800' },
});
