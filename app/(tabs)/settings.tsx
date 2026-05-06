import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { EmptyStateCard } from '../../src/components/EmptyStateCard';
import { COMMON_CURRENCIES } from '../../src/constants';
import { useFinance } from '../../src/context/FinanceContext';
import { useTabHeaderSubtitle } from '../../src/hooks/useTabHeaderSubtitle';
import type { BackupPayload } from '../../src/lib/backup';
import { parseBackupJson } from '../../src/lib/backup';
import { buildFinanceCsv } from '../../src/lib/exportCsv';
import type { ThemePreference } from '../../src/types/settings';
import { radii, space, surfaceCard, type as typeStyles } from '../../src/theme/tokens';

export default function SettingsScreen() {
  const {
    ready,
    colors,
    settings,
    setSettings,
    expenses,
    incomes,
    expenseCategoryOptions,
    incomeCategoryOptions,
    addCustomCategory,
    deleteCustomCategory,
    exportBackup,
    importBackup,
  } = useFinance();
  const [newExpCat, setNewExpCat] = useState('');
  const [newIncCat, setNewIncCat] = useState('');
  const [exporting, setExporting] = useState(false);
  const [jsonBusy, setJsonBusy] = useState(false);

  useTabHeaderSubtitle('Settings', 'Data & preferences', colors);

  const exportCsv = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Export', 'Sharing is not available on this device.');
      return;
    }
    const dir = FileSystem.cacheDirectory;
    if (!dir) {
      Alert.alert('Export', 'Cache directory is not available.');
      return;
    }
    setExporting(true);
    try {
      const csv = buildFinanceCsv(expenses, incomes);
      const path = `${dir}expense-tracker-export.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  const exportFullJson = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Export', 'Sharing is not available on this device.');
      return;
    }
    const dir = FileSystem.cacheDirectory;
    if (!dir) {
      Alert.alert('Export', 'Cache directory is not available.');
      return;
    }
    setJsonBusy(true);
    try {
      const data = await exportBackup();
      const json = JSON.stringify(data, null, 2);
      const path = `${dir}expense-tracker-backup.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Full backup',
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setJsonBusy(false);
    }
  };

  const runImport = async (data: BackupPayload) => {
    setJsonBusy(true);
    try {
      await importBackup(data);
      Alert.alert('Restored', 'All data was replaced from the backup.');
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setJsonBusy(false);
    }
  };

  const pickImportJson = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) {
      Alert.alert('Import', 'Could not read the file.');
      return;
    }
    try {
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
      const data = parseBackupJson(raw);
      Alert.alert(
        'Replace all data?',
        'This overwrites expenses, income, budgets, goals, categories, and settings. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace everything', style: 'destructive', onPress: () => void runImport(data) },
        ]
      );
    } catch (e) {
      Alert.alert('Invalid backup', e instanceof Error ? e.message : 'Could not parse JSON.');
    }
  };

  const setTheme = (theme: ThemePreference) => void setSettings({ ...settings, theme });

  const defaultsExp = new Set(['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other']);
  const defaultsInc = new Set(['Salary', 'Freelance', 'Investment', 'Gift', 'Refund', 'Other']);
  const customExpOnly = expenseCategoryOptions.filter((c) => !defaultsExp.has(c));
  const customIncOnly = incomeCategoryOptions.filter((c) => !defaultsInc.has(c));

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[typeStyles.body, styles.loadingHint, { color: colors.textMuted }]}>
          Loading settings…
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.segment}>
            {(
              [
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as const
            ).map(([key, label]) => {
              const active = settings.theme === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTheme(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Theme ${label}`}
                  style={({ pressed }) => [
                    styles.segBtn,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.accent, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text
                    style={[
                      typeStyles.bodySmall,
                      { color: colors.textSecondary },
                      active && { color: '#fff', fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Currency</Text>
          <View style={styles.chips}>
            {COMMON_CURRENCIES.map((c) => {
              const active = settings.currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => void setSettings({ ...settings, currency: c })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Currency ${c}`}
                  style={({ pressed }) => [
                    styles.chip,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text
                    style={[
                      typeStyles.captionMedium,
                      { color: colors.textSecondary },
                      active && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.exportBtn,
            { backgroundColor: colors.accent },
            pressed && !(exporting || jsonBusy) && { opacity: 0.92 },
          ]}
          onPress={() => void exportCsv()}
          disabled={exporting || jsonBusy}
          accessibilityRole="button"
          accessibilityLabel="Export transactions as CSV"
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={22} color="#fff" />
              <Text style={styles.exportText}>Export CSV (expenses + income)</Text>
            </>
          )}
        </Pressable>

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Full backup (JSON)</Text>
          <Text style={[typeStyles.bodySmall, styles.backupHint, { color: colors.textMuted }]}>
            Includes transactions, budgets, savings goals, custom categories, and app settings. Use import on a new
            device to restore.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: colors.income, marginBottom: space[1] + 2 },
              pressed && !jsonBusy && { opacity: 0.92 },
            ]}
            onPress={() => void exportFullJson()}
            disabled={jsonBusy}
            accessibilityRole="button"
            accessibilityLabel="Export full backup as JSON"
          >
            {jsonBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                <Text style={styles.exportText}>Export full backup</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.importBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              pressed && !jsonBusy && { opacity: 0.88 },
            ]}
            onPress={() => void pickImportJson()}
            disabled={jsonBusy}
            accessibilityRole="button"
            accessibilityLabel="Import backup from JSON file"
          >
            <Ionicons name="cloud-download-outline" size={22} color={colors.accent} />
            <Text style={[styles.importText, { color: colors.accent }]}>Import backup…</Text>
          </Pressable>
        </View>

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Custom expense categories</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[
                styles.addInput,
                { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="New category"
              placeholderTextColor={colors.textMuted}
              value={newExpCat}
              onChangeText={setNewExpCat}
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                const t = newExpCat.trim();
                if (!t) return;
                void addCustomCategory(t, 'expense');
                setNewExpCat('');
              }}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          {customExpOnly.length === 0 ? (
            <EmptyStateCard
              colors={colors}
              title="No custom categories"
              description="Add labels you use often (e.g. childcare, pets). Built-in categories stay available."
              icon={<Ionicons name="pricetags-outline" size={32} color={colors.textMuted} />}
            />
          ) : (
            customExpOnly.map((c) => (
              <View key={c} style={[styles.catRow, { borderColor: colors.border }]}>
                <Text style={[typeStyles.body, { color: colors.text, flex: 1 }]}>{c}</Text>
                <Pressable
                  onPress={() => void deleteCustomCategory(c, 'expense')}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete custom expense category ${c}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, surfaceCard(colors, true)]}>
          <Text style={[typeStyles.title, styles.cardTitle, { color: colors.text }]}>Custom income categories</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[
                styles.addInput,
                { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="New category"
              placeholderTextColor={colors.textMuted}
              value={newIncCat}
              onChangeText={setNewIncCat}
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                const t = newIncCat.trim();
                if (!t) return;
                void addCustomCategory(t, 'income');
                setNewIncCat('');
              }}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          {customIncOnly.length === 0 ? (
            <EmptyStateCard
              colors={colors}
              title="No custom categories"
              description="Add income labels that match how you earn (e.g. side gig, rental)."
              icon={<Ionicons name="pricetags-outline" size={32} color={colors.textMuted} />}
            />
          ) : (
            customIncOnly.map((c) => (
              <View key={c} style={[styles.catRow, { borderColor: colors.border }]}>
                <Text style={[typeStyles.body, { color: colors.text, flex: 1 }]}>{c}</Text>
                <Pressable
                  onPress={() => void deleteCustomCategory(c, 'income')}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete custom income category ${c}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={[typeStyles.caption, styles.footer, { color: colors.textMuted }]}>
          Data is stored only on this device (SQLite).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHint: { marginTop: space[1] + 4 },
  scroll: { padding: space[3], paddingBottom: space[5] },
  card: { padding: space[2], marginBottom: space[2] },
  cardTitle: { marginBottom: space[2] - 4 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  segBtn: { paddingHorizontal: space[2] - 2, paddingVertical: space[1] + 2, borderRadius: radii.md, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  chip: { paddingHorizontal: space[1] + 4, paddingVertical: space[1], borderRadius: radii.pill, borderWidth: 1 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    borderRadius: radii.lg - 2,
    paddingVertical: space[2],
    marginBottom: space[2],
  },
  exportText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backupHint: { marginBottom: space[2] - 4 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    borderRadius: radii.lg - 2,
    paddingVertical: space[2] - 2,
    borderWidth: 2,
  },
  importText: { fontSize: 16, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: space[1] + 2, marginBottom: space[1] + 4 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: space[1] + 4,
    paddingVertical: space[1] + 2,
    fontSize: 15,
  },
  addBtn: { paddingHorizontal: space[2] + 2, borderRadius: radii.md, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[1] + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { textAlign: 'center', marginTop: space[1] },
  iconHit: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
