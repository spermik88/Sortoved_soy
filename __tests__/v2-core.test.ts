import { taskDefinitionsByCode } from '../v2/src/config/flowRegistry';
import { findFirstEmptyRow, templateService } from '../v2/src/services/templateService';
import { formatPhotoMeta } from '../v2/src/utils/format';
import { isValidGoogleSheetsUrl } from '../v2/src/services/sheetsService';
import { VarietyCreationDraft } from '../v2/src/types/app';

describe('v2 core helpers', () => {
  const draft: VarietyCreationDraft = {
    varietyName: 'Сорт 1 тест',
    creationDate: '2026-04-21',
    sowingDate: '2026-04-22',
    latitude: 25.2048,
    longitude: 55.2708,
    mapsUrl: 'https://maps.google.com/?q=25.2048,55.2708',
    plots: {
      '1': {
        areaConfirmed: true,
        rowSpacing: '45 см',
        rowCount: '8 рядков',
        plantSpacingConfirmed: true,
        photoUri: 'file:///plot1.jpg',
      },
      '2': {
        areaConfirmed: true,
        rowSpacing: '15 см',
        rowCount: '4 рядка',
        plantSpacingConfirmed: true,
        photoUri: 'file:///plot2.jpg',
      },
      '3': {
        areaConfirmed: true,
        rowSpacing: '70 см',
        rowCount: '10 рядков',
        plantSpacingConfirmed: true,
        photoUri: 'file:///plot3.jpg',
      },
    },
  };

  it('validates Google Sheets urls', () => {
    expect(
      isValidGoogleSheetsUrl('https://docs.google.com/spreadsheets/d/abc123/edit#gid=0'),
    ).toBe(true);
    expect(isValidGoogleSheetsUrl('https://example.com/not-sheets')).toBe(false);
  });

  it('finds the next empty row', () => {
    expect(findFirstEmptyRow([['a'], ['b'], []])).toBe(2);
    expect(findFirstEmptyRow([['a'], ['b']])).toBe(2);
  });

  it('maps creation draft into workbook rows', () => {
    const workbook = templateService.createVarietyWorkbook(draft);
    expect(workbook['делянки'][1][1]).toBe('2026-04-21');
    expect(workbook['делянки'][1][7]).toBe('45 см');
    expect(workbook['делянки'][3][10]).toBe('file:///plot3.jpg');
  });

  it('builds photo metadata string', () => {
    const meta = formatPhotoMeta('sample@mail.com', 'https://maps.google.com/?q=1,2');
    expect(meta).toContain('sample@mail.com');
    expect(meta).toContain('https://maps.google.com/?q=1,2');
  });

  it('declares fusarium as infection split flow', () => {
    expect(taskDefinitionsByCode['1'].flowKind).toBe('infection_split');
    expect(taskDefinitionsByCode['17'].flowKind).toBe('measurement_cards');
  });
});
