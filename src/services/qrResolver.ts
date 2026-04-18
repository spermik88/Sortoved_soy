import { t } from '../i18n';
import { PlotPhoto } from '../types/app';
import { createId } from '../utils/id';

export interface ResolvedQr {
  id: string;
  sheetUrl: string;
  title: string;
  plotPhotos: PlotPhoto[];
  duplicateStatus: boolean;
}

export interface QrResolver {
  resolve(raw: string, existingUrls: string[]): ResolvedQr;
}

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  const url = new URL(trimmed);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(t('qr.invalidUrl'));
  }

  return url.toString();
}

function createFallbackTitle(url: string) {
  const hash = Array.from(url).reduce((acc, item) => acc + item.charCodeAt(0), 0);
  return `Соя ${((hash % 9) + 1).toString()}`;
}

function createPlotPhotos(sheetUrl: string): PlotPhoto[] {
  return [1, 2, 3].map((plotIndex) => ({
    plotIndex,
    imageUri: undefined,
    mapsUrl: `https://maps.google.com/?q=${plotIndex},${plotIndex}&sheet=${encodeURIComponent(sheetUrl)}`,
    isPlaceholder: true,
  }));
}

class DefaultQrResolver implements QrResolver {
  resolve(raw: string, existingUrls: string[]) {
    const sheetUrl = normalizeUrl(raw);
    const url = new URL(sheetUrl);
    const title =
      url.searchParams.get('title') ||
      url.pathname.split('/').filter(Boolean).at(-1) ||
      createFallbackTitle(sheetUrl);

    return {
      id: createId('variety'),
      sheetUrl,
      title,
      plotPhotos: createPlotPhotos(sheetUrl),
      duplicateStatus: existingUrls.includes(sheetUrl),
    };
  }
}

export const qrResolver: QrResolver = new DefaultQrResolver();
