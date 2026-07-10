import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearSession } from '@/auth/session';
import { normalizeSchoolConfig, saveSchoolConfig } from '@/auth/school-config';
import { PRODUCT_NAME } from '@/constants/release';
import {
  fetchSchoolRegistry,
  filterSchools,
  parseSchoolDeepLink,
  probeSchoolConnection,
} from '@/services/school-registry';
import type { SchoolRegistryEntry } from '@/types/school';

export default function SelectSchoolScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [schools, setSchools] = useState<SchoolRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualApi, setManualApi] = useState('');
  const [manualTenant, setManualTenant] = useState('');

  const filtered = useMemo(() => filterSchools(schools, query), [schools, query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSchools(await fetchSchoolRegistry());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load institutions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      const partial = parseSchoolDeepLink(url);
      if (partial?.apiUrl && partial.tenantSlug && partial.name) {
        setShowManual(true);
        setManualName(partial.name);
        setManualApi(partial.apiUrl);
        setManualTenant(partial.tenantSlug);
      }
    });
  }, []);

  async function chooseSchool(entry: SchoolRegistryEntry) {
    setSaving(true);
    setError(null);
    try {
      await clearSession();
      const config = normalizeSchoolConfig(entry);
      await probeSchoolConnection(config);
      await saveSchoolConfig(config);
      router.replace('/(auth)/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to this institution');
    } finally {
      setSaving(false);
    }
  }

  async function saveManual() {
    if (!manualName.trim() || !manualApi.trim() || !manualTenant.trim()) {
      setError('Enter institution name, API URL, and tenant code.');
      return;
    }
    await chooseSchool({
      id: manualTenant.trim().toLowerCase(),
      name: manualName.trim(),
      apiUrl: manualApi.trim(),
      tenantSlug: manualTenant.trim().toLowerCase(),
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <LinearGradient colors={['#020f2e', '#0f3c89']} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{PRODUCT_NAME}</Text>
          <Text style={styles.title}>Find your institution</Text>
          <Text style={styles.subtitle}>
            Select your college or school. The app will connect to that campus ERP server.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, city, or code…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.search}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.list}>
              {filtered.map((school) => (
                <Pressable
                  key={school.id}
                  style={styles.card}
                  disabled={saving}
                  onPress={() => void chooseSchool(school)}
                >
                  <Text style={styles.cardTitle}>{school.name}</Text>
                  {school.region ? <Text style={styles.cardMeta}>{school.region}</Text> : null}
                  <Text style={styles.cardCode}>Code: {school.tenantSlug}</Text>
                </Pressable>
              ))}
              {filtered.length === 0 ? (
                <Text style={styles.empty}>No institutions match your search.</Text>
              ) : null}
            </View>
          )}

          <Pressable onPress={() => setShowManual((v) => !v)} style={styles.manualToggle}>
            <Text style={styles.manualToggleText}>
              {showManual ? 'Hide manual setup' : 'Enter API URL manually'}
            </Text>
          </Pressable>

          {showManual ? (
            <View style={styles.manualBox}>
              <TextInput
                value={manualName}
                onChangeText={setManualName}
                placeholder="Institution name"
                placeholderTextColor="#64748b"
                style={styles.manualInput}
              />
              <TextInput
                value={manualApi}
                onChangeText={setManualApi}
                placeholder="API URL (e.g. https://erp.college.edu/api)"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                style={styles.manualInput}
              />
              <TextInput
                value={manualTenant}
                onChangeText={setManualTenant}
                placeholder="Tenant code (e.g. demo)"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                style={styles.manualInput}
              />
              <Pressable
                style={[styles.continueBtn, saving && styles.continueDisabled]}
                disabled={saving}
                onPress={() => void saveManual()}
              >
                <Text style={styles.continueText}>
                  {saving ? 'Connecting…' : 'Save & continue'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  kicker: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  search: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  list: { gap: 10, marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  cardMeta: { fontSize: 13, color: '#64748b' },
  cardCode: { fontSize: 12, color: '#475569', fontWeight: '600' },
  empty: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 12 },
  error: { color: '#fecaca', fontSize: 13 },
  manualToggle: { alignItems: 'center', paddingVertical: 10 },
  manualToggleText: { color: '#bfdbfe', fontWeight: '700', fontSize: 13 },
  manualBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  continueBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueDisabled: { opacity: 0.6 },
  continueText: { color: '#fff', fontWeight: '800' },
});
