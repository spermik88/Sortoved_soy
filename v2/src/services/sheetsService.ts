import { LocalSheetKey, SheetWriteOperation, VarietySheetBinding } from '../types/app';
import {
  findMissingTemplateSheets,
  resolveSheetAliases,
  SpreadsheetSheetInfo,
} from './sheetAliasService';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_REQUEST_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Google Sheets request timed out. Проверьте интернет/VPN и повторите.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      details = '';
    }
    throw new Error(`Google Sheets API error: ${response.status}${details ? ` ${details}` : ''}`);
  }
}

export function extractSpreadsheetId(input: string) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Ссылка на Google Sheets не распознана');
  }

  return match[1];
}

export function isValidGoogleSheetsUrl(input: string) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/i.test(input.trim());
}

export interface InspectedSpreadsheet extends VarietySheetBinding {
  title: string;
  sheets: SpreadsheetSheetInfo[];
  sheetAliases: Partial<Record<LocalSheetKey, string>>;
  missingTemplateSheets: string[];
}

export interface SheetsService {
  inspectSpreadsheet(accessToken: string, inputUrl: string): Promise<InspectedSpreadsheet>;
  createSpreadsheet(accessToken: string, title: string, sheets: string[]): Promise<VarietySheetBinding>;
  readSheet(accessToken: string, spreadsheetId: string, sheet: string): Promise<(string | number | boolean)[][]>;
  readRange(accessToken: string, spreadsheetId: string, range: string): Promise<(string | number | boolean)[][]>;
  batchGet(
    accessToken: string,
    spreadsheetId: string,
    ranges: string[],
  ): Promise<Record<string, (string | number | boolean)[][]>>;
  writeOperations(accessToken: string, spreadsheetId: string, operations: SheetWriteOperation[]): Promise<void>;
  batchUpdate(accessToken: string, spreadsheetId: string, requests: Record<string, unknown>[]): Promise<void>;
}

class GoogleSheetsService implements SheetsService {
  async inspectSpreadsheet(accessToken: string, inputUrl: string) {
    if (!isValidGoogleSheetsUrl(inputUrl)) {
      throw new Error('Буфер обмена не содержит корректную ссылку Google Sheets');
    }

    const spreadsheetId = extractSpreadsheetId(inputUrl);
    console.log('[Sheets] inspectSpreadsheet', { spreadsheetId });
    const response = await fetchWithTimeout(`${SHEETS_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await ensureOk(response);
    const data = (await response.json()) as {
      properties?: { title?: string };
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    const sheets = (data.sheets || [])
      .map((sheet) => ({
        sheetId: sheet.properties?.sheetId,
        title: sheet.properties?.title || '',
      }))
      .filter((sheet) => sheet.title);

    return {
      spreadsheetId,
      spreadsheetUrl: inputUrl,
      title: data.properties?.title || 'Без названия',
      sheets,
      sheetAliases: resolveSheetAliases(sheets),
      missingTemplateSheets: findMissingTemplateSheets(sheets),
    };
  }

  async createSpreadsheet(accessToken: string, title: string, sheets: string[]) {
    console.log('[Sheets] createSpreadsheet', { title, sheetCount: sheets.length });
    const response = await fetchWithTimeout(SHEETS_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: sheets.map((sheetTitle) => ({
          properties: { title: sheetTitle },
        })),
      }),
    });
    await ensureOk(response);
    const data = (await response.json()) as { spreadsheetId: string; spreadsheetUrl: string };

    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
    };
  }

  async readRange(accessToken: string, spreadsheetId: string, range: string) {
    const response = await fetchWithTimeout(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await ensureOk(response);
    const data = (await response.json()) as { values?: (string | number | boolean)[][] };
    return data.values || [];
  }

  async readSheet(accessToken: string, spreadsheetId: string, sheet: string) {
    return this.readRange(accessToken, spreadsheetId, sheet);
  }

  async batchGet(accessToken: string, spreadsheetId: string, ranges: string[]) {
    const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
    const response = await fetchWithTimeout(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${query}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await ensureOk(response);
    const data = (await response.json()) as {
      valueRanges?: { range?: string; values?: (string | number | boolean)[][] }[];
    };

    return Object.fromEntries(
      (data.valueRanges || []).map((item) => [item.range || '', item.values || []]),
    );
  }

  async writeOperations(accessToken: string, spreadsheetId: string, operations: SheetWriteOperation[]) {
    for (const operation of operations) {
      if (
        operation.strategy === 'append' ||
        operation.strategy === 'next-empty' ||
        operation.strategy === 'upload-meta'
      ) {
        const appendRange = encodeURIComponent(operation.range || `${operation.sheet}!A1`);
        const response = await fetchWithTimeout(
          `${SHEETS_BASE}/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: operation.values }),
          },
        );
        await ensureOk(response);
        continue;
      }

      const response = await fetchWithTimeout(
        `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(
          operation.range || `${operation.sheet}!A1`,
        )}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: operation.values }),
        },
      );
      await ensureOk(response);
    }
  }

  async batchUpdate(accessToken: string, spreadsheetId: string, requests: Record<string, unknown>[]) {
    if (!requests.length) {
      return;
    }
    const response = await fetchWithTimeout(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
    await ensureOk(response);
  }
}

export const sheetsService: SheetsService = new GoogleSheetsService();
