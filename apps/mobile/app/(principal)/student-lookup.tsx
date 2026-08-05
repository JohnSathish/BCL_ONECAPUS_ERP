import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentCommandCardView } from '@/components/principal-portal/student-command-card';
import { principalTheme } from '@/components/principal-portal/theme';
import { fetchStudentCommand } from '@/services/principal-desk';
import type { StudentCommandCard } from '@/types/principal-desk';

const MIN_QUERY_LEN = 3;

export default function PrincipalStudentLookupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [card, setCard] = useState<StudentCommandCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const canSearch = query.trim().length >= MIN_QUERY_LEN;

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      setError(`Enter at least ${MIN_QUERY_LEN} characters (name, roll, or enrollment).`);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setSearched(true);
    setCard(null);
    try {
      const result = await fetchStudentCommand(q);
      setCard(result);
    } catch (e) {
      const status =
        e && typeof e === 'object' && 'status' in e ? Number((e as { status: number }).status) : 0;
      if (status === 404) {
        setError('No student found for that query.');
      } else {
        setError(e instanceof Error ? e.message : 'Lookup failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={principalTheme.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.eyebrow}>Principal Desk</Text>
          <Text style={styles.title}>Student Quick Lookup</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={principalTheme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, roll, enrollment, RFID…"
            placeholderTextColor={principalTheme.textSubtle}
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void search()}
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          style={[styles.searchBtn, !canSearch || loading ? styles.searchBtnDisabled : null]}
          disabled={!canSearch || loading}
          onPress={() => void search()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Find</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!searched && !loading ? (
          <View style={styles.hintBox}>
            <Ionicons name="school-outline" size={36} color={principalTheme.primaryAccent} />
            <Text style={styles.hintTitle}>Look up any student</Text>
            <Text style={styles.hintBody}>
              Search by full or partial name, enrollment number, roll number, application number, or
              RFID. Results show attendance, fees, admit eligibility, library, and contact.
            </Text>
          </View>
        ) : null}

        {card ? <StudentCommandCardView card={card} /> : null}

        {searched && !loading && !card && !error ? (
          <Text style={styles.empty}>No student to display.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: principalTheme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: principalTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: principalTheme.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: principalTheme.background,
  },
  headerTitles: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: principalTheme.primaryAccent,
  },
  title: { fontSize: 18, fontWeight: '800', color: principalTheme.text },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: principalTheme.surface,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: principalTheme.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: principalTheme.border,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: principalTheme.text,
    fontWeight: '600',
    paddingVertical: 10,
  },
  searchBtn: {
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: principalTheme.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  body: { padding: 16, gap: 12 },
  error: {
    color: principalTheme.urgent,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: principalTheme.criticalBg,
    padding: 12,
    borderRadius: 10,
  },
  hintBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  hintTitle: { fontSize: 17, fontWeight: '800', color: principalTheme.text },
  hintBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: principalTheme.textMuted,
  },
  empty: { textAlign: 'center', color: principalTheme.textMuted, marginTop: 24 },
});
