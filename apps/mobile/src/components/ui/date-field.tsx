import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

function parseIsoDate(value: string): Date {
  if (!value) return startOfDay(new Date());
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return startOfDay(new Date());
  return new Date(year, month - 1, day);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value: string) {
  if (!value) return '';
  return parseIsoDate(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  accentColor?: string;
  mutedColor?: string;
  borderColor?: string;
  surfaceColor?: string;
};

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  accentColor = '#2563EB',
  mutedColor = '#6B7280',
  borderColor = '#E5E7EB',
  surfaceColor = '#F9FAFB',
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseIsoDate(value));

  const displayValue = useMemo(() => formatDisplayDate(value), [value]);

  function openPicker() {
    setDraft(parseIsoDate(value));
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
  }

  function commitDate(date: Date) {
    onChange(toIsoDate(startOfDay(date)));
    closePicker();
  }

  function onPickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        closePicker();
        return;
      }
      if (selectedDate) commitDate(selectedDate);
      return;
    }
    if (selectedDate) setDraft(selectedDate);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Pressable
        style={[styles.input, { borderColor, backgroundColor: surfaceColor }]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label} date`}
      >
        <Text style={[styles.value, !displayValue && { color: mutedColor }]}>
          {displayValue || placeholder}
        </Text>
        <Text style={[styles.icon, { color: accentColor }]}>📅</Text>
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={closePicker}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closePicker} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Pressable onPress={closePicker}>
                  <Text style={[styles.modalAction, { color: mutedColor }]}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>{label}</Text>
                <Pressable onPress={() => commitDate(draft)}>
                  <Text style={[styles.modalAction, styles.modalDone, { color: accentColor }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onPickerChange}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  icon: { fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  modalAction: { fontSize: 15, fontWeight: '600' },
  modalDone: { fontWeight: '800' },
  iosPicker: { height: 220 },
});
