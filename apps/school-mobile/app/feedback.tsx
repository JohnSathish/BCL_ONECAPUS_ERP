import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { NavyButton, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export default function FeedbackScreen() {
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (message.trim().length < 8) {
      setError('Please write a little more so the office can help.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/school-mobile/feedback', {
        method: 'POST',
        body: JSON.stringify({ message, phone, subject: 'App feedback' }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Feedback / Enquiry" onBack light>
      <View style={styles.box}>
        {done ? (
          <Text style={styles.lead}>Thank you. The school office has received your message.</Text>
        ) : (
          <>
            <Text style={styles.lead}>
              Write to the school office. This is not an emergency line.
            </Text>
            <TextInput
              placeholder="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <TextInput
              placeholder="Your message"
              value={message}
              onChangeText={setMessage}
              style={[styles.input, { height: 140, textAlignVertical: 'top' }]}
              multiline
              placeholderTextColor={colors.muted}
            />
            {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
            <NavyButton label={busy ? 'Sending…' : 'Send'} onPress={() => void send()} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.lg, gap: 12 },
  lead: { color: colors.muted, lineHeight: 20 },
  input: {
    backgroundColor: '#f3f5fb',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
});
