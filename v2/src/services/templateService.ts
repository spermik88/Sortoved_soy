import {
  EMPTY_TRAIT_SHEETS,
  GENERIC_TRAIT_HEADERS,
  SHEET_ALIASES,
  TEMPLATE_SHEETS,
} from '../config/templateSchema';
import {
  DiseaseSheetKey,
  InspectionTask,
  SheetWriteOperation,
  VarietyCreationDraft,
  VarietyRecord,
} from '../types/app';
import { formatPhotoMeta } from '../utils/format';

type Workbook = Record<string, (string | number | boolean)[][]>;
type Plot = '1' | '2' | '3';

const DATA_START_ROW_INDEX = 2;
const PHOTO_PENDING_UPLOAD = 'photo_pending_upload';

export function findFirstEmptyRow(rows: (string | number | boolean)[][], minColumn = 0) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const hasValue = row
      .slice(minColumn)
      .some((value) => value !== '' && value !== undefined && value !== null);
    if (!hasValue) {
      return index;
    }
  }

  return rows.length;
}

export function buildDiseaseCellValue(rowNumber: string, plantNumber?: string) {
  const rowPart = `№ряда_${rowNumber.trim()}`;
  const plantPart = plantNumber?.trim() ? `, №растения_${plantNumber.trim()}` : '';
  return `${rowPart}${plantPart}`;
}

export function resolveDiseaseBlockColumns(plot: Plot) {
  if (plot === '1') {
    return { anchor: 0, photo: 1, meta: 2, count: 3, percent: 4 };
  }
  if (plot === '2') {
    return { anchor: 5, photo: 6, meta: 7, count: 8, percent: 9 };
  }
  return { anchor: 10, photo: 11, meta: 12, count: 13, percent: 14 };
}

export function findFirstDiseaseRow(sheet: (string | number | boolean)[][], plot: Plot) {
  const { anchor } = resolveDiseaseBlockColumns(plot);
  let rowIndex = DATA_START_ROW_INDEX;

  while (rowIndex < sheet.length) {
    const value = sheet[rowIndex]?.[anchor];
    if (value === '' || value === undefined || value === null) {
      return rowIndex;
    }
    rowIndex += 1;
  }

  return rowIndex;
}

export function recountDiseaseCards(sheet: (string | number | boolean)[][], plot: Plot) {
  const { anchor } = resolveDiseaseBlockColumns(plot);
  let count = 0;

  for (let rowIndex = DATA_START_ROW_INDEX; rowIndex < sheet.length; rowIndex += 1) {
    const value = sheet[rowIndex]?.[anchor];
    if (value !== '' && value !== undefined && value !== null) {
      count += 1;
    }
  }

  return count;
}

function cloneSheet(rows: (string | number)[][]) {
  return rows.map((row) => [...row]);
}

function ensureCell(sheet: (string | number | boolean)[][], rowIndex: number, columnIndex: number) {
  while (sheet.length <= rowIndex) {
    sheet.push([]);
  }
  while (sheet[rowIndex].length <= columnIndex) {
    sheet[rowIndex].push('');
  }
}

function buildTemplateWorkbook() {
  const workbook: Workbook = {};
  Object.entries(TEMPLATE_SHEETS).forEach(([name, rows]) => {
    workbook[name] = cloneSheet(rows);
  });
  EMPTY_TRAIT_SHEETS.forEach((name) => {
    workbook[name] = cloneSheet(GENERIC_TRAIT_HEADERS);
  });
  return workbook;
}

function setDeliankaValue(
  workbook: Workbook,
  header: string,
  plot: Plot,
  value: string | number | boolean,
) {
  const sheet = workbook['делянки'];
  const headerIndex = sheet[0].findIndex((item) => item === header);
  const rowIndex = sheet.findIndex((row) => row[0] === `делянка ${plot}`);
  if (headerIndex === -1 || rowIndex === -1) {
    return;
  }

  ensureCell(sheet, rowIndex, headerIndex);
  sheet[rowIndex][headerIndex] = value;
}

export interface DiseaseCardWriteInput {
  plot: Plot;
  rowNumber: string;
  plantNumber?: string;
  capturedAt?: string;
  mapsUrl?: string;
  userEmail?: string;
}

export interface DiseaseCardWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
  count: number;
}

export interface TemplateService {
  createVarietyWorkbook(draft: VarietyCreationDraft): Workbook;
  buildCreationWrites(draft: VarietyCreationDraft): SheetWriteOperation[];
  buildTaskWrites(
    variety: VarietyRecord,
    task: InspectionTask,
    mapsUrl?: string,
    userEmail?: string,
  ): SheetWriteOperation[];
  createLocalWorkbookCopy(draft?: VarietyCreationDraft): Workbook;
  applyDiseaseCardWrite(
    workbook: Workbook,
    logicalSheetKey: DiseaseSheetKey,
    input: DiseaseCardWriteInput,
  ): DiseaseCardWriteResult;
}

class WorkbookTemplateService implements TemplateService {
  createVarietyWorkbook(draft: VarietyCreationDraft) {
    const workbook = buildTemplateWorkbook();
    setDeliankaValue(workbook, 'дата создания', '1', draft.creationDate || '');
    setDeliankaValue(workbook, 'дата посева', '1', draft.sowingDate || '');

    (['1', '2', '3'] as const).forEach((plot) => {
      setDeliankaValue(workbook, 'ширина', plot, draft.latitude || '');
      setDeliankaValue(workbook, 'долгота', plot, draft.longitude || '');
      setDeliankaValue(workbook, 'ссылка гугл.мэпс', plot, draft.mapsUrl || '');
      setDeliankaValue(workbook, 'площадь делянки', plot, draft.plots[plot].areaConfirmed ? 'да' : '');
      setDeliankaValue(workbook, 'расстояние междурядья', plot, draft.plots[plot].rowSpacing || '');
      setDeliankaValue(workbook, 'количество рядков', plot, draft.plots[plot].rowCount || '');
      setDeliankaValue(
        workbook,
        'расстояние между растениями',
        plot,
        draft.plots[plot].plantSpacingConfirmed ? 'да' : '',
      );
      setDeliankaValue(
        workbook,
        'первое фото делянки',
        plot,
        draft.plots[plot].photoUri || '',
      );
    });

    return workbook;
  }

  createLocalWorkbookCopy(draft?: VarietyCreationDraft) {
    return draft ? this.createVarietyWorkbook(draft) : buildTemplateWorkbook();
  }

  buildCreationWrites(draft: VarietyCreationDraft) {
    const workbook = this.createVarietyWorkbook(draft);
    return Object.entries(workbook).map(([sheet, values]) => ({
      strategy: 'replace' as const,
      sheet,
      range: `${sheet}!A1`,
      values,
    }));
  }

  applyDiseaseCardWrite(
    workbook: Workbook,
    logicalSheetKey: DiseaseSheetKey,
    input: DiseaseCardWriteInput,
  ): DiseaseCardWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName] ? sheetClone(workbook[sheetName]) : cloneSheet(TEMPLATE_SHEETS[sheetName]);
    const { anchor, photo, meta, count, percent } = resolveDiseaseBlockColumns(input.plot);
    const rowIndex = findFirstDiseaseRow(sheet, input.plot);

    ensureCell(sheet, rowIndex, meta);
    sheet[rowIndex][anchor] = buildDiseaseCellValue(input.rowNumber, input.plantNumber);
    sheet[rowIndex][photo] = PHOTO_PENDING_UPLOAD;
    sheet[rowIndex][meta] = formatPhotoMeta(input.userEmail, input.mapsUrl, input.capturedAt);

    ensureCell(sheet, DATA_START_ROW_INDEX, count);
    ensureCell(sheet, DATA_START_ROW_INDEX, percent);
    const nextCount = recountDiseaseCards(sheet, input.plot);
    sheet[DATA_START_ROW_INDEX][count] = nextCount;
    if (sheet[DATA_START_ROW_INDEX][percent] === undefined) {
      sheet[DATA_START_ROW_INDEX][percent] = '';
    }

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex,
      count: nextCount,
    };
  }

  buildTaskWrites(variety: VarietyRecord, task: InspectionTask, mapsUrl?: string, userEmail?: string) {
    const rows = task.cards.map((card) => [
      card.note || task.title,
      card.photoUri || '',
      card.rowNumber || card.value || '',
      card.plot || '',
      card.plantNumber || '',
      formatPhotoMeta(userEmail, mapsUrl, card.capturedAt),
    ]);

    return [
      {
        strategy: 'append' as const,
        sheet: task.title,
        values: rows.length ? rows : [[task.title, task.overviewPhotoUri || '', mapsUrl || '', 'overview']],
      },
    ];
  }
}

function sheetClone(rows: (string | number | boolean)[][]) {
  return rows.map((row) => [...row]);
}

export const templateService: TemplateService = new WorkbookTemplateService();
