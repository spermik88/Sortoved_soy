import { taskDefinitionsByCode } from '../v2/src/config/flowRegistry';
import { formatPhotoMeta } from '../v2/src/utils/format';
import { isValidGoogleSheetsUrl } from '../v2/src/services/sheetsService';
import {
  calculateYieldTonsPerHectare,
  calculateActualDifference,
  calculateAllowedDifference,
  buildDiseaseCellValue,
  findFirstDiseaseRow,
  recountDiseaseCards,
  resolveProteinToleranceStatus,
  resolveThousandSeedWeightOutcome,
  resolveChoiceBlockColumns,
  resolveDiseaseBlockColumns,
  resolvePhenologyBlockColumns,
  resolveScoreBlockColumns,
  resolveYieldBlockColumns,
  roundThousandSeedWeightByGost,
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

  it('writes phenology plots into a single fixed workbook row', () => {
    const workbook = templateService.createLocalWorkbookCopy();

    expect(resolvePhenologyBlockColumns('1')).toEqual({
      confirmation: 0,
      photo: 1,
      meta: 2,
    });
    expect(resolvePhenologyBlockColumns('2')).toEqual({
      confirmation: 4,
      photo: 5,
      meta: 6,
    });
    expect(resolvePhenologyBlockColumns('3')).toEqual({
      confirmation: 8,
      photo: 9,
      meta: 10,
    });

    const applied = templateService.applyPhenologyStepWrite(
      workbook,
      'start_flowering_sheet',
      {
        userEmail: 'sample@mail.com',
        plots: {
          '1': {
            plot: '1',
            confirmed: true,
            photoUri: 'file:///plot1.jpg',
            capturedAt: '2026-04-22T08:00:00.000Z',
            capturedLocation: {
              latitude: 1,
              longitude: 2,
              mapsUrl: 'https://maps.google.com/?q=1,2',
            },
            isComplete: true,
          },
          '2': {
            plot: '2',
            confirmed: true,
            photoUri: 'file:///plot2.jpg',
            capturedAt: '2026-04-22T08:05:00.000Z',
            capturedLocation: {
              latitude: 3,
              longitude: 4,
              mapsUrl: 'https://maps.google.com/?q=3,4',
            },
            isComplete: true,
          },
          '3': {
            plot: '3',
            confirmed: true,
            photoUri: 'file:///plot3.jpg',
            capturedAt: '2026-04-22T08:10:00.000Z',
            capturedLocation: {
              latitude: 5,
              longitude: 6,
              mapsUrl: 'https://maps.google.com/?q=5,6',
            },
            isComplete: true,
          },
        },
      },
    );

    expect(applied.sheetName).toBe('4.Начало цветения');
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook['4.Начало цветения'][2][0]).toBe('да');
    expect(applied.workbook['4.Начало цветения'][2][1]).toBe('photo_pending_upload');
    expect(applied.workbook['4.Начало цветения'][2][4]).toBe('да');
    expect(applied.workbook['4.Начало цветения'][2][5]).toBe('photo_pending_upload');
    expect(applied.workbook['4.Начало цветения'][2][8]).toBe('да');
    expect(applied.workbook['4.Начало цветения'][2][9]).toBe('photo_pending_upload');
    expect(applied.workbook['4.Начало цветения'][2][3]).toBe('');
    expect(applied.workbook['4.Начало цветения'][2][7]).toBe('');
    expect(String(applied.workbook['4.Начало цветения'][2][2])).toContain(
      'sample@mail.com',
    );
    expect(String(applied.workbook['4.Начало цветения'][2][6])).toContain(
      'https://maps.google.com/?q=3,4',
    );
    expect(String(applied.workbook['4.Начало цветения'][2][10])).toContain(
      '22.04.2026',
    );
  });

  it('writes choice plots into a single fixed workbook row', () => {
    const workbook = templateService.createLocalWorkbookCopy();

    expect(resolveChoiceBlockColumns('1')).toEqual({ value: 0, photo: 1, meta: 2 });
    expect(resolveChoiceBlockColumns('2')).toEqual({ value: 4, photo: 5, meta: 6 });
    expect(resolveChoiceBlockColumns('3')).toEqual({ value: 8, photo: 9, meta: 10 });

    const applied = templateService.applyChoiceStepWrite(workbook, 'flower_color_sheet', {
      userEmail: 'sample@mail.com',
      plots: {
        '1': {
          plot: '1',
          selectedValue: 'Белая',
          photoUri: 'file:///plot1.jpg',
          capturedAt: '2026-04-22T08:00:00.000Z',
          capturedLocation: {
            latitude: 1,
            longitude: 2,
            mapsUrl: 'https://maps.google.com/?q=1,2',
          },
          isComplete: true,
        },
        '2': {
          plot: '2',
          selectedValue: 'Фиолетовая',
          photoUri: 'file:///plot2.jpg',
          capturedAt: '2026-04-22T08:05:00.000Z',
          capturedLocation: {
            latitude: 3,
            longitude: 4,
            mapsUrl: 'https://maps.google.com/?q=3,4',
          },
          isComplete: true,
        },
        '3': {
          plot: '3',
          selectedValue: 'Белая',
          photoUri: 'file:///plot3.jpg',
          capturedAt: '2026-04-22T08:10:00.000Z',
          capturedLocation: {
            latitude: 5,
            longitude: 6,
            mapsUrl: 'https://maps.google.com/?q=5,6',
          },
          isComplete: true,
        },
      },
    });

    expect(applied.sheetName).toBe('10.Цветок: окраска');
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook['10.Цветок: окраска'][2][0]).toBe('Белая');
    expect(applied.workbook['10.Цветок: окраска'][2][1]).toBe('photo_pending_upload');
    expect(applied.workbook['10.Цветок: окраска'][2][4]).toBe('Фиолетовая');
    expect(applied.workbook['10.Цветок: окраска'][2][5]).toBe('photo_pending_upload');
    expect(applied.workbook['10.Цветок: окраска'][2][8]).toBe('Белая');
    expect(applied.workbook['10.Цветок: окраска'][2][9]).toBe('photo_pending_upload');
    expect(applied.workbook['10.Цветок: окраска'][2][3]).toBe('');
    expect(applied.workbook['10.Цветок: окраска'][2][7]).toBe('');
    expect(String(applied.workbook['10.Цветок: окраска'][2][2])).toContain(
      'sample@mail.com',
    );
  });

  it('writes score plots into a single fixed workbook row', () => {
    const workbook = templateService.createLocalWorkbookCopy();

    expect(resolveScoreBlockColumns('1')).toEqual({ value: 0, photo: 1, meta: 2 });
    expect(resolveScoreBlockColumns('2')).toEqual({ value: 4, photo: 5, meta: 6 });
    expect(resolveScoreBlockColumns('3')).toEqual({ value: 8, photo: 9, meta: 10 });

    const applied = templateService.applyScoreStepWrite(workbook, 'lodging_resistance_sheet', {
      userEmail: 'sample@mail.com',
      plots: {
        '1': {
          plot: '1',
          selectedScore: '1',
          photoUri: 'file:///plot1.jpg',
          capturedAt: '2026-04-22T08:00:00.000Z',
          capturedLocation: {
            latitude: 1,
            longitude: 2,
            mapsUrl: 'https://maps.google.com/?q=1,2',
          },
          isComplete: true,
        },
        '2': {
          plot: '2',
          selectedScore: '5',
          photoUri: 'file:///plot2.jpg',
          capturedAt: '2026-04-22T08:05:00.000Z',
          capturedLocation: {
            latitude: 3,
            longitude: 4,
            mapsUrl: 'https://maps.google.com/?q=3,4',
          },
          isComplete: true,
        },
        '3': {
          plot: '3',
          selectedScore: '9',
          photoUri: 'file:///plot3.jpg',
          capturedAt: '2026-04-22T08:10:00.000Z',
          capturedLocation: {
            latitude: 5,
            longitude: 6,
            mapsUrl: 'https://maps.google.com/?q=5,6',
          },
          isComplete: true,
        },
      },
    });

    expect(applied.sheetName).toBe('15.Устойчивость к полеганию');
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook['15.Устойчивость к полеганию'][2][0]).toBe('1');
    expect(applied.workbook['15.Устойчивость к полеганию'][2][1]).toBe(
      'photo_pending_upload',
    );
    expect(applied.workbook['15.Устойчивость к полеганию'][2][4]).toBe('5');
    expect(applied.workbook['15.Устойчивость к полеганию'][2][5]).toBe(
      'photo_pending_upload',
    );
    expect(applied.workbook['15.Устойчивость к полеганию'][2][8]).toBe('9');
    expect(applied.workbook['15.Устойчивость к полеганию'][2][9]).toBe(
      'photo_pending_upload',
    );
    expect(applied.workbook['15.Устойчивость к полеганию'][2][3]).toBe('');
    expect(applied.workbook['15.Устойчивость к полеганию'][2][7]).toBe('');
    expect(String(applied.workbook['15.Устойчивость к полеганию'][2][10])).toContain(
      '22.04.2026',
    );
  });

  it('writes structure sampling rows into append-only sheets', () => {
    const workbook = templateService.createLocalWorkbookCopy();
    const applied = templateService.appendStructureSamplingStepWrite(workbook, 'stem_length_sheet', {
      userEmail: 'sample@mail.com',
      samplings: {
        '1': {
          samplingId: '1',
          plot: '2',
          isComplete: true,
          cards: [
            {
              id: 'card-a',
              samplingId: '1',
              plantNumber: '3',
              value: '87',
              photoUri: 'file:///a.jpg',
              capturedAt: '2026-04-22T08:00:00.000Z',
              capturedLocation: {
                latitude: 1,
                longitude: 2,
                mapsUrl: 'https://maps.google.com/?q=1,2',
              },
              isComplete: true,
            },
          ],
        },
        '2': {
          samplingId: '2',
          plot: '3',
          isComplete: true,
          cards: [
            {
              id: 'card-b',
              samplingId: '2',
              plantNumber: '7',
              value: '92',
              photoUri: 'file:///b.jpg',
              capturedAt: '2026-04-22T08:05:00.000Z',
              capturedLocation: {
                latitude: 3,
                longitude: 4,
                mapsUrl: 'https://maps.google.com/?q=3,4',
              },
              isComplete: true,
            },
          ],
        },
      },
    });

    expect(applied.sheetName).toBe('17.Длина стебля');
    expect(applied.rowIndexStart).toBe(2);
    expect(applied.rowsWritten).toBe(2);
    expect(applied.workbook['17.Длина стебля'][2][0]).toBe('1');
    expect(applied.workbook['17.Длина стебля'][2][1]).toBe('2');
    expect(applied.workbook['17.Длина стебля'][2][2]).toBe('3');
    expect(applied.workbook['17.Длина стебля'][2][3]).toBe('87');
    expect(applied.workbook['17.Длина стебля'][2][4]).toBe('photo_pending_upload');
    expect(String(applied.workbook['17.Длина стебля'][2][5])).toContain('sample@mail.com');
    expect(applied.workbook['17.Длина стебля'][3][0]).toBe('2');
    expect(applied.workbook['17.Длина стебля'][3][1]).toBe('3');
    expect(applied.workbook['17.Длина стебля'][3][2]).toBe('7');
    expect(applied.workbook['17.Длина стебля'][3][3]).toBe('92');
    expect(applied.workbook['17.Длина стебля'][3][4]).toBe('photo_pending_upload');
  });

  it('calculates and writes yield plots into a fixed workbook row', () => {
    expect(calculateYieldTonsPerHectare(120, 18, 5)).toBe(
      Math.round((((120 * (100 - 18)) / (100 - 14)) / 5 / 10000) * 1000) / 1000,
    );
    expect(resolveYieldBlockColumns('1')).toEqual({ mass: 0, moisture: 1, area: 2, yield: 3, meta: 4 });
    expect(resolveYieldBlockColumns('2')).toEqual({ mass: 6, moisture: 7, area: 8, yield: 9, meta: 10 });
    expect(resolveYieldBlockColumns('3')).toEqual({ mass: 12, moisture: 13, area: 14, yield: 15, meta: 16 });

    const workbook = templateService.createLocalWorkbookCopy();
    const applied = templateService.applyYieldStepWrite(workbook, 'yield_per_area_sheet', {
      userEmail: 'sample@mail.com',
      plots: {
        '1': { plot: '1', rawGrainMassKg: '120', moisturePercent: '18', areaSquareMeters: 5, yieldTonsPerHectare: '0.023', isComplete: true },
        '2': { plot: '2', rawGrainMassKg: '110', moisturePercent: '16', areaSquareMeters: 5, yieldTonsPerHectare: '0.022', isComplete: true },
        '3': { plot: '3', rawGrainMassKg: '130', moisturePercent: '20', areaSquareMeters: 5, yieldTonsPerHectare: '0.024', isComplete: true },
      },
    });

    expect(applied.sheetName).toBe('26.Урожайность с единицы площади');
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook['26.Урожайность с единицы площади'][2][0]).toBe('120');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][1]).toBe('18');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][2]).toBe(5);
    expect(applied.workbook['26.Урожайность с единицы площади'][2][3]).toBe('0.023');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][6]).toBe('110');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][9]).toBe('0.022');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][12]).toBe('130');
    expect(applied.workbook['26.Урожайность с единицы площади'][2][15]).toBe('0.024');
    expect(String(applied.workbook['26.Урожайность с единицы площади'][2][4])).toContain('sample@mail.com');
  });

  it('resolves thousand seed weight outcomes by GOST method', () => {
    expect(calculateActualDifference(14.05, 13.68)).toBe(0.37);
    expect(calculateAllowedDifference(27.73)).toBe(0.42);
    expect(calculateAllowedDifference(253)).toBe(3.79);
    expect(roundThousandSeedWeightByGost(34.25)).toBe(34.2);
    expect(roundThousandSeedWeightByGost(34.35)).toBe(34.4);

    const valid = resolveThousandSeedWeightOutcome({
      sample1Weight: '13.68',
      sample2Weight: '14.05',
    });
    expect(valid.requiresThirdSample).toBe(false);
    expect(valid.selectedPair).toBe('1+2');
    expect(valid.finalWeight).toBe('27.7');

    const multiple = resolveThousandSeedWeightOutcome({
      sample1Weight: '10.00',
      sample2Weight: '10.45',
      sample3Weight: '10.20',
    });
    expect(multiple.requiresThirdSample).toBe(true);
    expect(multiple.candidatePairs.filter((pair) => pair.isAllowed)).toHaveLength(2);
    expect(multiple.selectedPair).toBeUndefined();

    const invalid = resolveThousandSeedWeightOutcome({
      sample1Weight: '10.00',
      sample2Weight: '11.00',
      sample3Weight: '12.00',
    });
    expect(invalid.analysisStatus).toBe('invalid');
    expect(invalid.finalWeight).toBe('');
  });

  it('writes thousand seed weight into a fixed workbook row', () => {
    const workbook = templateService.createLocalWorkbookCopy();
    const applied = templateService.applyThousandSeedWeightStepWrite(
      workbook,
      'thousand_seed_weight_sheet',
      {
        userEmail: 'sample@mail.com',
        completedAt: '2026-04-23T10:15:00.000Z',
        draft: {
          sample1Weight: '17.76',
          sample2Weight: '17.05',
          sample3Weight: '17.13',
          requiresThirdSample: true,
          candidatePairs: [],
          selectedPair: '2+3',
          sumWeight: '34.18',
          actualDifference: '0.08',
          allowedDifference: '0.51',
          finalWeight: '34.2',
          analysisStatus: 'valid',
          isComplete: true,
        },
      },
    );

    expect(applied.sheetName).toBe('27.Масса 1000 семян');
    expect(applied.workbook['27.Масса 1000 семян'][2][0]).toBe('средняя проба');
    expect(applied.workbook['27.Масса 1000 семян'][2][1]).toBe('17.76');
    expect(applied.workbook['27.Масса 1000 семян'][2][2]).toBe('17.05');
    expect(applied.workbook['27.Масса 1000 семян'][2][3]).toBe('17.13');
    expect(applied.workbook['27.Масса 1000 семян'][2][4]).toBe('2+3');
    expect(applied.workbook['27.Масса 1000 семян'][2][8]).toBe('34.2');
    expect(applied.workbook['27.Масса 1000 семян'][2][9]).toBe('valid');
    expect(String(applied.workbook['27.Масса 1000 семян'][2][10])).toContain('sample@mail.com');
  });

  it('resolves protein tolerance and writes protein content into a fixed workbook row', () => {
    expect(resolveProteinToleranceStatus('300')).toBe('valid');
    expect(resolveProteinToleranceStatus('299.9')).toBe('valid');
    expect(resolveProteinToleranceStatus('300.1')).toBe('valid');
    expect(resolveProteinToleranceStatus('299.8')).toBe('out_of_tolerance');

    const workbook = templateService.createLocalWorkbookCopy();
    const applied = templateService.applyProteinContentStepWrite(workbook, 'protein_content_sheet', {
      userEmail: 'sample@mail.com',
      completedAt: '2026-04-23T10:15:00.000Z',
      draft: {
        sampleSource: 'средняя проба',
        sampleMassGrams: '299.8',
        analysisMethod: 'Инфракрасный анализатор',
        proteinPercent: '38.6',
        sampleToleranceStatus: 'out_of_tolerance',
        isComplete: true,
      },
    });

    expect(applied.sheetName).toBe(taskDefinitionsByCode['28'].localSheetName);
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook[applied.sheetName][2][0]).toBe('средняя проба');
    expect(applied.workbook[applied.sheetName][2][1]).toBe('299.8');
    expect(applied.workbook[applied.sheetName][2][2]).toBe('Инфракрасный анализатор');
    expect(applied.workbook[applied.sheetName][2][3]).toBe('38.6');
    expect(applied.workbook[applied.sheetName][2][4]).toBe('out_of_tolerance');
    expect(String(applied.workbook[applied.sheetName][2][5])).toContain('sample@mail.com');
  });

  it('writes fat content into a fixed workbook row', () => {
    const workbook = templateService.createLocalWorkbookCopy();
    const applied = templateService.applyFatContentStepWrite(workbook, 'fat_content_sheet', {
      userEmail: 'sample@mail.com',
      completedAt: '2026-04-23T10:15:00.000Z',
      draft: {
        sampleSource: 'средняя проба',
        sampleMassGrams: '300.2',
        analysisMethod: 'Инфракрасный анализатор',
        fatPercent: '19.4',
        sampleToleranceStatus: 'out_of_tolerance',
        isComplete: true,
      },
    });

    expect(applied.sheetName).toBe(taskDefinitionsByCode['29'].localSheetName);
    expect(applied.rowIndex).toBe(2);
    expect(applied.workbook[applied.sheetName][2][0]).toBe('средняя проба');
    expect(applied.workbook[applied.sheetName][2][1]).toBe('300.2');
    expect(applied.workbook[applied.sheetName][2][2]).toBe('Инфракрасный анализатор');
    expect(applied.workbook[applied.sheetName][2][3]).toBe('19.4');
    expect(applied.workbook[applied.sheetName][2][4]).toBe('out_of_tolerance');
    expect(String(applied.workbook[applied.sheetName][2][5])).toContain('sample@mail.com');
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
    expect(taskDefinitionsByCode['4'].flowKind).toBe('phenology_by_plot');
    expect(taskDefinitionsByCode['5'].flowKind).toBe('phenology_by_plot');
    expect(taskDefinitionsByCode['10'].flowKind).toBe('choice_by_plot');
    expect(taskDefinitionsByCode['11'].flowKind).toBe('phenology_by_plot');
    expect(taskDefinitionsByCode['12'].flowKind).toBe('choice_by_plot');
    expect(taskDefinitionsByCode['13'].flowKind).toBe('phenology_by_plot');
    expect(taskDefinitionsByCode['14'].flowKind).toBe('choice_by_plot');
    expect(taskDefinitionsByCode['4'].logicalSheetKey).toBe('start_flowering_sheet');
    expect(taskDefinitionsByCode['10'].logicalSheetKey).toBe('flower_color_sheet');
    expect(taskDefinitionsByCode['12'].logicalSheetKey).toBe('leaf_shape_sheet');
    expect(taskDefinitionsByCode['13'].logicalSheetKey).toBe('full_maturity_sheet');
    expect(taskDefinitionsByCode['14'].logicalSheetKey).toBe(
      'stem_pubescence_color_sheet',
    );
    expect(taskDefinitionsByCode['15'].flowKind).toBe('score_by_plot');
    expect(taskDefinitionsByCode['16'].flowKind).toBe('score_by_plot');
    expect(taskDefinitionsByCode['26'].flowKind).toBe('yield_by_plot');
    expect(taskDefinitionsByCode['28'].flowKind).toBe('protein_content_step');
    expect(taskDefinitionsByCode['15'].logicalSheetKey).toBe('lodging_resistance_sheet');
    expect(taskDefinitionsByCode['16'].logicalSheetKey).toBe('shattering_resistance_sheet');
    expect(taskDefinitionsByCode['26'].logicalSheetKey).toBe('yield_per_area_sheet');
    expect(taskDefinitionsByCode['28'].logicalSheetKey).toBe('protein_content_sheet');
    expect(taskDefinitionsByCode['10'].hasCarouselSamples).toBe(false);
    expect(taskDefinitionsByCode['15'].hasCarouselSamples).toBe(false);
    expect(taskDefinitionsByCode['26'].carouselAssetKey).toBe('yield_per_area');
    expect(taskDefinitionsByCode['27'].flowKind).toBe('thousand_seed_weight_step');
    expect(taskDefinitionsByCode['27'].logicalSheetKey).toBe('thousand_seed_weight_sheet');
    expect(taskDefinitionsByCode['27'].carouselAssetKey).toBe('thousand_seed_weight');
    expect(taskDefinitionsByCode['28'].carouselAssetKey).toBe('protein_content');
    expect(taskDefinitionsByCode['29'].flowKind).toBe('fat_content_step');
    expect(taskDefinitionsByCode['29'].logicalSheetKey).toBe('fat_content_sheet');
    expect(taskDefinitionsByCode['29'].carouselAssetKey).toBe('oil_content');
    expect(taskDefinitionsByCode['17'].flowKind).toBe('structure_by_sampling');
    expect(taskDefinitionsByCode['25'].flowKind).toBe('structure_by_sampling');
    expect(taskDefinitionsByCode['17'].logicalSheetKey).toBe('stem_length_sheet');
    expect(taskDefinitionsByCode['25'].logicalSheetKey).toBe('seed_weight_per_plant_sheet');
    expect(taskDefinitionsByCode['17'].carouselAssetKey).toBe('stem_length');
    expect(taskDefinitionsByCode['25'].carouselAssetKey).toBe('seed_weight_per_plant');
  });
});
