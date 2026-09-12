import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';
import { apiFetch } from '@/api/client';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';

type Site = {
  displayName?: string;
  motto?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
};

export default function SchoolScreen() {
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ site?: Site }>('/v1/school-mobile/home')
      .then((payload) => setSite(payload.site ?? {}))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!site && !error) {
    return (
      <Screen title="School Information" onBack>
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen title="School Information" onBack>
      {error ? <EmptyState title="Could not load school details" body={error} /> : null}
      <Feed>
        <Card>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>
            {site?.displayName || "St. Luke's Secondary School"}
          </Text>
          {site?.motto ? <Text>{site.motto}</Text> : null}
          {site?.addressLine ? <Text>{site.addressLine}</Text> : null}
          {site?.city ? <Text>{site.city}</Text> : null}
          {site?.phone ? (
            <Text onPress={() => void Linking.openURL(`tel:${site.phone}`)}>{site.phone}</Text>
          ) : null}
          {site?.email ? (
            <Text onPress={() => void Linking.openURL(`mailto:${site.email}`)}>{site.email}</Text>
          ) : null}
        </Card>
      </Feed>
    </Screen>
  );
}
