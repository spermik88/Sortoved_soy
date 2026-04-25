import { META_SHEET_NAME, PLOTS_SHEET_NAME, SHEET_ALIASES } from '../config/templateSchema';
import { LocalSheetKey } from '../types/app';

function normalizeSheetName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[().]/g, '')
    .trim();
}

export interface SpreadsheetSheetInfo {
  sheetId?: number;
  title: string;
}

export function resolveSheetAliases(
  sheets: SpreadsheetSheetInfo[],
): Partial<Record<LocalSheetKey, string>> {
  const availableByNormalized = new Map(
    sheets.map((sheet) => [normalizeSheetName(sheet.title), sheet.title]),
  );

  const aliases: Partial<Record<LocalSheetKey, string>> = {};

  (Object.entries(SHEET_ALIASES) as [LocalSheetKey, (typeof SHEET_ALIASES)[LocalSheetKey]][]).forEach(
    ([key, config]) => {
      const candidates = [config.futureRemote, config.local];
      const resolved = candidates.find((candidate) =>
        availableByNormalized.has(normalizeSheetName(candidate)),
      );

      if (resolved) {
        aliases[key] = availableByNormalized.get(normalizeSheetName(resolved));
      }
    },
  );

  return aliases;
}

export function findMissingTemplateSheets(sheets: SpreadsheetSheetInfo[]) {
  const availableByNormalized = new Set(sheets.map((sheet) => normalizeSheetName(sheet.title)));
  const missing: string[] = [];

  if (!availableByNormalized.has(normalizeSheetName(META_SHEET_NAME))) {
    missing.push(META_SHEET_NAME);
  }

  if (!availableByNormalized.has(normalizeSheetName(PLOTS_SHEET_NAME))) {
    missing.push(PLOTS_SHEET_NAME);
  }

  (Object.values(SHEET_ALIASES) as (typeof SHEET_ALIASES)[LocalSheetKey][]).forEach((config) => {
    const candidates = [config.futureRemote, config.local].map(normalizeSheetName);
    if (!candidates.some((candidate) => availableByNormalized.has(candidate))) {
      missing.push(config.futureRemote);
    }
  });

  return missing;
}

export function resolveSheetTitle(
  logicalSheetKey: LocalSheetKey,
  aliases?: Partial<Record<LocalSheetKey, string>>,
) {
  return aliases?.[logicalSheetKey] || SHEET_ALIASES[logicalSheetKey].futureRemote;
}
