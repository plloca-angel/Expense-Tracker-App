import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatISODateMedium, parseISODateLocal, toISODateString } from '../lib/money';
import type { ThemeColors } from '../theme/colors';
import { radii, space, type as typeStyles } from '../theme/tokens';

type Props = {
  label: string;
  value: string;
  onChange: (nextIso: string) => void;
  colors: ThemeColors;
  isDark: boolean;
  optional?: boolean;
  placeholder?: string;
};

export function DateField({ label, value, onChange, colors, isDark, optional, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const canClear = optional && value.trim().length > 0;

  const openPicker = useCallback(() => setOpen(true), []);
  const closePicker = useCallback(() => setOpen(false), []);

  const dateForPicker = useMemo(() => {
    if (!value.trim()) return new Date();
    return parseISODateLocal(value);
  }, [value]);

  const applyPickedDate = useCallback(
    (d: Date) => {
      onChange(toISODateString(d));
    },
    [onChange]
  );

  const onAndroidChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      closePicker();
      if (event.type !== 'set' || !date) return;
      applyPickedDate(date);
    },
    [applyPickedDate, closePicker]
  );

  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={[typeStyles.captionMedium, { color: colors.textSecondary, marginBottom: 6 }]}>{label}</Text>
        <View style={styles.webRow}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder ?? 'YYYY-MM-DD'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={[
              styles.webInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
            ]}
          />
          {canClear ? (
            <Pressable
              onPress={() => onChange('')}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label}`}
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={[typeStyles.captionMedium, { color: colors.textSecondary, marginBottom: 6 }]}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value.trim() ? formatISODateMedium(value) : optional ? 'None' : ''}`}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.triggerRow}>
          <Text style={[typeStyles.bodyMedium, { color: value.trim() ? colors.text : colors.textMuted }]}>
            {value.trim() ? formatISODateMedium(value) : optional ? 'None' : (placeholder ?? 'Pick a date')}
          </Text>
          <View style={styles.triggerIcons}>
            {canClear ? (
              <Pressable
                onPress={() => onChange('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${label}`}
              >
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            ) : null}
            <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          </View>
        </View>
      </Pressable>

      {open && Platform.OS === 'ios' ? (
        <Modal animationType="slide" transparent visible onRequestClose={closePicker}>
          <Pressable style={styles.modalOverlay} onPress={closePicker}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalToolbar, { borderBottomColor: colors.border }]}>
                <Pressable onPress={closePicker} hitSlop={12} accessibilityRole="button">
                  <Text style={[typeStyles.bodyMedium, { color: colors.accent, fontWeight: '600' }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={dateForPicker}
                mode="date"
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={(_, d) => {
                  if (d) applyPickedDate(d);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker value={dateForPicker} mode="date" display="default" onChange={onAndroidChange} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  webInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2],
    paddingVertical: space[1] + 2,
    fontSize: 16,
  },
  clearBtn: { padding: 4 },
  trigger: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[2],
    paddingVertical: space[1] + 2,
  },
  triggerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] },
  triggerIcons: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: space[2],
  },
  modalToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

