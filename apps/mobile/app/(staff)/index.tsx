import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { getAccessToken } from '@/auth/session';
import { useMobileConfig } from '@/hooks/useMobileConfig';

export default function StaffHomeScreen() {
  const { cards } = useMobileConfig();
  const [home, setHome] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const data = await apiFetch<Record<string, unknown>>('/v1/mobile-app/staff/home', {
        auth: token,
      });
      setHome(data);
    })();
  }, []);

  const enabled = Object.entries(cards)
    .filter(([, on]) => on)
    .map(([key]) => key);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Staff Home</Text>
      <Text>{String((home?.profile as { fullName?: string })?.fullName ?? 'Welcome')}</Text>
      <Text style={{ fontWeight: '500' }}>Enabled cards</Text>
      {enabled.map((card) => (
        <View key={card} style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}>
          <Text style={{ textTransform: 'capitalize' }}>{card}</Text>
          <Text style={{ color: '#666' }}>Phase 1 stub — wire feature in Phase 2</Text>
        </View>
      ))}
    </ScrollView>
  );
}
