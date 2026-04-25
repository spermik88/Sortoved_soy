import { resolveSheetAliases } from '../v2/src/services/sheetAliasService';
import { syncTaskReadState } from '../v2/src/services/googleSyncService';
import { processQueuedOperation } from '../v2/src/services/syncQueueService';
import { InspectionTask, QueuedOperation, VarietyRecord } from '../v2/src/types/app';
import { driveService } from '../v2/src/services/driveService';
import { sheetsService } from '../v2/src/services/sheetsService';
import { SHEET_ALIASES } from '../v2/src/config/templateSchema';

jest.mock('../v2/src/services/driveService', () => ({
  driveService: {
    assertFolderWritable: jest.fn(async () => undefined),
    uploadPhoto: jest.fn(async (_token: string, _uri: string, name: string) => ({
      id: name,
      webViewLink: `https://drive.google.com/${name}`,
    })),
  },
}));

jest.mock('../v2/src/services/sheetsService', () => ({
  sheetsService: {
    writeOperations: jest.fn(async () => undefined),
    readSheet: jest.fn(async () => []),
  },
}));

describe('google sync helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps logical sheet keys to existing spreadsheet sheet names', () => {
    const aliases = resolveSheetAliases([
      { title: '4.Начало цветения' },
      { title: '27.Масса 1000 семян' },
      { title: '17.Длина стебля' },
    ]);

    expect(aliases.start_flowering_sheet).toBe('4.Начало цветения');
    expect(aliases.thousand_seed_weight_sheet).toBe('27.Масса 1000 семян');
    expect(aliases.stem_length_sheet).toBe('17.Длина стебля');
  });

  it('throws authRequired when cloud sync is resumed without session', async () => {
    const operation: QueuedOperation = {
      id: 'queue-1',
      type: 'write_sheet',
      varietyId: 'variety-1',
      screenId: '17',
      status: 'synced',
      idempotencyKey: 'k1',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      retryCount: 0,
      localAppliedAt: '2026-04-24T00:00:01.000Z',
      payload: {
        kind: 'structure_sampling_step',
        taskCode: '17',
        logicalSheetKey: 'stem_length_sheet',
      },
    };

    const variety: VarietyRecord = {
      id: 'variety-1',
      title: 'Test',
      source: 'linked',
      binding: {
        spreadsheetId: 'sheet-1',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      },
      setup: {
        localWorkbook: {
          '17.Длина стебля': [['title'], ['headers'], ['1', '1', '10', '120']],
        },
        sheetAliases: {
          stem_length_sheet: '17.Длина стебля',
        },
      },
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      status: 'ready',
    };

    const task: InspectionTask = {
      code: '17',
      title: 'Длина стебля',
      kind: 'measurement',
      flowKind: 'structure_by_sampling',
      overviewCompleted: false,
      cardsCompleted: true,
      uiStatus: 'processed',
      cards: [],
      samplings: {
        '1': { samplingId: '1', plot: '1', cards: [], isComplete: true },
        '2': { samplingId: '2', plot: '2', cards: [], isComplete: true },
      },
      updatedAt: '2026-04-24T00:00:00.000Z',
    };

    await expect(
      processQueuedOperation(operation, {
        session: null,
        catalog: [variety],
        task,
      }),
    ).rejects.toMatchObject({ authRequired: true });

    await processQueuedOperation(operation, {
      session: { accessToken: 'token-1', email: 'tester@example.com' },
      catalog: [variety],
      task,
    });

    expect(sheetsService.writeOperations).toHaveBeenCalled();
  });

  it('uploads photos before writing Drive URLs to Google Sheets', async () => {
    const operation: QueuedOperation = {
      id: 'queue-photo',
      type: 'create_variety',
      varietyId: 'variety-1',
      status: 'synced',
      idempotencyKey: 'k-photo',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      retryCount: 0,
      localAppliedAt: '2026-04-24T00:00:01.000Z',
      payload: { title: 'Test' },
      media: [{ localUri: 'file:///plot.jpg', mimeType: 'image/jpeg', targetSheet: '1.remote-fusarium' }],
      writes: [
        {
          strategy: 'replace',
          sheet: SHEET_ALIASES.fusarium_sheet.local,
          range: `${SHEET_ALIASES.fusarium_sheet.local}!A1`,
          values: [['photo_pending_upload']],
        },
      ],
    };
    const variety: VarietyRecord = {
      id: 'variety-1',
      title: 'Test',
      source: 'created',
      binding: {
        spreadsheetId: 'sheet-1',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      },
      setup: {
        sheetAliases: {
          fusarium_sheet: '1.remote-fusarium',
        },
        drive: {
          varietyFolderId: 'folder-variety',
          foldersBySheet: {
            '1.remote-fusarium': { folderId: 'folder-fusarium' },
          },
        },
      },
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      status: 'ready',
    };

    await processQueuedOperation(operation, {
      session: { accessToken: 'token-1' },
      catalog: [variety],
    });

    expect(driveService.uploadPhoto).toHaveBeenCalledWith(
      'token-1',
      'file:///plot.jpg',
      expect.stringContaining('1.remote-fusarium'),
      'folder-fusarium',
    );
    expect(sheetsService.writeOperations).toHaveBeenCalledWith(
      'token-1',
      'sheet-1',
      expect.arrayContaining([
        expect.objectContaining({
          sheet: '1.remote-fusarium',
          range: '1.remote-fusarium!A1',
          values: [[expect.stringContaining('IMAGE(')]],
        }),
      ]),
    );
  });

  it('locks local task when Google sheet already has task data', async () => {
    (sheetsService.readSheet as jest.Mock).mockResolvedValueOnce([
      ['title'],
      ['headers'],
      ['confirmed', 'https://drive.google.com/photo.jpg'],
    ]);

    const variety: VarietyRecord = {
      id: 'variety-1',
      title: 'Test',
      source: 'linked',
      binding: {
        spreadsheetId: 'sheet-1',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      },
      setup: {
        sheetAliases: {
          start_flowering_sheet: '4.remote-start',
        },
      },
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      status: 'ready',
    };
    const task: InspectionTask = {
      code: '4',
      title: 'Start flowering',
      kind: 'observation',
      flowKind: 'phenology_by_plot',
      overviewCompleted: false,
      cardsCompleted: false,
      uiStatus: 'draft',
      cards: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    };

    const synced = await syncTaskReadState('token-1', variety, task);

    expect(sheetsService.readSheet).toHaveBeenCalledWith('token-1', 'sheet-1', '4.remote-start');
    expect(synced.uiStatus).toBe('locked_by_google');
    expect(synced.cloudStatus).toBe('locked_by_google');
  });
});
