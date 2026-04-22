import { v2Copy } from '../config/copy';

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatPhotoMeta(
  email: string | undefined,
  mapsUrl: string | undefined,
  timestamp?: string,
) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const day = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${day}`;
  return `${stamp}, ${email || v2Copy.unknownUser}, ${mapsUrl || v2Copy.noMap}`;
}

export function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}
