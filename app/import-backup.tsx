import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../src/context/FinanceContext';
import type { BackupPayload } from '../src/lib/backup';
import { formatBackupImportPreview, parseBackupJson, summarizeBackupPayload } from '../src/lib/backup';
import { radii, space, surfaceCard, type as typeStyles } from '../src/theme/tokens';

export default function ImportBackupScreen() {
  const { colors, importBackup } = useFinance();
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [preview, setPreview] = useState<string>('');

  const pick = async () => {
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
    setBusy(true);
    try {
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
      const data = parseBackupJson(raw);
      const text = formatBackupImportPreview(summarizeBackupPayload(data));
      setPayload(data);
      setPreview(text);
    } catch (e) {
      Alert.alert('Invalid backup', e instanceof Error ? e.message : 'Could not parse JSON.');
    } finally {
      setBusy(false);
    }
  };

  const canImport = Boolean(payload) && !busy;

  const lines = useMemo(() => preview.split('\n').filter(Boolean), [preview]);

  const runImport = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      await importBackup(payload);
      Alert.alert('Restored', 'All data was replaced from the backup.');
      setPayload(null);
      setPreview('');
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Ionicons name="cloud-download-outline" size={20} color={colors.accent} />
          <Text style={[typeStyles.titleLarge, { color: colors.text }]}>Import backup</Text>
        </View>
        <Text style={[typeStyles.bodySmall, { color: colors.textMuted, marginTop: 4 }]}>
          This will replace all local data on this device.
        </Text>

        <Pressable
          onPress={() => void pick()}
          style={({ pressed }) => [
            styles.pickBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && !busy && { opacity: 0.9 },
          ]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Choose JSON backup file"
        >
          {busy ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="document-outline" size={22} color={colors.textMuted} />}
          <Text style={[typeStyles.bodyMedium, { color: colors.text }]}>
            {payload ? 'Choose a different file…' : 'Choose JSON backup…'}
          </Text>
        </Pressable>

        {preview ? (
          <View style={[styles.previewCard, surfaceCard(colors, true)]}>
            <Text style={[typeStyles.title, { color: colors.text, marginBottom: space[1] }]}>Preview</Text>
            {lines.map((l, idx) => (
              <Text key={idx} style={[typeStyles.bodySmall, { color: colors.textSecondary, marginBottom: 2 }]}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => void runImport()}
          disabled={!canImport}
          style={({ pressed }) => [
            styles.importBtn,
            { backgroundColor: canImport ? colors.danger : colors.border },
            pressed && canImport && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Replace all data from backup"
        >
          <Ionicons name="warning-outline" size={22} color="#fff" />
          <Text style={styles.importText}>{busy ? 'Importing…' : 'Replace everything'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: space[3], paddingBottom: space[5] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    paddingVertical: space[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: space[2],
  },
  previewCard: { padding: space[2], marginTop: space[2] },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    borderRadius: radii.lg,
    paddingVertical: space[2],
    marginTop: space[2],
  },
  importText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

