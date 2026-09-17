import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Guardian = { fullName: string; relation: string; phone?: string | null };
type Me = { student?: { guardians?: Guardian[] } | null };

export default function ProfileGuardiansScreen() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>('/v1/school-mobile/me')
      .then(setMe)
      .catch(() => setMe({}));
  }, []);

  if (!me) {
    return (
      <Screen title="Parent / Guardian Details" onBack>
        <Loader />
      </Screen>
    );
  }

  const guardians = me.student?.guardians ?? [];
  if (!guardians.length) {
    return (
      <Screen title="Parent / Guardian Details" onBack>
        <EmptyState
          title="No family details yet"
          body="Parent and guardian contacts appear here after the school office records them."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Parent / Guardian Details" onBack>
      <Feed>
        {guardians.map((g) => (
          <Card key={`${g.fullName}-${g.relation}`}>
            <Text style={styles.name}>{g.fullName}</Text>
            <Text style={styles.meta}>{g.relation}</Text>
            {g.phone ? <Text style={styles.meta}>{g.phone}</Text> : null}
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
});
