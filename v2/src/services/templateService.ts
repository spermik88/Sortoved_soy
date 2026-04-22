import { EMPTY_TRAIT_SHEETS, GENERIC_TRAIT_HEADERS, TEMPLATE_SHEETS } from '../config/templateSchema';
import { InspectionTask, SheetWriteOperation, VarietyCreationDraft, VarietyRecord } from '../types/app';
import { formatPhotoMeta } from '../utils/format';

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

function cloneSheet(rows: (string | number)[][]) {
  return rows.map((row) => [...row]);
}

function buildTemplateWorkbook() {
  const workbook: Record<string, (string | number | boolean)[][]> = {};
  Object.entries(TEMPLATE_SHEETS).forEach(([name, rows]) => {
    workbook[name] = cloneSheet(rows);
  });
  EMPTY_TRAIT_SHEETS.forEach((name) => {
    workbook[name] = cloneSheet(GENERIC_TRAIT_HEADERS);
  });
  return workbook;
}

function setDeliankaValue(
  workbook: Record<string, (string | number | boolean)[][]>,
  header: string,
  plot: '1' | '2' | '3',
  value: string | number | boolean,
) {
  const sheet = workbook['делянки'];
  const headerIndex = sheet[0].findIndex((item) => item === header);
  const rowIndex = sheet.findIndex((row) => row[0] === `делянка ${plot}`);
  if (headerIndex === -1 || rowIndex === -1) {
    return;
  }

  while (sheet[rowIndex].length <= headerIndex) {
    sheet[rowIndex].push('');
  }

  sheet[rowIndex][headerIndex] = value;
}

export interface TemplateService {
  createVarietyWorkbook(draft: VarietyCreationDraft): Record<string, (string | number | boolean)[][]>;
  buildCreationWrites(draft: VarietyCreationDraft): SheetWriteOperation[];
  buildTaskWrites(
    variety: VarietyRecord,
    task: InspectionTask,
    mapsUrl?: string,
    userEmail?: string,
  ): SheetWriteOperation[];
}

class WorkbookTemplateService implements TemplateService {
  createVarietyWorkbook(draft: VarietyCreationDraft) {
    const workbook = buildTemplateWorkbook();
    setDeliankaValue(workbook, 'дата создания', '1', draft.creationDate || '');
    setDeliankaValue(workbook, 'дата посева', '1', draft.sowingDate || '');

    (['1', '2', '3'] as const).forEach((plot) => {
      setDeliankaValue(workbook, 'ширина', plot, draft.latitude || '');
      setDeliankaValue(workbook, 'долгота', plot, draft.longitude || '');
      setDeliankaValue(workbook, 'ссылка гугл.мапс', plot, draft.mapsUrl || '');
      setDeliankaValue(
        workbook,
        'площадь делянки',
        plot,
        draft.plots[plot].areaConfirmed ? 'да' : '',
      );
      setDeliankaValue(
        workbook,
        'расстояние междурядья',
        plot,
        draft.plots[plot].rowSpacing || '',
      );
      setDeliankaValue(
        workbook,
        'количество рядков',
        plot,
        draft.plots[plot].rowCount || '',
      );
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

  buildCreationWrites(draft: VarietyCreationDraft) {
    const workbook = this.createVarietyWorkbook(draft);
    return Object.entries(workbook).map(([sheet, values]) => ({
      strategy: 'replace' as const,
      sheet,
      range: `${sheet}!A1`,
      values,
    }));
  }

  buildTaskWrites(variety: VarietyRecord, task: InspectionTask, mapsUrl?: string, userEmail?: string) {
    const rows = task.cards.map((card) => [
      card.note || task.title,
      card.photoUri || '',
      card.rowNumber || card.value || '',
      card.plot || '',
      card.plantNumber || '',
      card.note || '',
    ]);
    const metaRows = task.cards
      .filter((card) => card.photoUri)
      .map((card) => [
        card.photoUri || '',
        formatPhotoMeta(userEmail, mapsUrl),
        card.plot || '',
      ]);

    const writes: SheetWriteOperation[] = [
      {
        strategy: 'append',
        sheet: task.title.startsWith('Фузариоз')
          ? '1.Фузариоз'
          : task.title.includes('Септориоз')
            ? '2.Септориоз'
            : task.title,
        values: rows.length
          ? rows
          : [[task.title, task.overviewPhotoUri || '', mapsUrl || '', 'overview']],
      },
    ];

    if (task.code === '1' && metaRows.length) {
      writes.push({
        strategy: 'append',
        sheet: '1.1мета',
        values: metaRows,
      });
    }

    return writes;
  }
}

export const templateService: TemplateService = new WorkbookTemplateService();
