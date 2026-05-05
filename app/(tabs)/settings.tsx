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
import { COMMON_CURRENCIES } from '../../src/constants';
import { useFinance } from '../../src/context/FinanceContext';
import type { BackupPayload } from '../../src/lib/backup';
import { formatBackupImportPreview, parseBackupJson, summarizeBackupPayload } from '../../src/lib/backup';
import { buildFinanceCsv } from '../../src/lib/exportCsv';
import type { ThemePreference } from '../../src/types/settings';

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
      const preview = formatBackupImportPreview(summarizeBackupPayload(data));
      Alert.alert('Replace all data?', preview, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace everything', style: 'destructive', onPress: () => void runImport(data) },
      ]);
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
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
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
                  style={[
                    styles.segBtn,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.segText,
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Currency</Text>
          <View style={styles.chips}>
            {COMMON_CURRENCIES.map((c) => {
              const active = settings.currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => void setSettings({ ...settings, currency: c })}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
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
          style={[styles.exportBtn, { backgroundColor: colors.accent }]}
          onPress={() => void exportCsv()}
          disabled={exporting || jsonBusy}
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Full backup (JSON)</Text>
          <Text style={[styles.backupHint, { color: colors.textMuted }]}>
            Includes transactions, budgets, savings goals, custom categories, and app settings. Use import on a new
            device to restore.
          </Text>
          <Pressable
            style={[styles.exportBtn, { backgroundColor: colors.income, marginBottom: 10 }]}
            onPress={() => void exportFullJson()}
            disabled={jsonBusy}
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
            style={[styles.importBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => void pickImportJson()}
            disabled={jsonBusy}
          >
            <Ionicons name="cloud-download-outline" size={22} color={colors.accent} />
            <Text style={[styles.importText, { color: colors.accent }]}>Import backup…</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Custom expense categories</Text>
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
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>None yet.</Text>
          ) : (
            customExpOnly.map((c) => (
              <View key={c} style={[styles.catRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{c}</Text>
                <Pressable onPress={() => void deleteCustomCategory(c, 'expense')}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Custom income categories</Text>
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
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>None yet.</Text>
          ) : (
            customIncOnly.map((c) => (
              <View key={c} style={[styles.catRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{c}</Text>
                <Pressable onPress={() => void deleteCustomCategory(c, 'income')}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Data is stored only on this device (SQLite).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 14 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  segText: { fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 16,
  },
  exportText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backupHint: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
  },
  importText: { fontSize: 16, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addBtn: { paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { fontSize: 13, textAlign: 'center', marginTop: 8 },
});
