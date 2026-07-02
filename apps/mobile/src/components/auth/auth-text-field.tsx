import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { authColors, type AuthColorScheme } from './auth-theme';

type AuthTextFieldProps = {
  scheme: AuthColorScheme;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
};

export function AuthTextField({
  scheme,
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  showToggle,
  showPassword,
  onTogglePassword,
  autoCapitalize = 'none',
  keyboardType = 'default',
}: AuthTextFieldProps) {
  const colors = authColors(scheme);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          style={[styles.input, { color: colors.text }]}
        />
        {showToggle ? (
          <Pressable onPress={onTogglePassword} hitSlop={8}>
            <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  inputRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15 },
  toggle: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
});
