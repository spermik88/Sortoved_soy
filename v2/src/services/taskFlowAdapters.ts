import { taskDefinitionsByCode } from '../config/flowRegistry';
import { SHEET_ALIASES } from '../config/templateSchema';
import { resolveSheetTitle } from './sheetAliasService';
import { QueuedOperation, SheetWriteOperation, InspectionTask, LocalSheetKey, VarietyRecord } from '../types/app';

type GoogleSheetRow = (string | number | boolean)[];

function hasAnyMeaningfulValue(cells: GoogleSheetRow, indexes: number[]) {
  return indexes.some((index) => {
    const value = cells[index];
    return value !== undefined && String(value).trim() !== '';
  });
}

function firstDataRow(values: GoogleSheetRow[] | undefined) {
  return values?.[1] || [];
}

export interface TaskFlowAdapter {
  logicalSheetKey: LocalSheetKey;
  isTaskCompletedInGoogle(values?: GoogleSheetRow[][] | GoogleSheetRow[]): boolean;
  buildGoogleWriteOperations(
    variety: VarietyRecord,
    task: InspectionTask,
    aliases?: Partial<Record<LocalSheetKey, string>>,
    operation?: QueuedOperation,
  ): SheetWriteOperation[];
  hydrateTaskFromGoogle?(task: InspectionTask, values?: GoogleSheetRow[][] | GoogleSheetRow[]): InspectionTask;
}

function normalizeValues(values?: GoogleSheetRow[][] | GoogleSheetRow[]) {
  if (!values) {
    return [];
  }
  if (values.length > 0 && Array.isArray(values[0])) {
    return values as GoogleSheetRow[];
  }
  return [values as unknown as GoogleSheetRow];
}

function buildFixedDataRowOperation(
  logicalSheetKey: LocalSheetKey,
  values: GoogleSheetRow[],
  aliases?: Partial<Record<LocalSheetKey, string>>,
): SheetWriteOperation[] {
  const sheet = resolveSheetTitle(logicalSheetKey, aliases);
  return [{ strategy: 'replace', sheet, range: `${sheet}!A2`, values }];
}

function buildAppendOperation(
  logicalSheetKey: LocalSheetKey,
  values: GoogleSheetRow[],
  aliases?: Partial<Record<LocalSheetKey, string>>,
): SheetWriteOperation[] {
  const sheet = resolveSheetTitle(logicalSheetKey, aliases);
  return values.length ? [{ strategy: 'append', sheet, range: `${sheet}!A2`, values }] : [];
}

function makeAdapter(
  logicalSheetKey: LocalSheetKey,
  completionColumns: number[],
): TaskFlowAdapter {
  return {
    logicalSheetKey,
    isTaskCompletedInGoogle(values) {
      return hasAnyMeaningfulValue(firstDataRow(normalizeValues(values)), completionColumns);
    },
    buildGoogleWriteOperations(variety, task, aliases, operation) {
      const workbook = variety.setup?.localWorkbook;
      const localSheet = SHEET_ALIASES[logicalSheetKey].local;
      const localValues = localSheet ? workbook?.[localSheet] : undefined;
      const payload = operation?.payload as Record<string, unknown> | undefined;

      if (payload?.kind === 'disease_card') {
        const cardId = String(payload.cardId || '');
        const rowNumber = task.cards.find((card) => card.id === cardId)?.localWorkbookRow;
        const row = rowNumber ? localValues?.[rowNumber - 1] : undefined;
        return buildAppendOperation(logicalSheetKey, row ? [row] : [], aliases);
      }

      if (payload?.kind === 'structure_sampling_step') {
        return buildAppendOperation(logicalSheetKey, (localValues || []).slice(1), aliases);
      }

      return buildFixedDataRowOperation(logicalSheetKey, localValues?.[1] ? [localValues[1]] : [], aliases);
    },
  };
}

const logicalKeys = Object.values(taskDefinitionsByCode)
  .map((task) => task.logicalSheetKey)
  .filter(Boolean) as LocalSheetKey[];

const defaultColumnMap: Partial<Record<LocalSheetKey, number[]>> = Object.fromEntries(
  logicalKeys.map((key) => [key, [0, 1, 2, 3, 4]]),
) as Partial<Record<LocalSheetKey, number[]>>;

defaultColumnMap.yield_per_area_sheet = [0, 1, 3];
defaultColumnMap.thousand_seed_weight_sheet = [8, 9];
defaultColumnMap.protein_content_sheet = [1, 3];
defaultColumnMap.fat_content_sheet = [1, 3];
defaultColumnMap.stem_length_sheet = [0, 1, 2, 3];
defaultColumnMap.lower_pod_attachment_sheet = [0, 1, 2, 3];
defaultColumnMap.productive_nodes_sheet = [0, 1, 2, 3];
defaultColumnMap.branch_count_sheet = [0, 1, 2, 3];
defaultColumnMap.productive_pods_sheet = [0, 1, 2, 3];
defaultColumnMap.pods_per_node_sheet = [0, 1, 2, 3];
defaultColumnMap.seeds_per_plant_sheet = [0, 1, 2, 3];
defaultColumnMap.seeds_per_pod_sheet = [0, 1, 2, 3];
defaultColumnMap.seed_weight_per_plant_sheet = [0, 1, 2, 3];

export const taskFlowAdapters = Object.fromEntries(
  logicalKeys.map((key) => [key, makeAdapter(key, defaultColumnMap[key] || [0])]),
) as Record<LocalSheetKey, TaskFlowAdapter>;

export function getTaskFlowAdapter(taskCode: string) {
  const taskDef = taskDefinitionsByCode[taskCode];
  if (!taskDef?.logicalSheetKey) {
    return null;
  }

  return taskFlowAdapters[taskDef.logicalSheetKey];
}
