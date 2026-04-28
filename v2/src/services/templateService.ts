import {
  EMPTY_TRAIT_SHEETS,
  GENERIC_TRAIT_HEADERS,
  META_SHEET_NAME,
  PHOTO_FOLDER_SHEET_NAMES,
  PLOTS_SHEET_NAME,
  SHEET_ALIASES,
  TEMPLATE_SHEETS,
  TEMPLATE_VERSION,
} from '../config/templateSchema';
import {
  ChoicePlotDraft,
  ChoiceSheetKey,
  CandidatePairResult,
  DiseaseSheetKey,
  FatContentDraft,
  FatContentSheetKey,
  InspectionTask,
  PhenologyPlotDraft,
  PhenologySheetKey,
  ProteinContentDraft,
  ProteinContentSheetKey,
  ScorePlotDraft,
  ScoreSheetKey,
  SeedWeightPair,
  SheetWriteOperation,
  StructurePlantCardDraft,
  StructureSamplingDraft,
  StructureSheetKey,
  ThousandSeedWeightDraft,
  ThousandSeedWeightSheetKey,
  YieldPlotDraft,
  YieldSheetKey,
  VarietyCreationDraft,
  VarietySetupSnapshot,
  VarietyRecord,
} from '../types/app';
import { formatPhotoMeta } from '../utils/format';

type Workbook = Record<string, (string | number | boolean)[][]>;
type Plot = '1' | '2' | '3';

const DATA_START_ROW_INDEX = 2;
const PHOTO_PENDING_UPLOAD = 'photo_pending_upload';
const THOUSAND_SEED_WEIGHT_TOLERANCE_TABLE = [
  [0, 0.02, 0.03, 0.04, 0.06, 0.08, 0.09, 0.1, 0.12, 0.14],
  [0.15, 0.16, 0.18, 0.2, 0.21, 0.22, 0.24, 0.26, 0.27, 0.28],
  [0.3, 0.32, 0.33, 0.34, 0.36, 0.38, 0.39, 0.4, 0.42, 0.44],
  [0.45, 0.46, 0.48, 0.5, 0.51, 0.52, 0.54, 0.56, 0.57, 0.58],
  [0.6, 0.62, 0.63, 0.64, 0.66, 0.68, 0.69, 0.7, 0.72, 0.74],
  [0.75, 0.76, 0.78, 0.79, 0.81, 0.82, 0.84, 0.85, 0.87, 0.88],
  [0.9, 0.92, 0.93, 0.94, 0.96, 0.98, 0.99, 1.0, 1.02, 1.04],
  [1.05, 1.06, 1.08, 1.1, 1.11, 1.12, 1.14, 1.16, 1.17, 1.18],
  [1.2, 1.22, 1.23, 1.24, 1.26, 1.28, 1.29, 1.3, 1.32, 1.34],
  [1.35, 1.37, 1.38, 1.4, 1.41, 1.42, 1.44, 1.45, 1.47, 1.48],
] as const;

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

export function resolvePhenologyBlockColumns(plot: Plot) {
  if (plot === '1') {
    return { confirmation: 0, photo: 1, meta: 2 };
  }
  if (plot === '2') {
    return { confirmation: 4, photo: 5, meta: 6 };
  }
  return { confirmation: 8, photo: 9, meta: 10 };
}

export function resolveChoiceBlockColumns(plot: Plot) {
  if (plot === '1') {
    return { value: 0, photo: 1, meta: 2 };
  }
  if (plot === '2') {
    return { value: 4, photo: 5, meta: 6 };
  }
  return { value: 8, photo: 9, meta: 10 };
}

export function resolveScoreBlockColumns(plot: Plot) {
  if (plot === '1') {
    return { value: 0, photo: 1, meta: 2 };
  }
  if (plot === '2') {
    return { value: 4, photo: 5, meta: 6 };
  }
  return { value: 8, photo: 9, meta: 10 };
}

export function resolveYieldBlockColumns(plot: Plot) {
  if (plot === '1') {
    return { mass: 0, moisture: 1, area: 2, yield: 3, meta: 4 };
  }
  if (plot === '2') {
    return { mass: 6, moisture: 7, area: 8, yield: 9, meta: 10 };
  }
  return { mass: 12, moisture: 13, area: 14, yield: 15, meta: 16 };
}

function roundHalfToEven(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;

  if (Math.abs(diff - 0.5) < Number.EPSILON * 10) {
    return (floor % 2 === 0 ? floor : floor + 1) / factor;
  }

  return Math.round(scaled) / factor;
}

function roundToThree(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function calculateYieldTonsPerHectare(
  rawGrainMassKg: number,
  moisturePercent: number,
  areaSquareMeters: number,
) {
  const normalizedMassKg =
    (rawGrainMassKg * (100 - moisturePercent)) / (100 - 14);
  return roundToThree(normalizedMassKg / areaSquareMeters / 10000);
}

export function calculateActualDifference(left: number, right: number) {
  return roundHalfToEven(Math.abs(left - right), 2);
}

export function calculateAllowedDifference(sumWeight: number) {
  const roundedSum = Math.round(sumWeight);
  const hundreds = Math.floor(roundedSum / 100);
  const remainder = roundedSum % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;
  const base = THOUSAND_SEED_WEIGHT_TOLERANCE_TABLE[tens]?.[units] ?? 0;

  if (!hundreds) {
    return roundHalfToEven(base, 2);
  }

  const hundredBase = (THOUSAND_SEED_WEIGHT_TOLERANCE_TABLE[hundreds]?.[0] ?? 0) * 10;
  return roundHalfToEven(base + hundredBase, 2);
}

export function roundThousandSeedWeightByGost(value: number) {
  return roundHalfToEven(value, value > 10 ? 1 : 2);
}

export function resolveProteinToleranceStatus(sampleMassGrams?: string) {
  const mass = Number(sampleMassGrams);
  if (!sampleMassGrams?.trim() || !Number.isFinite(mass) || mass <= 0) {
    return 'out_of_tolerance' as const;
  }

  return mass >= 299.9 && mass <= 300.1 ? ('valid' as const) : ('out_of_tolerance' as const);
}

function formatDecimal(value: number, fractionDigits: number) {
  return value.toFixed(fractionDigits);
}

function formatLabMeta(email: string | undefined, timestamp?: string) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const day = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${day}`;
  return `${stamp}, ${email || 'пользователь не указан'}`;
}

export function resolveThousandSeedWeightOutcome(
  samples: { sample1Weight?: string; sample2Weight?: string; sample3Weight?: string },
  selectedPair?: SeedWeightPair,
) {
  const parsed = {
    sample1Weight: Number(samples.sample1Weight),
    sample2Weight: Number(samples.sample2Weight),
    sample3Weight: Number(samples.sample3Weight),
  };
  const hasFirstTwo =
    samples.sample1Weight?.trim() &&
    samples.sample2Weight?.trim() &&
    Number.isFinite(parsed.sample1Weight) &&
    Number.isFinite(parsed.sample2Weight) &&
    parsed.sample1Weight > 0 &&
    parsed.sample2Weight > 0;

  if (!hasFirstTwo) {
    return {
      requiresThirdSample: false,
      candidatePairs: [] as CandidatePairResult[],
      selectedPair: undefined as SeedWeightPair | undefined,
      analysisStatus: 'valid' as const,
      sumWeight: '',
      actualDifference: '',
      allowedDifference: '',
      finalWeight: '',
      isComplete: false,
    };
  }

  const buildPair = (pair: SeedWeightPair, left: number, right: number): CandidatePairResult => {
    const sumWeight = roundHalfToEven(left + right, 2);
    const actualDifference = calculateActualDifference(left, right);
    const allowedDifference = calculateAllowedDifference(sumWeight);
    return {
      pair,
      sumWeight,
      actualDifference,
      allowedDifference,
      isAllowed: actualDifference <= allowedDifference,
      finalWeight: roundThousandSeedWeightByGost(sumWeight),
    };
  };

  const pair12 = buildPair('1+2', parsed.sample1Weight, parsed.sample2Weight);
  const hasThirdSample =
    samples.sample3Weight?.trim() &&
    Number.isFinite(parsed.sample3Weight) &&
    parsed.sample3Weight > 0;

  if (pair12.isAllowed) {
    return {
      requiresThirdSample: false,
      candidatePairs: [pair12],
      selectedPair: '1+2' as const,
      analysisStatus: 'valid' as const,
      sumWeight: formatDecimal(pair12.sumWeight, 2),
      actualDifference: formatDecimal(pair12.actualDifference, 2),
      allowedDifference: formatDecimal(pair12.allowedDifference, 2),
      finalWeight: formatDecimal(pair12.finalWeight, pair12.finalWeight > 10 ? 1 : 2),
      isComplete: true,
    };
  }

  if (!hasThirdSample) {
    return {
      requiresThirdSample: true,
      candidatePairs: [pair12],
      selectedPair: undefined,
      analysisStatus: 'valid' as const,
      sumWeight: formatDecimal(pair12.sumWeight, 2),
      actualDifference: formatDecimal(pair12.actualDifference, 2),
      allowedDifference: formatDecimal(pair12.allowedDifference, 2),
      finalWeight: '',
      isComplete: false,
    };
  }

  const pair13 = buildPair('1+3', parsed.sample1Weight, parsed.sample3Weight);
  const pair23 = buildPair('2+3', parsed.sample2Weight, parsed.sample3Weight);
  const candidatePairs = [pair12, pair13, pair23];
  const validPairs = candidatePairs.filter((pair) => pair.isAllowed);

  if (!validPairs.length) {
    return {
      requiresThirdSample: true,
      candidatePairs,
      selectedPair: undefined,
      analysisStatus: 'invalid' as const,
      sumWeight: '',
      actualDifference: '',
      allowedDifference: '',
      finalWeight: '',
      isComplete: true,
    };
  }

  const nextSelectedPair =
    validPairs.length === 1
      ? validPairs[0].pair
      : selectedPair && validPairs.some((pair) => pair.pair === selectedPair)
        ? selectedPair
        : undefined;
  const selectedResult = nextSelectedPair
    ? validPairs.find((pair) => pair.pair === nextSelectedPair)
    : undefined;

  return {
    requiresThirdSample: true,
    candidatePairs,
    selectedPair: nextSelectedPair,
    analysisStatus: 'valid' as const,
    sumWeight: selectedResult ? formatDecimal(selectedResult.sumWeight, 2) : '',
    actualDifference: selectedResult ? formatDecimal(selectedResult.actualDifference, 2) : '',
    allowedDifference: selectedResult ? formatDecimal(selectedResult.allowedDifference, 2) : '',
    finalWeight:
      selectedResult
        ? formatDecimal(selectedResult.finalWeight, selectedResult.finalWeight > 10 ? 1 : 2)
        : '',
    isComplete: Boolean(selectedResult),
  };
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

function sheetClone(rows: (string | number | boolean)[][]) {
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
  if (!workbook[SHEET_ALIASES.protein_content_sheet.local]) {
    workbook[SHEET_ALIASES.protein_content_sheet.local] = [
      ['28. РЎРѕРґРµСЂР¶Р°РЅРёРµ Р±РµР»РєР°', '', '', '', '', ''],
      ['РёСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹', 'РјР°СЃСЃР° РЅР°РІРµСЃРєРё, Рі', 'РјРµС‚РѕРґ Р°РЅР°Р»РёР·Р°', 'СЃРѕРґРµСЂР¶Р°РЅРёРµ Р±РµР»РєР°, %', 'СЃС‚Р°С‚СѓСЃ РЅР°РІРµСЃРєРё', 'РјРµС‚Р°'],
    ];
  }
  if (!workbook[SHEET_ALIASES.fat_content_sheet.local]) {
    workbook[SHEET_ALIASES.fat_content_sheet.local] = [
      ['29. РЎРѕРґРµСЂР¶Р°РЅРёРµ Р¶РёСЂР°', '', '', '', '', ''],
      ['РёСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹', 'РјР°СЃСЃР° РЅР°РІРµСЃРєРё, Рі', 'РјРµС‚РѕРґ Р°РЅР°Р»РёР·Р°', 'СЃРѕРґРµСЂР¶Р°РЅРёРµ Р¶РёСЂР°, %', 'СЃС‚Р°С‚СѓСЃ РЅР°РІРµСЃРєРё', 'РјРµС‚Р°'],
    ];
  }
  EMPTY_TRAIT_SHEETS.forEach((name) => {
    if (!workbook[name]) {
      workbook[name] = cloneSheet(GENERIC_TRAIT_HEADERS);
    }
  });
  return workbook;
}

export function buildMetaSheetRows(setup: VarietySetupSnapshot) {
  const drive = setup.drive || {};
  return [
    ['key', 'value'],
    ['templateVersion', TEMPLATE_VERSION],
    ['creatorEmail', drive.creatorEmail || ''],
    ['rootFolderId', drive.rootFolderId || ''],
    ['rootFolderUrl', drive.rootFolderUrl || ''],
    ['varietyFolderId', drive.varietyFolderId || ''],
    ['varietyFolderUrl', drive.varietyFolderUrl || ''],
    [],
    ['sheetName', 'folderId', 'folderUrl'],
    ...PHOTO_FOLDER_SHEET_NAMES.map((sheetName) => [
      sheetName,
      drive.foldersBySheet?.[sheetName]?.folderId || '',
      drive.foldersBySheet?.[sheetName]?.folderUrl || '',
    ]),
  ];
}

export function parseMetaSheetRows(rows: (string | number | boolean)[][]): VarietySetupSnapshot['drive'] {
  const drive: NonNullable<VarietySetupSnapshot['drive']> = { foldersBySheet: {} };
  rows.slice(1, 7).forEach((row) => {
    const key = String(row[0] || '');
    const value = String(row[1] || '');
    if (key === 'creatorEmail') drive.creatorEmail = value;
    if (key === 'rootFolderId') drive.rootFolderId = value;
    if (key === 'rootFolderUrl') drive.rootFolderUrl = value;
    if (key === 'varietyFolderId') drive.varietyFolderId = value;
    if (key === 'varietyFolderUrl') drive.varietyFolderUrl = value;
  });
  rows.slice(9).forEach((row) => {
    const sheetName = String(row[0] || '');
    const folderId = String(row[1] || '');
    const folderUrl = String(row[2] || '');
    if (sheetName && folderId) {
      drive.foldersBySheet![sheetName] = { folderId, folderUrl };
    }
  });
  return drive;
}

function setDeliankaValue(
  workbook: Workbook,
  header: string,
  plot: Plot,
  value: string | number | boolean,
) {
  const sheet = workbook[PLOTS_SHEET_NAME];
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

export interface PhenologyStepWriteInput {
  plots: Record<'1' | '2' | '3', PhenologyPlotDraft>;
  userEmail?: string;
}

export interface PhenologyStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface ChoiceStepWriteInput {
  plots: Record<'1' | '2' | '3', ChoicePlotDraft>;
  userEmail?: string;
}

export interface ChoiceStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface ScoreStepWriteInput {
  plots: Record<'1' | '2' | '3', ScorePlotDraft>;
  userEmail?: string;
}

export interface ScoreStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface StructureSamplingStepWriteInput {
  samplings: Record<'1' | '2', StructureSamplingDraft>;
  userEmail?: string;
}

export interface StructureSamplingStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndexStart: number;
  rowsWritten: number;
}

export interface YieldStepWriteInput {
  plots: Record<'1' | '2' | '3', YieldPlotDraft>;
  userEmail?: string;
}

export interface YieldStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface ThousandSeedWeightStepWriteInput {
  draft: ThousandSeedWeightDraft;
  userEmail?: string;
  completedAt?: string;
}

export interface ThousandSeedWeightStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface ProteinContentStepWriteInput {
  draft: ProteinContentDraft;
  userEmail?: string;
  completedAt?: string;
}

export interface ProteinContentStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface FatContentStepWriteInput {
  draft: FatContentDraft;
  userEmail?: string;
  completedAt?: string;
}

export interface FatContentStepWriteResult {
  workbook: Workbook;
  sheetName: string;
  rowIndex: number;
}

export interface TemplateService {
  createVarietyWorkbook(draft: VarietyCreationDraft): Workbook;
  buildCreationWrites(draft: VarietyCreationDraft): SheetWriteOperation[];
  buildMetaWrite(setup: VarietySetupSnapshot): SheetWriteOperation;
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
  applyPhenologyStepWrite(
    workbook: Workbook,
    logicalSheetKey: PhenologySheetKey,
    input: PhenologyStepWriteInput,
  ): PhenologyStepWriteResult;
  applyChoiceStepWrite(
    workbook: Workbook,
    logicalSheetKey: ChoiceSheetKey,
    input: ChoiceStepWriteInput,
  ): ChoiceStepWriteResult;
  applyScoreStepWrite(
    workbook: Workbook,
    logicalSheetKey: ScoreSheetKey,
    input: ScoreStepWriteInput,
  ): ScoreStepWriteResult;
  applyYieldStepWrite(
    workbook: Workbook,
    logicalSheetKey: YieldSheetKey,
    input: YieldStepWriteInput,
  ): YieldStepWriteResult;
  applyThousandSeedWeightStepWrite(
    workbook: Workbook,
    logicalSheetKey: ThousandSeedWeightSheetKey,
    input: ThousandSeedWeightStepWriteInput,
  ): ThousandSeedWeightStepWriteResult;
  applyProteinContentStepWrite(
    workbook: Workbook,
    logicalSheetKey: ProteinContentSheetKey,
    input: ProteinContentStepWriteInput,
  ): ProteinContentStepWriteResult;
  applyFatContentStepWrite(
    workbook: Workbook,
    logicalSheetKey: FatContentSheetKey,
    input: FatContentStepWriteInput,
  ): FatContentStepWriteResult;
  appendStructureSamplingStepWrite(
    workbook: Workbook,
    logicalSheetKey: StructureSheetKey,
    input: StructureSamplingStepWriteInput,
  ): StructureSamplingStepWriteResult;
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
        draft.plots[plot].photoUri ? PHOTO_PENDING_UPLOAD : '',
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

  buildMetaWrite(setup: VarietySetupSnapshot) {
    return {
      strategy: 'replace' as const,
      sheet: META_SHEET_NAME,
      range: `${META_SHEET_NAME}!A1`,
      values: buildMetaSheetRows(setup),
    };
  }

  applyDiseaseCardWrite(
    workbook: Workbook,
    logicalSheetKey: DiseaseSheetKey,
    input: DiseaseCardWriteInput,
  ): DiseaseCardWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);
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

  applyPhenologyStepWrite(
    workbook: Workbook,
    logicalSheetKey: PhenologySheetKey,
    input: PhenologyStepWriteInput,
  ): PhenologyStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    (['1', '2', '3'] as const).forEach((plot) => {
      const plotState = input.plots[plot];
      const { confirmation, photo, meta } = resolvePhenologyBlockColumns(plot);
      ensureCell(sheet, DATA_START_ROW_INDEX, meta);
      sheet[DATA_START_ROW_INDEX][confirmation] = plotState.confirmed ? 'да' : '';
      sheet[DATA_START_ROW_INDEX][photo] = plotState.photoUri ? PHOTO_PENDING_UPLOAD : '';
      sheet[DATA_START_ROW_INDEX][meta] = formatPhotoMeta(
        input.userEmail,
        plotState.capturedLocation?.mapsUrl,
        plotState.capturedAt,
      );
    });

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyChoiceStepWrite(
    workbook: Workbook,
    logicalSheetKey: ChoiceSheetKey,
    input: ChoiceStepWriteInput,
  ): ChoiceStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    (['1', '2', '3'] as const).forEach((plot) => {
      const plotState = input.plots[plot];
      const { value, photo, meta } = resolveChoiceBlockColumns(plot);
      ensureCell(sheet, DATA_START_ROW_INDEX, meta);
      sheet[DATA_START_ROW_INDEX][value] = plotState.selectedValue || '';
      sheet[DATA_START_ROW_INDEX][photo] = plotState.photoUri ? PHOTO_PENDING_UPLOAD : '';
      sheet[DATA_START_ROW_INDEX][meta] = formatPhotoMeta(
        input.userEmail,
        plotState.capturedLocation?.mapsUrl,
        plotState.capturedAt,
      );
    });

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyScoreStepWrite(
    workbook: Workbook,
    logicalSheetKey: ScoreSheetKey,
    input: ScoreStepWriteInput,
  ): ScoreStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    (['1', '2', '3'] as const).forEach((plot) => {
      const plotState = input.plots[plot];
      const { value, photo, meta } = resolveScoreBlockColumns(plot);
      ensureCell(sheet, DATA_START_ROW_INDEX, meta);
      sheet[DATA_START_ROW_INDEX][value] = plotState.selectedScore || '';
      sheet[DATA_START_ROW_INDEX][photo] = plotState.photoUri ? PHOTO_PENDING_UPLOAD : '';
      sheet[DATA_START_ROW_INDEX][meta] = formatPhotoMeta(
        input.userEmail,
        plotState.capturedLocation?.mapsUrl,
        plotState.capturedAt,
      );
    });

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyYieldStepWrite(
    workbook: Workbook,
    logicalSheetKey: YieldSheetKey,
    input: YieldStepWriteInput,
  ): YieldStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    (['1', '2', '3'] as const).forEach((plot) => {
      const plotState = input.plots[plot];
      const { mass, moisture, area, yield: yieldColumn, meta } = resolveYieldBlockColumns(plot);
      ensureCell(sheet, DATA_START_ROW_INDEX, meta);
      sheet[DATA_START_ROW_INDEX][mass] = plotState.rawGrainMassKg || '';
      sheet[DATA_START_ROW_INDEX][moisture] = plotState.moisturePercent || '';
      sheet[DATA_START_ROW_INDEX][area] = plotState.areaSquareMeters;
      sheet[DATA_START_ROW_INDEX][yieldColumn] = plotState.yieldTonsPerHectare || '';
      sheet[DATA_START_ROW_INDEX][meta] = formatPhotoMeta(input.userEmail, undefined, undefined);
    });

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyThousandSeedWeightStepWrite(
    workbook: Workbook,
    logicalSheetKey: ThousandSeedWeightSheetKey,
    input: ThousandSeedWeightStepWriteInput,
  ): ThousandSeedWeightStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    ensureCell(sheet, DATA_START_ROW_INDEX, 10);
    sheet[DATA_START_ROW_INDEX][0] = 'средняя проба';
    sheet[DATA_START_ROW_INDEX][1] = input.draft.sample1Weight || '';
    sheet[DATA_START_ROW_INDEX][2] = input.draft.sample2Weight || '';
    sheet[DATA_START_ROW_INDEX][3] = input.draft.sample3Weight || '';
    sheet[DATA_START_ROW_INDEX][4] = input.draft.selectedPair || '';
    sheet[DATA_START_ROW_INDEX][5] = input.draft.sumWeight || '';
    sheet[DATA_START_ROW_INDEX][6] = input.draft.actualDifference || '';
    sheet[DATA_START_ROW_INDEX][7] = input.draft.allowedDifference || '';
    sheet[DATA_START_ROW_INDEX][8] =
      input.draft.analysisStatus === 'valid' ? input.draft.finalWeight || '' : '';
    sheet[DATA_START_ROW_INDEX][9] = input.draft.analysisStatus;
    sheet[DATA_START_ROW_INDEX][10] = formatLabMeta(input.userEmail, input.completedAt);

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyProteinContentStepWrite(
    workbook: Workbook,
    logicalSheetKey: ProteinContentSheetKey,
    input: ProteinContentStepWriteInput,
  ): ProteinContentStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : [
          ['28. РЎРѕРґРµСЂР¶Р°РЅРёРµ Р±РµР»РєР°', '', '', '', '', ''],
          ['РёСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹', 'РјР°СЃСЃР° РЅР°РІРµСЃРєРё, Рі', 'РјРµС‚РѕРґ Р°РЅР°Р»РёР·Р°', 'СЃРѕРґРµСЂР¶Р°РЅРёРµ Р±РµР»РєР°, %', 'СЃС‚Р°С‚СѓСЃ РЅР°РІРµСЃРєРё', 'РјРµС‚Р°'],
        ];

    ensureCell(sheet, DATA_START_ROW_INDEX, 5);
    sheet[DATA_START_ROW_INDEX][0] = input.draft.sampleSource;
    sheet[DATA_START_ROW_INDEX][1] = input.draft.sampleMassGrams || '';
    sheet[DATA_START_ROW_INDEX][2] = input.draft.analysisMethod;
    sheet[DATA_START_ROW_INDEX][3] = input.draft.proteinPercent || '';
    sheet[DATA_START_ROW_INDEX][4] = input.draft.sampleToleranceStatus;
    sheet[DATA_START_ROW_INDEX][5] = formatLabMeta(input.userEmail, input.completedAt);

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  applyFatContentStepWrite(
    workbook: Workbook,
    logicalSheetKey: FatContentSheetKey,
    input: FatContentStepWriteInput,
  ): FatContentStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : [
          ['29. РЎРѕРґРµСЂР¶Р°РЅРёРµ Р¶РёСЂР°', '', '', '', '', ''],
          [
            'РёСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹',
            'РјР°СЃСЃР° РЅР°РІРµСЃРєРё, Рі',
            'РјРµС‚РѕРґ Р°РЅР°Р»РёР·Р°',
            'СЃРѕРґРµСЂР¶Р°РЅРёРµ Р¶РёСЂР°, %',
            'СЃС‚Р°С‚СѓСЃ РЅР°РІРµСЃРєРё',
            'РјРµС‚Р°',
          ],
        ];

    ensureCell(sheet, DATA_START_ROW_INDEX, 5);
    sheet[DATA_START_ROW_INDEX][0] = input.draft.sampleSource;
    sheet[DATA_START_ROW_INDEX][1] = input.draft.sampleMassGrams || '';
    sheet[DATA_START_ROW_INDEX][2] = input.draft.analysisMethod;
    sheet[DATA_START_ROW_INDEX][3] = input.draft.fatPercent || '';
    sheet[DATA_START_ROW_INDEX][4] = input.draft.sampleToleranceStatus;
    sheet[DATA_START_ROW_INDEX][5] = formatLabMeta(input.userEmail, input.completedAt);

    workbook[sheetName] = sheet;

    return {
      workbook,
      sheetName,
      rowIndex: DATA_START_ROW_INDEX,
    };
  }

  appendStructureSamplingStepWrite(
    workbook: Workbook,
    logicalSheetKey: StructureSheetKey,
    input: StructureSamplingStepWriteInput,
  ): StructureSamplingStepWriteResult {
    const sheetName = SHEET_ALIASES[logicalSheetKey].local;
    const sheet = workbook[sheetName]
      ? sheetClone(workbook[sheetName])
      : cloneSheet(TEMPLATE_SHEETS[sheetName]);

    let rowIndex = Math.max(DATA_START_ROW_INDEX, findFirstEmptyRow(sheet, 0));
    const rowIndexStart = rowIndex;
    let rowsWritten = 0;

    (['1', '2'] as const).forEach((samplingId) => {
      const sampling = input.samplings[samplingId];
      const plot = sampling?.plot || '';
      (sampling?.cards || []).forEach((card: StructurePlantCardDraft) => {
        ensureCell(sheet, rowIndex, 5);
        sheet[rowIndex][0] = samplingId;
        sheet[rowIndex][1] = plot;
        sheet[rowIndex][2] = card.plantNumber || '';
        sheet[rowIndex][3] = card.value || '';
        sheet[rowIndex][4] = card.photoUri ? PHOTO_PENDING_UPLOAD : '';
        sheet[rowIndex][5] = formatPhotoMeta(
          input.userEmail,
          card.capturedLocation?.mapsUrl,
          card.capturedAt,
        );
        rowIndex += 1;
        rowsWritten += 1;
      });
    });

    workbook[sheetName] = sheet;
    return {
      workbook,
      sheetName,
      rowIndexStart,
      rowsWritten,
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

export const templateService: TemplateService = new WorkbookTemplateService();
