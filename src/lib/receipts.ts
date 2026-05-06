import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

/** Max stored receipt size (single photo, on-device only). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function receiptSizeLimitLabel(): string {
  return `${Math.round(RECEIPT_MAX_BYTES / (1024 * 1024))} MB`;
}

/**
 * Copies a picked image into app sandbox (`documentDirectory/receipts/`).
 * Returns file URI or null if user cancels.
 */
export async function pickAndStoreReceipt(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo access is needed to attach a receipt.');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;

  if (asset.fileSize != null && asset.fileSize > RECEIPT_MAX_BYTES) {
    throw new Error(`Choose an image under ${receiptSizeLimitLabel()}.`);
  }

  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('App storage is not available.');
  const dir = `${base}receipts`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}/r_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > RECEIPT_MAX_BYTES) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`File must be under ${receiptSizeLimitLabel()}.`);
  }

  return dest;
}
