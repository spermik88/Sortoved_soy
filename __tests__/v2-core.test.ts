import { taskDefinitionsByCode } from '../v2/src/config/flowRegistry';
import { formatPhotoMeta } from '../v2/src/utils/format';
import { isValidGoogleSheetsUrl } from '../v2/src/services/sheetsService';
import {
  buildDiseaseCellValue,
  findFirstDiseaseRow,
  recountDiseaseCards,
  resolveDiseaseBlockColumns,
  templateService,
} from '../v2/src/services/templateService';
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

  it('maps creation draft into workbook rows', () => {
    const workbook = templateService.createVarietyWorkbook(draft);
    expect(workbook['делянки'][1][1]).toBe('2026-04-21');
    expect(workbook['делянки'][1][7]).toBe('45 см');
    expect(workbook['делянки'][3][10]).toBe('file:///plot3.jpg');
  });

  it('formats disease cell values', () => {
    expect(buildDiseaseCellValue('5')).toBe('№ряда_5');
    expect(buildDiseaseCellValue('5', '12')).toBe('№ряда_5, №растения_12');
  });

  it('resolves disease blocks and counts rows independently', () => {
    const workbook = templateService.createLocalWorkbookCopy();
    const sheet = workbook['Лист1'];

    expect(resolveDiseaseBlockColumns('1')).toEqual({
      anchor: 0,
      photo: 1,
      meta: 2,
      count: 3,
      percent: 4,
    });
    expect(findFirstDiseaseRow(sheet, '1')).toBe(2);
    expect(findFirstDiseaseRow(sheet, '2')).toBe(2);
    expect(findFirstDiseaseRow(sheet, '3')).toBe(2);

    sheet[2] = [];
    sheet[3] = [];
    sheet[4] = [];
    sheet[2][0] = '№ряда_1';
    sheet[4][5] = '№ряда_4';
    sheet[3][10] = '№ряда_7';

    expect(findFirstDiseaseRow(sheet, '1')).toBe(3);
    expect(findFirstDiseaseRow(sheet, '2')).toBe(2);
    expect(findFirstDiseaseRow(sheet, '3')).toBe(2);
    expect(recountDiseaseCards(sheet, '1')).toBe(1);
    expect(recountDiseaseCards(sheet, '2')).toBe(1);
    expect(recountDiseaseCards(sheet, '3')).toBe(1);
  });

  it('writes disease cards into the correct local workbook block', () => {
    const workbook = templateService.createLocalWorkbookCopy();
    const first = templateService.applyDiseaseCardWrite(workbook, 'fusarium_sheet', {
      plot: '1',
      rowNumber: '3',
      plantNumber: '12',
      capturedAt: '2026-04-22T12:34:00.000Z',
      mapsUrl: 'https://maps.google.com/?q=1,2',
      userEmail: 'sample@mail.com',
    });

    expect(first.sheetName).toBe('Лист1');
    expect(first.rowIndex).toBe(2);
    expect(first.workbook['Лист1'][2][0]).toBe('№ряда_3, №растения_12');
    expect(first.workbook['Лист1'][2][1]).toBe('photo_pending_upload');
    expect(first.workbook['Лист1'][2][3]).toBe(1);
    expect(first.workbook['Лист1'][2][4]).toBe('');

    const second = templateService.applyDiseaseCardWrite(first.workbook, 'fusarium_sheet', {
      plot: '2',
      rowNumber: '9',
      capturedAt: '2026-04-22T12:35:00.000Z',
      mapsUrl: 'https://maps.google.com/?q=3,4',
      userEmail: 'sample@mail.com',
    });

    expect(second.workbook['Лист1'][2][5]).toBe('№ряда_9');
    expect(second.workbook['Лист1'][2][6]).toBe('photo_pending_upload');
    expect(second.workbook['Лист1'][2][8]).toBe(1);
    expect(second.workbook['Лист1'][2][9]).toBe('');

    const third = templateService.applyDiseaseCardWrite(second.workbook, 'septoria_sheet', {
      plot: '3',
      rowNumber: '4',
      plantNumber: '2',
      capturedAt: '2026-04-22T12:36:00.000Z',
      mapsUrl: 'https://maps.google.com/?q=5,6',
      userEmail: 'sample@mail.com',
    });

    expect(third.sheetName).toBe('2.Септориоз');
    expect(third.workbook['2.Септориоз'][2][10]).toBe('№ряда_4, №растения_2');
    expect(third.workbook['2.Септориоз'][2][11]).toBe('photo_pending_upload');
    expect(third.workbook['2.Септориоз'][2][13]).toBe(1);
    expect(third.workbook['2.Септориоз'][2][14]).toBe('');
  });

  it('builds photo metadata string with supplied timestamp', () => {
    const meta = formatPhotoMeta(
      'sample@mail.com',
      'https://maps.google.com/?q=1,2',
      '2026-04-22T15:34:00.000Z',
    );
    expect(meta).toContain('22.04.2026');
    expect(meta).toContain(':34');
    expect(meta).toContain('sample@mail.com');
    expect(meta).toContain('https://maps.google.com/?q=1,2');
  });

  it('declares all disease steps as disease cards flow', () => {
    expect(taskDefinitionsByCode['1'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['2'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['3'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['6'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['7'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['8'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['9'].flowKind).toBe('disease_cards');
    expect(taskDefinitionsByCode['2'].logicalSheetKey).toBe('septoria_sheet');
    expect(taskDefinitionsByCode['9'].logicalSheetKey).toBe('aphid_damage_sheet');
    expect(taskDefinitionsByCode['17'].flowKind).toBe('measurement_cards');
  });
});
