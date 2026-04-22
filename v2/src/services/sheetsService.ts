import { SheetWriteOperation, VarietySheetBinding } from '../types/app';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function ensureOk(response: Response) {
  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.status}`);
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

export interface SheetsService {
  inspectSpreadsheet(accessToken: string, inputUrl: string): Promise<VarietySheetBinding & { title: string }>;
  createSpreadsheet(accessToken: string, title: string, sheets: string[]): Promise<VarietySheetBinding>;
  writeOperations(accessToken: string, spreadsheetId: string, operations: SheetWriteOperation[]): Promise<void>;
}

class GoogleSheetsService implements SheetsService {
  async inspectSpreadsheet(accessToken: string, inputUrl: string) {
    if (!isValidGoogleSheetsUrl(inputUrl)) {
      throw new Error('Буфер обмена не содержит корректную ссылку Google Sheets');
    }

    const spreadsheetId = extractSpreadsheetId(inputUrl);
    const response = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=properties.title`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    ensureOk(response);
    const data = (await response.json()) as { properties?: { title?: string } };
    return {
      spreadsheetId,
      spreadsheetUrl: inputUrl,
      title: data.properties?.title || 'Без названия',
    };
  }

  async createSpreadsheet(accessToken: string, title: string, sheets: string[]) {
    const response = await fetch(SHEETS_BASE, {
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
    ensureOk(response);
    const data = (await response.json()) as { spreadsheetId: string; spreadsheetUrl: string };

    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
    };
  }

  async writeOperations(accessToken: string, spreadsheetId: string, operations: SheetWriteOperation[]) {
    for (const operation of operations) {
      if (operation.strategy === 'append' || operation.strategy === 'next-empty' || operation.strategy === 'upload-meta') {
        const appendRange = encodeURIComponent(operation.range || `${operation.sheet}!A1`);
        const response = await fetch(
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
        ensureOk(response);
        continue;
      }

      const response = await fetch(
        `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(operation.range || `${operation.sheet}!A1`)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: operation.values }),
        },
      );
      ensureOk(response);
    }
  }
}

export const sheetsService: SheetsService = new GoogleSheetsService();
