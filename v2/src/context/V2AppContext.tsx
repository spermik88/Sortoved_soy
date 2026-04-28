import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { v2Copy } from '../config/copy';
import { creationSteps, taskDefinitionsByCode } from '../config/flowRegistry';
import {
  PHOTO_FOLDER_SHEET_NAMES,
  PLOTS_SHEET_NAME,
  SHEET_ALIASES,
  TEMPLATE_WORKSHEET_NAMES,
} from '../config/templateSchema';
import { v2Repository } from '../repositories/v2Repository';
import { authService, assertGoogleSessionUsable, isGoogleSessionUsable } from '../services/authService';
import { clipboardService } from '../services/clipboardService';
import { driveService } from '../services/driveService';
import { syncTaskReadState } from '../services/googleSyncService';
import { locationService } from '../services/locationService';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { isValidGoogleSheetsUrl, sheetsService } from '../services/sheetsService';
import { processQueuedOperation } from '../services/syncQueueService';
import {
  calculateYieldTonsPerHectare,
  parseMetaSheetRows,
  resolveProteinToleranceStatus,
  resolveThousandSeedWeightOutcome,
  templateService,
} from '../services/templateService';
import {
  AuthMode,
  CandidatePairResult,
  ChoicePlotDraft,
  ChoiceSheetKey,
  DiseaseSheetKey,
  FatContentDraft,
  FatContentSheetKey,
  GoogleSession,
  InspectionCardDraft,
  InspectionTask,
  LocalSheetKey,
  PhenologyPlotDraft,
  PhenologySheetKey,
  ProteinContentDraft,
  ProteinContentSheetKey,
  PersistedV2State,
  QueuedOperation,
  ScorePlotDraft,
  ScoreSheetKey,
  SeedWeightPair,
  StructurePlantCardDraft,
  StructureSamplingDraft,
  StructureSheetKey,
  TaskUiStatus,
  ThousandSeedWeightDraft,
  ThousandSeedWeightSheetKey,
  YieldPlotDraft,
  YieldSheetKey,
  VarietyCreationDraft,
  VarietyRecord,
  VarietySetupSnapshot,
} from '../types/app';
import { normalizeTitle, todayIsoDate } from '../utils/format';
import { createId } from '../utils/id';

const initialCreationDraft = (): VarietyCreationDraft => ({
  varietyName: '',
  creationDate: todayIsoDate(),
  sowingDate: todayIsoDate(),
  plots: {
    '1': { areaConfirmed: false, plantSpacingConfirmed: false },
    '2': { areaConfirmed: false, plantSpacingConfirmed: false },
    '3': { areaConfirmed: false, plantSpacingConfirmed: false },
  },
});

const initialState: PersistedV2State = {
  session: null,
  pendingAuthMode: null,
  catalog: [],
  creationDraft: null,
  inspections: {},
  syncQueue: [],
};
const LOCAL_PHOTO_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function buildLocalBinding(
  varietyId: string,
  title: string,
  source: 'created' | 'linked',
  rawUrl?: string,
) {
  return {
    spreadsheetId: `${source}-${varietyId}`,
    spreadsheetUrl: rawUrl || `local://sortoved-v2/${encodeURIComponent(title)}`,
  };
}

function buildImportedVarietyTitle(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const gid = parsed.searchParams.get('gid');
    return gid ? `${v2Copy.importedVarietyPrefix} ${gid}` : v2Copy.importedVarietyFallback;
  } catch {
    return v2Copy.importedVarietyFallback;
  }
}

function sanitizeDriveName(value: string) {
  return normalizeTitle(value).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || 'variety';
}

function driveFolderTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
}

async function createDriveSetup(
  accessToken: string,
  title: string,
  creatorEmail?: string,
): Promise<NonNullable<VarietySetupSnapshot['drive']>> {
  const root = await driveService.findOrCreateFolder(accessToken, 'Sortoved');
  const varietyFolder = await driveService.createFolder(
    accessToken,
    `${sanitizeDriveName(title)}_${driveFolderTimestamp()}`,
    root.id,
  );
  await driveService.shareFolderForEditingByLink(accessToken, varietyFolder.id);

  const foldersBySheet: NonNullable<NonNullable<VarietySetupSnapshot['drive']>['foldersBySheet']> = {};
  for (const sheetName of PHOTO_FOLDER_SHEET_NAMES) {
    const folder = await driveService.createFolder(accessToken, sheetName, varietyFolder.id);
    foldersBySheet[sheetName] = {
      folderId: folder.id,
      folderUrl: folder.webViewLink,
    };
  }

  return {
    rootFolderId: root.id,
    rootFolderUrl: root.webViewLink,
    varietyFolderId: varietyFolder.id,
    varietyFolderUrl: varietyFolder.webViewLink,
    creatorEmail,
    foldersBySheet,
  };
}

function createWorkbookSetup(varietyId: string, draft?: VarietyCreationDraft) {
  return {
    localWorkbookPath: `local-workbook://${varietyId}.json`,
    localWorkbook: templateService.createLocalWorkbookCopy(draft),
    sheetAliases: Object.fromEntries(
      Object.entries(SHEET_ALIASES).map(([key, value]) => [key, value.local]),
    ) as Partial<Record<LocalSheetKey, string>>,
  };
}

function isTaskQueueEntry(item: QueuedOperation, varietyId: string, taskCode: string) {
  if (item.varietyId !== varietyId || item.screenId !== taskCode) {
    return false;
  }

  if (item.type === 'submit_task') {
    return true;
  }

  const payload = item.payload as Record<string, unknown>;
  return (
    item.type === 'write_sheet' &&
    (payload.kind === 'phenology_step' ||
      payload.kind === 'choice_step' ||
      payload.kind === 'score_step' ||
      payload.kind === 'yield_step' ||
      payload.kind === 'thousand_seed_weight_step' ||
      payload.kind === 'protein_content_step' ||
      payload.kind === 'fat_content_step' ||
      payload.kind === 'structure_sampling_step')
  );
}

function getTaskQueueEntries(queue: QueuedOperation[], varietyId: string, taskCode: string) {
  return queue
    .filter((item) => isTaskQueueEntry(item, varietyId, taskCode))
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

function stripTaskQueueEntries(queue: QueuedOperation[], varietyId: string, taskCode: string) {
  return queue.filter((item) => !isTaskQueueEntry(item, varietyId, taskCode));
}

function isDraftDiseaseCard(card: InspectionCardDraft) {
  return !card.syncStatus || card.syncStatus === 'draft';
}

function isLockedDiseaseCard(card: InspectionCardDraft) {
  return ['queued', 'synced', 'failed'].includes(card.syncStatus || '');
}

function getTaskUiStatus(
  varietyId: string,
  task: InspectionTask,
  queue: QueuedOperation[],
): TaskUiStatus {
  if (task.cloudStatus === 'locked_by_google') {
    return 'locked_by_google';
  }

  if (task.cloudStatus === 'waiting_for_auth') {
    return 'waiting_for_auth';
  }

  if (task.cloudStatus === 'cloud_failed') {
    return 'cloud_failed';
  }

  if (task.flowKind === 'disease_cards') {
    if (!task.cards.length) {
      return 'not_started';
    }

    if (task.cards.some((card) => isDraftDiseaseCard(card))) {
      return 'draft';
    }

    if (task.cards.some((card) => ['queued', 'failed'].includes(card.syncStatus || ''))) {
      return 'queued';
    }

    if (task.cards.some((card) => card.syncStatus === 'synced')) {
      return 'processed';
    }

    return 'ready_local';
  }

  if (task.flowKind === 'phenology_by_plot') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed', 'waiting_for_auth'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const plots = task.phenologyPlots ? Object.values(task.phenologyPlots) : [];
    if (!plots.some((plot) => plot.photoUri || plot.confirmed)) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'choice_by_plot') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed', 'waiting_for_auth'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const plots = task.choicePlots ? Object.values(task.choicePlots) : [];
    if (!plots.some((plot) => plot.photoUri || plot.selectedValue)) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'score_by_plot') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed', 'waiting_for_auth'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const plots = task.scorePlots ? Object.values(task.scorePlots) : [];
    if (!plots.some((plot) => plot.photoUri || plot.selectedScore)) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'yield_by_plot') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed', 'waiting_for_auth'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const plots = task.yieldPlots ? Object.values(task.yieldPlots) : [];
    if (!plots.some((plot) => plot.rawGrainMassKg || plot.moisturePercent)) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'thousand_seed_weight_step') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return task.thousandSeedWeight?.analysisStatus === 'invalid'
        ? 'analysis_invalid'
        : 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return task.thousandSeedWeight?.analysisStatus === 'invalid'
        ? 'analysis_invalid'
        : 'ready_local';
    }

    const draft = task.thousandSeedWeight;
    if (!draft?.sample1Weight && !draft?.sample2Weight && !draft?.sample3Weight) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'protein_content_step') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const draft = task.proteinContent;
    if (!draft?.sampleMassGrams && !draft?.proteinPercent) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'fat_content_step') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const draft = task.fatContent;
    if (!draft?.sampleMassGrams && !draft?.fatPercent) {
      return 'not_started';
    }

    return 'draft';
  }

  if (task.flowKind === 'structure_by_sampling') {
    const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

    if (taskQueue?.status === 'synced') {
      return 'processed';
    }

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
      return 'queued';
    }

    if (task.completedAt) {
      return 'ready_local';
    }

    const samplings = task.samplings ? Object.values(task.samplings) : [];
    if (!samplings.some((sampling) => sampling.plot || sampling.cards.length)) {
      return 'not_started';
    }

    return 'draft';
  }

  const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

  if (taskQueue?.status === 'synced') {
    return 'processed';
  }

  if (taskQueue && ['queued', 'processing'].includes(taskQueue.status)) {
    return 'queued';
  }

  if (taskQueue?.status === 'failed') {
    return 'ready_local';
  }

  if (task.completedAt) {
    return 'ready_local';
  }

  if (task.overviewPhotoUri || task.cards.length) {
    return 'draft';
  }

  return 'not_started';
}

function isDiseaseCardComplete(card: InspectionCardDraft) {
  return Boolean(
    card.photoUri &&
      card.rowNumber?.trim() &&
      card.plot &&
      card.capturedAt &&
      card.capturedLocation?.mapsUrl,
  );
}

function isMeasurementCardComplete(card: InspectionCardDraft) {
  return Boolean(card.photoUri && card.value?.trim() && card.plot?.trim());
}

function createEmptyPhenologyPlots(): Record<'1' | '2' | '3', PhenologyPlotDraft> {
  return {
    '1': { plot: '1', confirmed: false, isComplete: false },
    '2': { plot: '2', confirmed: false, isComplete: false },
    '3': { plot: '3', confirmed: false, isComplete: false },
  };
}

function createEmptyChoicePlots(): Record<'1' | '2' | '3', ChoicePlotDraft> {
  return {
    '1': { plot: '1', isComplete: false },
    '2': { plot: '2', isComplete: false },
    '3': { plot: '3', isComplete: false },
  };
}

function createEmptyScorePlots(): Record<'1' | '2' | '3', ScorePlotDraft> {
  return {
    '1': { plot: '1', isComplete: false },
    '2': { plot: '2', isComplete: false },
    '3': { plot: '3', isComplete: false },
  };
}

function createEmptyYieldPlots(): Record<'1' | '2' | '3', YieldPlotDraft> {
  return {
    '1': { plot: '1', areaSquareMeters: 5, isComplete: false },
    '2': { plot: '2', areaSquareMeters: 5, isComplete: false },
    '3': { plot: '3', areaSquareMeters: 5, isComplete: false },
  };
}

function createEmptyThousandSeedWeightDraft(): ThousandSeedWeightDraft {
  return {
    requiresThirdSample: false,
    candidatePairs: [],
    analysisStatus: 'valid',
    isComplete: false,
  };
}

function createEmptyProteinContentDraft(): ProteinContentDraft {
  return {
    sampleSource: 'средняя проба',
    analysisMethod: 'Инфракрасный анализатор',
    sampleToleranceStatus: 'out_of_tolerance',
    isComplete: false,
  };
}

function createEmptyFatContentDraft(): FatContentDraft {
  return {
    sampleSource: 'средняя проба',
    analysisMethod: 'Инфракрасный анализатор',
    sampleToleranceStatus: 'out_of_tolerance',
    isComplete: false,
  };
}

function createEmptySamplings(): Record<'1' | '2', StructureSamplingDraft> {
  return {
    '1': { samplingId: '1', cards: [], isComplete: false },
    '2': { samplingId: '2', cards: [], isComplete: false },
  };
}

function isPhenologyPlotComplete(plot: PhenologyPlotDraft) {
  return Boolean(
    plot.photoUri &&
      plot.confirmed &&
      plot.capturedAt &&
      plot.capturedLocation?.mapsUrl,
  );
}

function isChoicePlotComplete(plot: ChoicePlotDraft) {
  return Boolean(
    plot.photoUri &&
      plot.selectedValue &&
      plot.capturedAt &&
      plot.capturedLocation?.mapsUrl,
  );
}

function isScorePlotComplete(plot: ScorePlotDraft) {
  return Boolean(
    plot.photoUri &&
      plot.selectedScore &&
      plot.capturedAt &&
      plot.capturedLocation?.mapsUrl,
  );
}

function isYieldPlotComplete(plot: YieldPlotDraft) {
  const mass = Number(plot.rawGrainMassKg);
  const moisture = Number(plot.moisturePercent);
  return Boolean(
    plot.rawGrainMassKg?.trim() &&
      plot.moisturePercent?.trim() &&
      Number.isFinite(mass) &&
      Number.isFinite(moisture) &&
      mass > 0 &&
      moisture >= 0 &&
      moisture < 100 &&
      plot.yieldTonsPerHectare,
  );
}

function isThousandSeedWeightCompletable(draft: ThousandSeedWeightDraft | undefined) {
  if (!draft) {
    return false;
  }

  if (draft.analysisStatus === 'invalid') {
    return Boolean(
      draft.sample1Weight?.trim() &&
        draft.sample2Weight?.trim() &&
        draft.sample3Weight?.trim(),
    );
  }

  return Boolean(
    draft.sample1Weight?.trim() &&
      draft.sample2Weight?.trim() &&
      draft.isComplete &&
      draft.finalWeight,
  );
}

function isProteinContentCompletable(draft: ProteinContentDraft | undefined) {
  if (!draft) {
    return false;
  }

  const mass = Number(draft.sampleMassGrams);
  const protein = Number(draft.proteinPercent);
  return Boolean(
    draft.sampleMassGrams?.trim() &&
      draft.proteinPercent?.trim() &&
      Number.isFinite(mass) &&
      Number.isFinite(protein) &&
      mass > 0 &&
      protein >= 0,
  );
}

function isFatContentCompletable(draft: FatContentDraft | undefined) {
  if (!draft) {
    return false;
  }

  const mass = Number(draft.sampleMassGrams);
  const fat = Number(draft.fatPercent);
  return Boolean(
    draft.sampleMassGrams?.trim() &&
      draft.fatPercent?.trim() &&
      Number.isFinite(mass) &&
      Number.isFinite(fat) &&
      mass > 0 &&
      fat >= 0,
  );
}

function isStructureCardComplete(card: StructurePlantCardDraft) {
  return Boolean(
    card.photoUri &&
      card.plantNumber?.trim() &&
      card.value?.trim() &&
      card.capturedAt &&
      card.capturedLocation?.mapsUrl,
  );
}

function isSamplingComplete(sampling: StructureSamplingDraft) {
  return Boolean(
    sampling.plot &&
      sampling.cards.length > 0 &&
      sampling.cards.every(isStructureCardComplete),
  );
}

function isPlaceholderTaskComplete(task: InspectionTask) {
  return Boolean(task.overviewPhotoUri);
}

function finalizeTask(
  varietyId: string,
  task: InspectionTask,
  queue: QueuedOperation[],
) {
  const completedAt = task.completedAt || new Date().toISOString();
  const nextTask: InspectionTask = {
    ...task,
    completedAt,
    overviewCompleted: Boolean(task.overviewPhotoUri),
    cardsCompleted:
      task.flowKind === 'measurement_cards'
        ? task.cards.length > 0 && task.cards.every(isMeasurementCardComplete)
        : task.flowKind === 'phenology_by_plot'
          ? Boolean(task.phenologyPlots) &&
            Object.values(task.phenologyPlots || {}).every(isPhenologyPlotComplete)
        : task.flowKind === 'choice_by_plot'
          ? Boolean(task.choicePlots) &&
            Object.values(task.choicePlots || {}).every(isChoicePlotComplete)
        : task.flowKind === 'score_by_plot'
          ? Boolean(task.scorePlots) &&
            Object.values(task.scorePlots || {}).every(isScorePlotComplete)
        : task.flowKind === 'yield_by_plot'
          ? Boolean(task.yieldPlots) &&
            Object.values(task.yieldPlots || {}).every(isYieldPlotComplete)
        : task.flowKind === 'thousand_seed_weight_step'
          ? isThousandSeedWeightCompletable(task.thousandSeedWeight)
        : task.flowKind === 'protein_content_step'
          ? isProteinContentCompletable(task.proteinContent)
        : task.flowKind === 'fat_content_step'
          ? isFatContentCompletable(task.fatContent)
        : task.flowKind === 'structure_by_sampling'
          ? Boolean(task.samplings) &&
            Object.values(task.samplings || {}).every(isSamplingComplete)
        : task.flowKind === 'disease_cards'
          ? task.cards.length > 0 && task.cards.every((card) => card.syncStatus === 'synced')
          : task.cardsCompleted,
    updatedAt: task.completedAt ? task.updatedAt : completedAt,
  };

  return {
    ...nextTask,
    uiStatus: getTaskUiStatus(varietyId, nextTask, queue),
  };
}

function createTaskFromDefinition(
  varietyId: string,
  taskCode: string,
  queue: QueuedOperation[],
): InspectionTask {
  const taskDef = taskDefinitionsByCode[taskCode];
  if (!taskDef) {
    throw new Error(`Task ${taskCode} not found`);
  }

  const task: InspectionTask = {
    code: taskCode,
    title: taskDef.title,
    kind: taskDef.kind,
    flowKind: taskDef.flowKind,
    intro: taskDef.intro,
    overviewHint: taskDef.overviewHint,
    cardsHint: taskDef.cardsHint,
    observationLabel: taskDef.observationLabel,
    valueLabel: taskDef.valueLabel,
    overviewCompleted: false,
    cardsCompleted: false,
    uiStatus: 'not_started',
    cards: [],
    phenologyPlots:
      taskDef.flowKind === 'phenology_by_plot' ? createEmptyPhenologyPlots() : undefined,
    choicePlots: taskDef.flowKind === 'choice_by_plot' ? createEmptyChoicePlots() : undefined,
    scorePlots: taskDef.flowKind === 'score_by_plot' ? createEmptyScorePlots() : undefined,
    yieldPlots: taskDef.flowKind === 'yield_by_plot' ? createEmptyYieldPlots() : undefined,
    thousandSeedWeight:
      taskDef.flowKind === 'thousand_seed_weight_step'
        ? createEmptyThousandSeedWeightDraft()
        : undefined,
    proteinContent:
      taskDef.flowKind === 'protein_content_step' ? createEmptyProteinContentDraft() : undefined,
    fatContent: taskDef.flowKind === 'fat_content_step' ? createEmptyFatContentDraft() : undefined,
    samplings: taskDef.flowKind === 'structure_by_sampling' ? createEmptySamplings() : undefined,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...task,
    uiStatus: getTaskUiStatus(varietyId, task, queue),
  };
}

function normalizeInspections(
  inspections: PersistedV2State['inspections'],
  queue: QueuedOperation[],
) {
  return Object.fromEntries(
    Object.entries(inspections).map(([varietyId, tasks]) => [
      varietyId,
      Object.fromEntries(
        Object.entries(tasks).map(([taskCode, task]) => [
          taskCode,
          {
            ...task,
            uiStatus: getTaskUiStatus(varietyId, task, queue),
          },
        ]),
      ),
    ]),
  );
}

function normalizeState(stored: PersistedV2State): PersistedV2State {
  const cutoff = Date.now() - LOCAL_PHOTO_RETENTION_MS;
  const syncQueue = stored.syncQueue.filter(
    (entry) => entry.cloudAppliedAt || new Date(entry.createdAt).getTime() >= cutoff,
  );
  return {
    ...stored,
    syncQueue,
    inspections: normalizeInspections(stored.inspections, syncQueue),
  };
}

interface V2ContextValue {
  hydrated: boolean;
  state: PersistedV2State;
  online: boolean;
  prepareMode(mode: AuthMode, session: GoogleSession): Promise<void>;
  signOut(): Promise<void>;
  reauthorizeAndResumeQueue(session: GoogleSession): Promise<void>;
  importVarietyFromClipboard(): Promise<void>;
  beginCreation(): void;
  cancelCreation(): void;
  creationStepIndex: number;
  currentCreationStep: (typeof creationSteps)[number];
  nextCreationStep(): Promise<void>;
  prevCreationStep(): void;
  updateCreationDraft(changes: Partial<VarietyCreationDraft>): void;
  updatePlotDraft(plot: '1' | '2' | '3', changes: Partial<VarietyCreationDraft['plots']['1']>): void;
  captureLocation(): Promise<void>;
  completeCreation(): Promise<VarietyRecord>;
  getVariety(varietyId: string): VarietyRecord | undefined;
  getTask(varietyId: string, taskCode: string): InspectionTask;
  refreshTaskReadState(varietyId: string, taskCode: string): Promise<InspectionTask>;
  saveOverviewPhoto(varietyId: string, taskCode: string, uri: string): void;
  markOverviewComplete(varietyId: string, taskCode: string): void;
  addTaskCard(varietyId: string, taskCode: string): void;
  updateTaskCard(
    varietyId: string,
    taskCode: string,
    cardId: string,
    changes: Partial<InspectionCardDraft>,
  ): void;
  updatePhenologyPlot(
    varietyId: string,
    taskCode: string,
    plot: '1' | '2' | '3',
    changes: Partial<PhenologyPlotDraft>,
  ): void;
  updateChoicePlot(
    varietyId: string,
    taskCode: string,
    plot: '1' | '2' | '3',
    changes: Partial<ChoicePlotDraft>,
  ): void;
  updateScorePlot(
    varietyId: string,
    taskCode: string,
    plot: '1' | '2' | '3',
    changes: Partial<ScorePlotDraft>,
  ): void;
  updateYieldPlot(
    varietyId: string,
    taskCode: string,
    plot: '1' | '2' | '3',
    changes: Partial<YieldPlotDraft>,
  ): void;
  updateThousandSeedWeight(
    varietyId: string,
    taskCode: string,
    changes: Partial<ThousandSeedWeightDraft>,
  ): void;
  updateProteinContent(
    varietyId: string,
    taskCode: string,
    changes: Partial<ProteinContentDraft>,
  ): void;
  updateFatContent(
    varietyId: string,
    taskCode: string,
    changes: Partial<FatContentDraft>,
  ): void;
  selectThousandSeedWeightPair(
    varietyId: string,
    taskCode: string,
    pair: SeedWeightPair,
  ): void;
  updateSamplingPlot(
    varietyId: string,
    taskCode: string,
    samplingId: '1' | '2',
    plot: '1' | '2' | '3',
  ): void;
  addSamplingCard(varietyId: string, taskCode: string, samplingId: '1' | '2'): void;
  updateSamplingCard(
    varietyId: string,
    taskCode: string,
    samplingId: '1' | '2',
    cardId: string,
    changes: Partial<StructurePlantCardDraft>,
  ): void;
  removeSamplingCard(
    varietyId: string,
    taskCode: string,
    samplingId: '1' | '2',
    cardId: string,
  ): void;
  completeTaskCard(varietyId: string, taskCode: string, cardId: string): Promise<void>;
  removeTaskCard(varietyId: string, taskCode: string, cardId: string): void;
  completeTaskLocally(varietyId: string, taskCode: string): void;
  queueTaskSubmission(varietyId: string, taskCode: string): Promise<void>;
  processQueue(): Promise<void>;
}

const V2AppContext = createContext<V2ContextValue | undefined>(undefined);

export function V2AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedV2State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [creationStepIndex, setCreationStepIndex] = useState(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [storedResult, onlineResult, sessionResult] = await Promise.allSettled([
        v2Repository.load(),
        isInternetReachable(),
        authService.restoreSession(),
      ]);

      if (cancelled) {
        return;
      }

      if (storedResult.status === 'rejected') {
        console.error('Failed to load v2 state from storage', storedResult.reason);
      }

      if (onlineResult.status === 'rejected') {
        console.error('Failed to resolve network state during v2 hydration', onlineResult.reason);
      }

      if (sessionResult.status === 'rejected') {
        console.error('Failed to restore auth session during v2 hydration', sessionResult.reason);
      }

      const stored = storedResult.status === 'fulfilled' ? storedResult.value : null;
      const isOnline = onlineResult.status === 'fulfilled' ? onlineResult.value : true;
      const restoredSession = sessionResult.status === 'fulfilled' ? sessionResult.value : null;
      const nextState = stored ? normalizeState(stored) : initialState;
      const nextSession = isGoogleSessionUsable(restoredSession)
        ? restoredSession
        : isGoogleSessionUsable(nextState.session)
          ? nextState.session
          : null;

      setOnline(isOnline);
      setState({
        ...nextState,
        session: nextSession,
      });
      setHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void v2Repository.save(state);
  }, [hydrated, state]);

  useEffect(() => {
    const sub = subscribeToNetwork((isConnected) => {
      setOnline(isConnected);
      if (isConnected) {
        void processQueueInternal();
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (hydrated && online) {
      void processQueueInternal();
    }
  }, [hydrated, online]);

  async function processDiseaseCardOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const cardId = String(payload.cardId || '');
    const logicalSheetKey = payload.logicalSheetKey as DiseaseSheetKey | undefined;
    const plot = payload.plot as '1' | '2' | '3';
    const rowNumber = String(payload.rowNumber || '');
    const plantNumber = payload.plantNumber ? String(payload.plantNumber) : undefined;
    const capturedAt = payload.capturedAt ? String(payload.capturedAt) : undefined;
    const capturedLocation = payload.capturedLocation as
      | { mapsUrl?: string }
      | undefined;
    if (!varietyId || !taskCode || !cardId || !plot || !rowNumber || !logicalSheetKey) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.applyDiseaseCardWrite(nextWorkbook, logicalSheetKey, {
        plot,
        rowNumber,
        plantNumber,
        capturedAt,
        mapsUrl: capturedLocation?.mapsUrl,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task = current.inspections[varietyId]?.[taskCode] || createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        cardsCompleted: task.cards.some((card) => card.id === cardId) || task.cardsCompleted,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cards: task.cards.map((card) =>
          card.id === cardId
            ? {
                ...card,
                syncStatus: 'synced',
                localWorkbookRow: applied.rowIndex + 1,
                queuedOperationId: item.id,
              }
            : card,
        ),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processPhenologyStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as PhenologySheetKey | undefined;
    const plots = payload.plots as Record<'1' | '2' | '3', PhenologyPlotDraft> | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !plots) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.applyPhenologyStepWrite(nextWorkbook, logicalSheetKey, {
        plots,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        phenologyPlots: plots,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processChoiceStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as ChoiceSheetKey | undefined;
    const plots = payload.plots as Record<'1' | '2' | '3', ChoicePlotDraft> | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !plots) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.applyChoiceStepWrite(nextWorkbook, logicalSheetKey, {
        plots,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        choicePlots: plots,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processScoreStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as ScoreSheetKey | undefined;
    const plots = payload.plots as Record<'1' | '2' | '3', ScorePlotDraft> | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !plots) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.applyScoreStepWrite(nextWorkbook, logicalSheetKey, {
        plots,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        scorePlots: plots,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processYieldStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as YieldSheetKey | undefined;
    const plots = payload.plots as Record<'1' | '2' | '3', YieldPlotDraft> | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !plots) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.applyYieldStepWrite(nextWorkbook, logicalSheetKey, {
        plots,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        yieldPlots: plots,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processThousandSeedWeightStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as ThousandSeedWeightSheetKey | undefined;
    const draft = payload.draft as ThousandSeedWeightDraft | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !draft) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, current.syncQueue);
      const applied = templateService.applyThousandSeedWeightStepWrite(
        nextWorkbook,
        logicalSheetKey,
        {
          draft,
          userEmail: current.session?.email,
          completedAt: task.completedAt,
        },
      );

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const nextTask: InspectionTask = {
        ...task,
        thousandSeedWeight: draft,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: draft.analysisStatus === 'invalid' ? 'analysis_invalid' : 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processProteinContentStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as ProteinContentSheetKey | undefined;
    const draft = payload.draft as ProteinContentDraft | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !draft) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, current.syncQueue);
      const applied = templateService.applyProteinContentStepWrite(nextWorkbook, logicalSheetKey, {
        draft,
        userEmail: current.session?.email,
        completedAt: task.completedAt,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const nextTask: InspectionTask = {
        ...task,
        proteinContent: draft,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processFatContentStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as FatContentSheetKey | undefined;
    const draft = payload.draft as FatContentDraft | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !draft) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, current.syncQueue);
      const applied = templateService.applyFatContentStepWrite(nextWorkbook, logicalSheetKey, {
        draft,
        userEmail: current.session?.email,
        completedAt: task.completedAt,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const nextTask: InspectionTask = {
        ...task,
        fatContent: draft,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processStructureSamplingStepOperation(item: QueuedOperation) {
    const payload = item.payload as Record<string, unknown>;
    const varietyId = item.varietyId;
    const taskCode = String(payload.taskCode || item.screenId || '');
    const logicalSheetKey = payload.logicalSheetKey as StructureSheetKey | undefined;
    const samplings = payload.samplings as Record<'1' | '2', StructureSamplingDraft> | undefined;

    if (!varietyId || !taskCode || !logicalSheetKey || !samplings) {
      throw new Error(v2Copy.localSyncError);
    }

    setState((current) => {
      const variety = current.catalog.find((entry) => entry.id === varietyId);
      if (!variety) {
        throw new Error(v2Copy.varietyNotFound);
      }

      const workbook =
        variety.setup?.localWorkbook || templateService.createLocalWorkbookCopy();
      const nextWorkbook = JSON.parse(JSON.stringify(workbook)) as Record<
        string,
        (string | number | boolean)[][]
      >;
      const applied = templateService.appendStructureSamplingStepWrite(nextWorkbook, logicalSheetKey, {
        samplings,
        userEmail: current.session?.email,
      });

      const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
        entry.id === item.id
          ? ({
              ...entry,
              status: 'synced',
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              localAppliedAt: entry.localAppliedAt || new Date().toISOString(),
            } satisfies QueuedOperation)
          : entry,
      );

      const task =
        current.inspections[varietyId]?.[taskCode] ||
        createTaskFromDefinition(varietyId, taskCode, nextQueue);
      const nextTask: InspectionTask = {
        ...task,
        samplings,
        cardsCompleted: true,
        completedAt: task.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiStatus: 'processed',
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((entry) =>
          entry.id === varietyId
            ? {
                ...entry,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                lastError: undefined,
                setup: {
                  ...entry.setup,
                  localWorkbook: applied.workbook,
                },
              }
            : entry,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...nextTask,
              uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
            },
          },
        },
      };
    });
  }

  async function processQueueInternal(queueOverride?: QueuedOperation[]) {
    let workingQueue = queueOverride || stateRef.current.syncQueue;
    for (const item of workingQueue) {
      if (!['queued', 'failed'].includes(item.status) || item.localAppliedAt) {
        continue;
      }

      try {
        setState((current) => ({
          ...current,
          syncQueue: current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: 'processing',
                  updatedAt: new Date().toISOString(),
                } satisfies QueuedOperation)
              : entry,
          ),
        }));

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'disease_card'
        ) {
          await processDiseaseCardOperation(item);
          continue;
        }

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'phenology_step'
        ) {
          await processPhenologyStepOperation(item);
          continue;
        }

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'choice_step'
        ) {
          await processChoiceStepOperation(item);
          continue;
        }

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'score_step'
        ) {
          await processScoreStepOperation(item);
          continue;
        }

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'yield_step'
        ) {
          await processYieldStepOperation(item);
          continue;
        }

        if (
          item.type === 'write_sheet' &&
          (item.payload as Record<string, unknown>).kind === 'thousand_seed_weight_step'
        ) {
          await processThousandSeedWeightStepOperation(item);
          continue;
        }

          if (
            item.type === 'write_sheet' &&
            (item.payload as Record<string, unknown>).kind === 'protein_content_step'
          ) {
            await processProteinContentStepOperation(item);
            continue;
          }

          if (
            item.type === 'write_sheet' &&
            (item.payload as Record<string, unknown>).kind === 'fat_content_step'
          ) {
            await processFatContentStepOperation(item);
            continue;
          }

          if (
            item.type === 'write_sheet' &&
            (item.payload as Record<string, unknown>).kind === 'structure_sampling_step'
        ) {
          await processStructureSamplingStepOperation(item);
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        setState((current) => {
          const appliedAt = item.localAppliedAt || new Date().toISOString();
          const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: 'synced',
                  updatedAt: new Date().toISOString(),
                  lastError: undefined,
                  localAppliedAt: entry.localAppliedAt || appliedAt,
                } satisfies QueuedOperation)
              : entry,
          );
          workingQueue = workingQueue.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'synced',
                  updatedAt: new Date().toISOString(),
                  lastError: undefined,
                  localAppliedAt: entry.localAppliedAt || appliedAt,
                }
              : entry,
          );

          const next = {
            ...current,
            syncQueue: nextQueue,
            catalog: current.catalog.map((variety) =>
              variety.id === item.varietyId
                ? {
                    ...variety,
                    status: 'ready' as const,
                    updatedAt: new Date().toISOString(),
                    lastError: undefined,
                  }
                : variety,
            ),
            inspections: normalizeInspections(current.inspections, nextQueue),
          };
          stateRef.current = next;
          return next;
        });
      } catch (error) {
        setState((current) => {
          const payload = item.payload as Record<string, unknown>;
          const taskCode = String(payload.taskCode || item.screenId || '');
          const cardId = payload.cardId ? String(payload.cardId) : undefined;
          const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: 'failed',
                  retryCount: entry.retryCount + 1,
                  updatedAt: new Date().toISOString(),
                  lastError:
                    error instanceof Error ? error.message : v2Copy.localSyncError,
                } satisfies QueuedOperation)
              : entry,
          );

          const next = {
            ...current,
            syncQueue: nextQueue,
            catalog: current.catalog.map((variety) =>
              variety.id === item.varietyId
                ? {
                    ...variety,
                    status: 'error' as const,
                    updatedAt: new Date().toISOString(),
                    lastError:
                      error instanceof Error ? error.message : v2Copy.localSyncError,
                  }
                : variety,
            ),
            inspections: item.varietyId && taskCode
              ? {
                  ...current.inspections,
                  [item.varietyId]: {
                    ...current.inspections[item.varietyId],
                    [taskCode]: {
                      ...(current.inspections[item.varietyId]?.[taskCode] ||
                        createTaskFromDefinition(item.varietyId, taskCode, nextQueue)),
                      cards: (current.inspections[item.varietyId]?.[taskCode]?.cards || []).map((card) =>
                        card.id === cardId
                          ? {
                              ...card,
                              syncStatus: 'failed' as const,
                              queuedOperationId: item.id,
                            }
                          : card,
                      ),
                      uiStatus: getTaskUiStatus(
                        item.varietyId,
                        {
                          ...(current.inspections[item.varietyId]?.[taskCode] ||
                            createTaskFromDefinition(item.varietyId, taskCode, nextQueue)),
                          cards: (current.inspections[item.varietyId]?.[taskCode]?.cards || []).map((card) =>
                            card.id === cardId
                              ? {
                                  ...card,
                                  syncStatus: 'failed' as const,
                                  queuedOperationId: item.id,
                                }
                              : card,
                          ),
                        },
                        nextQueue,
                      ),
                    },
                  },
                }
              : current.inspections,
          };
          stateRef.current = next;
          return next;
        });
      }
    }

    const cloudQueue = workingQueue.filter(
      (item) =>
        ['synced', 'failed'].includes(item.status) &&
        item.localAppliedAt &&
        !item.cloudAppliedAt,
    );

    for (const item of cloudQueue) {
      try {
        const payload = item.payload as Record<string, unknown>;
        const taskCode = String(payload.taskCode || item.screenId || '');
        await processQueuedOperation(item, {
          session: stateRef.current.session,
          catalog: stateRef.current.catalog,
          task:
            item.varietyId && taskCode
              ? stateRef.current.inspections[item.varietyId]?.[taskCode]
              : undefined,
        });

        setState((current) => {
          const payload = item.payload as Record<string, unknown>;
          const taskCode = String(payload.taskCode || item.screenId || '');
          const nextQueue = current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: 'synced',
                  updatedAt: new Date().toISOString(),
                  cloudAppliedAt: new Date().toISOString(),
                  cloudError: undefined,
                  authRequired: false,
                } satisfies QueuedOperation)
              : entry,
          );

          const existingTask =
            item.varietyId && taskCode
              ? current.inspections[item.varietyId]?.[taskCode]
              : undefined;
          const nextTask =
            item.varietyId && existingTask
              ? ({
                  ...existingTask,
                  cloudStatus: 'cloud_synced',
                  updatedAt: new Date().toISOString(),
                } satisfies InspectionTask)
              : undefined;

          const next = {
            ...current,
            syncQueue: nextQueue,
            inspections:
              item.varietyId && taskCode && nextTask
                ? {
                    ...current.inspections,
                    [item.varietyId]: {
                      ...current.inspections[item.varietyId],
                      [taskCode]: {
                        ...nextTask,
                        uiStatus: getTaskUiStatus(item.varietyId, nextTask, nextQueue),
                      },
                    },
                  }
                : current.inspections,
          };
          stateRef.current = next;
          return next;
        });
      } catch (error) {
        const isAuthRequired =
          error instanceof Error &&
          'authRequired' in error &&
          Boolean((error as Error & { authRequired?: boolean }).authRequired);

        setState((current) => {
          const payload = item.payload as Record<string, unknown>;
          const taskCode = String(payload.taskCode || item.screenId || '');
          const nextQueue = current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: isAuthRequired ? 'waiting_for_auth' : 'failed',
                  updatedAt: new Date().toISOString(),
                  retryCount: isAuthRequired ? entry.retryCount : entry.retryCount + 1,
                  cloudError: error instanceof Error ? error.message : v2Copy.localSyncError,
                  authRequired: isAuthRequired,
                } satisfies QueuedOperation)
              : entry,
          );
          const existingTask =
            item.varietyId && taskCode
              ? current.inspections[item.varietyId]?.[taskCode]
              : undefined;
          const nextTask =
            item.varietyId && existingTask
              ? ({
                  ...existingTask,
                  cloudStatus: isAuthRequired ? 'waiting_for_auth' : 'cloud_failed',
                  updatedAt: new Date().toISOString(),
                } satisfies InspectionTask)
              : undefined;

          const next = {
            ...current,
            syncQueue: nextQueue,
            pendingAuthMode: isAuthRequired ? current.pendingAuthMode || 'link' : current.pendingAuthMode,
            inspections:
              item.varietyId && taskCode && nextTask
                ? {
                    ...current.inspections,
                    [item.varietyId]: {
                      ...current.inspections[item.varietyId],
                      [taskCode]: {
                        ...nextTask,
                        uiStatus: getTaskUiStatus(item.varietyId, nextTask, nextQueue),
                      },
                    },
                  }
                : current.inspections,
          };
          stateRef.current = next;
          return next;
        });
      }
    }
  }

  function getTaskFromState(
    sourceState: PersistedV2State,
    varietyId: string,
    taskCode: string,
  ): InspectionTask {
    const existing = sourceState.inspections[varietyId]?.[taskCode];
    if (existing) {
      return {
        ...existing,
        uiStatus: getTaskUiStatus(varietyId, existing, sourceState.syncQueue),
      };
    }

    return createTaskFromDefinition(varietyId, taskCode, sourceState.syncQueue);
  }

  function getTaskInternal(varietyId: string, taskCode: string): InspectionTask {
    return getTaskFromState(stateRef.current, varietyId, taskCode);
  }

  function saveTask(
    varietyId: string,
    taskCode: string,
    nextTask: InspectionTask,
    syncQueue = stateRef.current.syncQueue,
  ) {
    setState((current) => ({
      ...current,
      inspections: {
        ...current.inspections,
        [varietyId]: {
          ...current.inspections[varietyId],
          [taskCode]: {
            ...nextTask,
            uiStatus: getTaskUiStatus(varietyId, nextTask, syncQueue),
          },
        },
      },
    }));
  }

  function saveDraftTask(varietyId: string, taskCode: string, nextTask: InspectionTask) {
    setState((current) => {
      const nextQueue = stripTaskQueueEntries(current.syncQueue, varietyId, taskCode);
      const draftTask: InspectionTask = {
        ...nextTask,
        completedAt: nextTask.flowKind === 'disease_cards' ? nextTask.completedAt : undefined,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...current,
        syncQueue: nextQueue,
        catalog: current.catalog.map((item) =>
          item.id === varietyId && item.status !== 'syncing'
            ? { ...item, status: 'draft', updatedAt: draftTask.updatedAt }
            : item,
        ),
        inspections: {
          ...current.inspections,
          [varietyId]: {
            ...current.inspections[varietyId],
            [taskCode]: {
              ...draftTask,
              uiStatus: getTaskUiStatus(varietyId, draftTask, nextQueue),
            },
          },
        },
      };
    });
  }

  const value = useMemo<V2ContextValue>(
    () => ({
      hydrated,
      state,
      online,
      async prepareMode(mode, session) {
        await authService.persistSession(session);
        setState((current) => {
          const next = { ...current, session, pendingAuthMode: mode };
          stateRef.current = next;
          return next;
        });
      },
      async signOut() {
        await authService.signOut(stateRef.current.session);
        setState((current) => ({
          ...current,
          session: null,
          syncQueue: current.syncQueue.map((entry) =>
            entry.cloudAppliedAt
              ? entry
              : ({
                  ...entry,
                  status: entry.localAppliedAt ? 'waiting_for_auth' : entry.status,
                  authRequired: entry.localAppliedAt ? true : entry.authRequired,
                  updatedAt: new Date().toISOString(),
                } satisfies QueuedOperation),
          ),
        }));
      },
      async reauthorizeAndResumeQueue(session) {
        await authService.persistSession(session);
        const resumedQueue = stateRef.current.syncQueue.map((entry) =>
          entry.status === 'waiting_for_auth'
            ? ({
                ...entry,
                status: 'synced',
                authRequired: false,
                updatedAt: new Date().toISOString(),
              } satisfies QueuedOperation)
            : entry,
        );
        setState((current) => ({
          ...current,
          session,
          pendingAuthMode: null,
          syncQueue: resumedQueue,
        }));

        await processQueueInternal(resumedQueue);
      },
      async importVarietyFromClipboard() {
        const raw = await clipboardService.readString();
        if (!raw) {
          throw new Error(v2Copy.emptyClipboard);
        }
        if (!isValidGoogleSheetsUrl(raw)) {
          throw new Error(v2Copy.invalidSheetsUrl);
        }

        const now = new Date().toISOString();
        const varietyId = createId('variety');
        const session = assertGoogleSessionUsable(stateRef.current.session);
        const inspected = await sheetsService.inspectSpreadsheet(session.accessToken, raw);
        if (inspected.missingTemplateSheets.length) {
          throw new Error(
            `Google-таблица не соответствует шаблону сорта. Нет листов: ${inspected.missingTemplateSheets.join(', ')}`,
          );
        }
        const metaRows = await sheetsService.readSheet(session.accessToken, inspected.spreadsheetId, '00.meta');
        const drive = parseMetaSheetRows(metaRows);
        if (!drive?.varietyFolderId) {
          throw new Error('В таблице не найдена Drive-папка сорта. Добавьте сорт, созданный приложением.');
        }
        await driveService.assertFolderWritable(session.accessToken, drive.varietyFolderId);
        const title = inspected.title || buildImportedVarietyTitle(raw);
        const record: VarietyRecord = {
          id: varietyId,
          title,
          source: 'linked',
          binding: {
            spreadsheetId: inspected.spreadsheetId,
            spreadsheetUrl: inspected.spreadsheetUrl,
          },
          setup: {
            ...createWorkbookSetup(varietyId),
            sheetAliases: inspected.sheetAliases,
            drive,
          },
          createdAt: now,
          updatedAt: now,
          status: 'ready',
        };

        setState((current) => ({
          ...current,
          catalog: [
            ...current.catalog.filter(
              (item) => item.binding.spreadsheetUrl !== record.binding.spreadsheetUrl,
            ),
            record,
          ],
          pendingAuthMode: null,
        }));
      },
      beginCreation() {
        setCreationStepIndex(0);
        setState((current) => ({
          ...current,
          creationDraft: current.creationDraft || initialCreationDraft(),
        }));
      },
      cancelCreation() {
        setCreationStepIndex(0);
        setState((current) => ({ ...current, creationDraft: null, pendingAuthMode: null }));
      },
      creationStepIndex,
      currentCreationStep: creationSteps[creationStepIndex],
      async nextCreationStep() {
        setCreationStepIndex((current) => Math.min(creationSteps.length - 1, current + 1));
      },
      prevCreationStep() {
        setCreationStepIndex((current) => Math.max(0, current - 1));
      },
      updateCreationDraft(changes) {
        setState((current) => ({
          ...current,
          creationDraft: {
            ...(current.creationDraft || initialCreationDraft()),
            ...changes,
          },
        }));
      },
      updatePlotDraft(plot, changes) {
        setState((current) => ({
          ...current,
          creationDraft: current.creationDraft
            ? {
                ...current.creationDraft,
                plots: {
                  ...current.creationDraft.plots,
                  [plot]: {
                    ...current.creationDraft.plots[plot],
                    ...changes,
                  },
                },
              }
            : initialCreationDraft(),
        }));
      },
      async captureLocation() {
        const location = await locationService.getCurrentLocation();
        setState((current) => ({
          ...current,
          creationDraft: current.creationDraft
            ? {
                ...current.creationDraft,
                latitude: location.latitude,
                longitude: location.longitude,
                mapsUrl: location.mapsUrl,
              }
            : current.creationDraft,
        }));
      },
      async completeCreation() {
        console.log('[Creation] completeCreation:start');
        const draft = stateRef.current.creationDraft;
        const session = assertGoogleSessionUsable(stateRef.current.session);
        if (!draft) {
          throw new Error(v2Copy.creationDraftMissing);
        }

        const title = normalizeTitle(draft.varietyName);
        if (!title) {
          throw new Error(v2Copy.varietyNameRequired);
        }

        const varietyId = createId('variety');
        const now = new Date().toISOString();
        console.log('[Creation] creating Drive setup', { title });
        const drive = await createDriveSetup(session.accessToken, title, session.email);
        console.log('[Creation] Drive setup created', {
          rootFolderId: drive.rootFolderId,
          varietyFolderId: drive.varietyFolderId,
        });
        const setupSnapshot: VarietySetupSnapshot = {
          mapsUrl: draft.mapsUrl,
          plotPhotos: {
            '1': draft.plots['1'].photoUri,
            '2': draft.plots['2'].photoUri,
            '3': draft.plots['3'].photoUri,
          },
          ...createWorkbookSetup(varietyId, draft),
          drive,
        };
        if (setupSnapshot.localWorkbook) {
          setupSnapshot.localWorkbook['00.meta'] = templateService.buildMetaWrite(setupSnapshot).values;
        }
        const workbookWrites = templateService
          .buildCreationWrites(draft)
          .map((write) => (write.sheet === '00.meta' ? templateService.buildMetaWrite(setupSnapshot) : write));
        const remoteSheets = [...TEMPLATE_WORKSHEET_NAMES];
        console.log('[Creation] creating spreadsheet', { title, sheetCount: remoteSheets.length });
        const createdSpreadsheet = await sheetsService.createSpreadsheet(
          session.accessToken,
          title,
          remoteSheets,
        );
        console.log('[Creation] spreadsheet created', {
          spreadsheetId: createdSpreadsheet.spreadsheetId,
          spreadsheetUrl: createdSpreadsheet.spreadsheetUrl,
        });
        const inspectedSpreadsheet = await sheetsService.inspectSpreadsheet(
          session.accessToken,
          createdSpreadsheet.spreadsheetUrl,
        );
        const record: VarietyRecord = {
          id: varietyId,
          title,
          source: 'created',
          binding: {
            spreadsheetId: inspectedSpreadsheet.spreadsheetId,
            spreadsheetUrl: inspectedSpreadsheet.spreadsheetUrl,
          },
          setup: {
            ...setupSnapshot,
            sheetAliases: inspectedSpreadsheet.sheetAliases,
          },
          createdAt: now,
          updatedAt: now,
          status: 'syncing',
        };
        const operation: QueuedOperation = {
          id: createId('queue'),
          type: 'create_variety',
          varietyId,
          screenId: creationSteps[creationSteps.length - 1].screenId,
          status: 'queued',
          idempotencyKey: `create:${title}:${now}`,
          createdAt: now,
          updatedAt: now,
          retryCount: 0,
          payload: { title, source: 'created' },
          writes: workbookWrites,
          media: (['1', '2', '3'] as const)
            .filter((plot) => draft.plots[plot].photoUri)
            .map((plot) => ({
              localUri: draft.plots[plot].photoUri as string,
              mimeType: 'image/jpeg',
              targetSheet: PLOTS_SHEET_NAME,
              capturedAt: now,
            })),
        };

        setState((current) => {
          const next = {
            ...current,
            catalog: [...current.catalog, record],
            creationDraft: null,
            pendingAuthMode: null,
            syncQueue: [operation, ...current.syncQueue],
          };
          stateRef.current = next;
          return next;
        });
        setCreationStepIndex(0);
        console.log('[Creation] processing queue', { operationId: operation.id });
        await processQueueInternal([operation, ...stateRef.current.syncQueue.filter((entry) => entry.id !== operation.id)]);
        const syncedOperation = stateRef.current.syncQueue.find((entry) => entry.id === operation.id);
        if (!syncedOperation?.cloudAppliedAt) {
          throw new Error(
            syncedOperation?.cloudError ||
              syncedOperation?.lastError ||
              'Cloud creation did not finish. Проверьте локальную очередь.',
          );
        }
        console.log('[Creation] completeCreation:done', { varietyId });
        return record;
      },
      getVariety(varietyId) {
        return state.catalog.find((item) => item.id === varietyId);
      },
      getTask(varietyId, taskCode) {
        return getTaskFromState(state, varietyId, taskCode);
      },
      async refreshTaskReadState(varietyId, taskCode) {
        const variety = stateRef.current.catalog.find((item) => item.id === varietyId);
        const task = getTaskInternal(varietyId, taskCode);
        if (!variety || !isGoogleSessionUsable(stateRef.current.session)) {
          return task;
        }
        const session = assertGoogleSessionUsable(stateRef.current.session);

        const syncedTask = await syncTaskReadState(session.accessToken, variety, task);
        if (syncedTask !== task) {
          saveTask(varietyId, taskCode, syncedTask);
        }
        return syncedTask;
      },
      saveOverviewPhoto(varietyId, taskCode, uri) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          overviewPhotoUri: uri,
          overviewCompleted: Boolean(uri) && currentTask.overviewCompleted,
        });
      },
      markOverviewComplete(varietyId, taskCode) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (!currentTask.overviewPhotoUri) {
          throw new Error(v2Copy.taskOverviewRequired);
        }

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          overviewCompleted: true,
        });
      },
      addTaskCard(varietyId, taskCode) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        const card: InspectionCardDraft = {
          id: createId('card'),
          note: '',
          isComplete: false,
          syncStatus: currentTask.flowKind === 'disease_cards' ? 'draft' : undefined,
        };
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: [...currentTask.cards, card],
        });
      },
      updateTaskCard(varietyId, taskCode, cardId, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        const isMeasurement = currentTask.flowKind === 'measurement_cards';
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: currentTask.cards.map((card) => {
            if (card.id !== cardId) {
              return card;
            }
            if (
              (currentTask.flowKind === 'disease_cards' && isLockedDiseaseCard(card)) ||
              (card.isComplete && !('isComplete' in changes))
            ) {
              return card;
            }

            const nextCard = { ...card, ...changes };
            return {
              ...nextCard,
              isComplete:
                currentTask.flowKind === 'disease_cards'
                  ? isDiseaseCardComplete(nextCard) && !isDraftDiseaseCard(nextCard)
                  : isMeasurement
                    ? isMeasurementCardComplete(nextCard)
                    : false,
            };
            }),
          });
        },
      updatePhenologyPlot(varietyId, taskCode, plot, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'phenology_by_plot' || currentTask.completedAt) {
          return;
        }

        const nextPlots = {
          ...(currentTask.phenologyPlots || createEmptyPhenologyPlots()),
          [plot]: {
            ...(currentTask.phenologyPlots?.[plot] || {
              plot,
              confirmed: false,
              isComplete: false,
            }),
            ...changes,
          },
        } as Record<'1' | '2' | '3', PhenologyPlotDraft>;

        nextPlots[plot] = {
          ...nextPlots[plot],
          isComplete: isPhenologyPlotComplete(nextPlots[plot]),
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          phenologyPlots: nextPlots,
        });
      },
      updateChoicePlot(varietyId, taskCode, plot, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'choice_by_plot' || currentTask.completedAt) {
          return;
        }

        const nextPlots = {
          ...(currentTask.choicePlots || createEmptyChoicePlots()),
          [plot]: {
            ...(currentTask.choicePlots?.[plot] || {
              plot,
              isComplete: false,
            }),
            ...changes,
          },
        } as Record<'1' | '2' | '3', ChoicePlotDraft>;

        nextPlots[plot] = {
          ...nextPlots[plot],
          isComplete: isChoicePlotComplete(nextPlots[plot]),
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          choicePlots: nextPlots,
        });
      },
      updateScorePlot(varietyId, taskCode, plot, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'score_by_plot' || currentTask.completedAt) {
          return;
        }

        const nextPlots = {
          ...(currentTask.scorePlots || createEmptyScorePlots()),
          [plot]: {
            ...(currentTask.scorePlots?.[plot] || {
              plot,
              isComplete: false,
            }),
            ...changes,
          },
        } as Record<'1' | '2' | '3', ScorePlotDraft>;

        nextPlots[plot] = {
          ...nextPlots[plot],
          isComplete: isScorePlotComplete(nextPlots[plot]),
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          scorePlots: nextPlots,
        });
      },
      updateYieldPlot(varietyId, taskCode, plot, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'yield_by_plot' || currentTask.completedAt) {
          return;
        }

        const nextPlots = {
          ...(currentTask.yieldPlots || createEmptyYieldPlots()),
          [plot]: {
            ...(currentTask.yieldPlots?.[plot] || {
              plot,
              areaSquareMeters: 5,
              isComplete: false,
            }),
            ...changes,
          },
        } as Record<'1' | '2' | '3', YieldPlotDraft>;

        const currentPlot = nextPlots[plot];
        const mass = Number(currentPlot.rawGrainMassKg);
        const moisture = Number(currentPlot.moisturePercent);
        const isValid =
          currentPlot.rawGrainMassKg?.trim() &&
          currentPlot.moisturePercent?.trim() &&
          Number.isFinite(mass) &&
          Number.isFinite(moisture) &&
          mass > 0 &&
          moisture >= 0 &&
          moisture < 100;

        nextPlots[plot] = {
          ...currentPlot,
          areaSquareMeters: 5,
          yieldTonsPerHectare: isValid
            ? calculateYieldTonsPerHectare(mass, moisture, 5).toFixed(3)
            : '',
          isComplete: isValid ? isYieldPlotComplete({
            ...currentPlot,
            areaSquareMeters: 5,
            yieldTonsPerHectare: calculateYieldTonsPerHectare(mass, moisture, 5).toFixed(3),
          }) : false,
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          yieldPlots: nextPlots,
        });
      },
      updateThousandSeedWeight(varietyId, taskCode, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'thousand_seed_weight_step' || currentTask.completedAt) {
          return;
        }

        const nextDraft = {
          ...(currentTask.thousandSeedWeight || createEmptyThousandSeedWeightDraft()),
          ...changes,
        } as ThousandSeedWeightDraft;
        const resolved = resolveThousandSeedWeightOutcome(nextDraft, nextDraft.selectedPair);

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          thousandSeedWeight: {
            ...nextDraft,
            ...resolved,
          },
        });
      },
      selectThousandSeedWeightPair(varietyId, taskCode, pair) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'thousand_seed_weight_step' || currentTask.completedAt) {
          return;
        }

        const currentDraft = currentTask.thousandSeedWeight || createEmptyThousandSeedWeightDraft();
        const resolved = resolveThousandSeedWeightOutcome(currentDraft, pair);

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          thousandSeedWeight: {
            ...currentDraft,
            ...resolved,
          },
        });
      },
      updateProteinContent(varietyId, taskCode, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'protein_content_step' || currentTask.completedAt) {
          return;
        }

        const nextDraft = {
          ...(currentTask.proteinContent || createEmptyProteinContentDraft()),
          ...changes,
        } as ProteinContentDraft;
        const mass = Number(nextDraft.sampleMassGrams);
        const protein = Number(nextDraft.proteinPercent);

        nextDraft.sampleSource = 'средняя проба';
        nextDraft.analysisMethod = 'Инфракрасный анализатор';
        nextDraft.sampleToleranceStatus = resolveProteinToleranceStatus(nextDraft.sampleMassGrams);
        nextDraft.isComplete = Boolean(
          nextDraft.sampleMassGrams?.trim() &&
            nextDraft.proteinPercent?.trim() &&
            Number.isFinite(mass) &&
            Number.isFinite(protein) &&
            mass > 0 &&
            protein >= 0,
        );

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          proteinContent: nextDraft,
        });
      },
      updateFatContent(varietyId, taskCode, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'fat_content_step' || currentTask.completedAt) {
          return;
        }

        const nextDraft = {
          ...(currentTask.fatContent || createEmptyFatContentDraft()),
          ...changes,
        } as FatContentDraft;
        const mass = Number(nextDraft.sampleMassGrams);
        const fat = Number(nextDraft.fatPercent);

        nextDraft.sampleSource = 'средняя проба';
        nextDraft.analysisMethod = 'Инфракрасный анализатор';
        nextDraft.sampleToleranceStatus = resolveProteinToleranceStatus(nextDraft.sampleMassGrams);
        nextDraft.isComplete = Boolean(
          nextDraft.sampleMassGrams?.trim() &&
            nextDraft.fatPercent?.trim() &&
            Number.isFinite(mass) &&
            Number.isFinite(fat) &&
            mass > 0 &&
            fat >= 0,
        );

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          fatContent: nextDraft,
        });
      },
      updateSamplingPlot(varietyId, taskCode, samplingId, plot) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'structure_by_sampling' || currentTask.completedAt) {
          return;
        }

        const nextSamplings = {
          ...(currentTask.samplings || createEmptySamplings()),
          [samplingId]: {
            ...(currentTask.samplings?.[samplingId] || {
              samplingId,
              cards: [],
              isComplete: false,
            }),
            plot,
          },
        } as Record<'1' | '2', StructureSamplingDraft>;

        nextSamplings[samplingId] = {
          ...nextSamplings[samplingId],
          isComplete: isSamplingComplete(nextSamplings[samplingId]),
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          samplings: nextSamplings,
        });
      },
      addSamplingCard(varietyId, taskCode, samplingId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'structure_by_sampling' || currentTask.completedAt) {
          return;
        }

        const nextSamplings = {
          ...(currentTask.samplings || createEmptySamplings()),
        } as Record<'1' | '2', StructureSamplingDraft>;
        const currentSampling = nextSamplings[samplingId] || {
          samplingId,
          cards: [],
          isComplete: false,
        };

        nextSamplings[samplingId] = {
          ...currentSampling,
          cards: [
            ...currentSampling.cards,
            {
              id: createId('plant'),
              samplingId,
              isComplete: false,
            },
          ],
          isComplete: false,
        };

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          samplings: nextSamplings,
        });
      },
      updateSamplingCard(varietyId, taskCode, samplingId, cardId, changes) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'structure_by_sampling' || currentTask.completedAt) {
          return;
        }

        const nextSamplings = {
          ...(currentTask.samplings || createEmptySamplings()),
        } as Record<'1' | '2', StructureSamplingDraft>;
        const currentSampling = nextSamplings[samplingId];
        if (!currentSampling) {
          return;
        }

        nextSamplings[samplingId] = {
          ...currentSampling,
          cards: currentSampling.cards.map((card) => {
            if (card.id !== cardId || card.isComplete) {
              return card;
            }

            const nextCard = { ...card, ...changes };
            return {
              ...nextCard,
              isComplete: isStructureCardComplete(nextCard),
            };
          }),
        };
        nextSamplings[samplingId].isComplete = isSamplingComplete(nextSamplings[samplingId]);

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          samplings: nextSamplings,
        });
      },
      removeSamplingCard(varietyId, taskCode, samplingId, cardId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        if (currentTask.flowKind !== 'structure_by_sampling' || currentTask.completedAt) {
          return;
        }

        const nextSamplings = {
          ...(currentTask.samplings || createEmptySamplings()),
        } as Record<'1' | '2', StructureSamplingDraft>;
        const currentSampling = nextSamplings[samplingId];
        if (!currentSampling) {
          return;
        }

        const target = currentSampling.cards.find((card) => card.id === cardId);
        if (!target || target.isComplete) {
          return;
        }

        nextSamplings[samplingId] = {
          ...currentSampling,
          cards: currentSampling.cards.filter((card) => card.id !== cardId),
        };
        nextSamplings[samplingId].isComplete = isSamplingComplete(nextSamplings[samplingId]);

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          samplings: nextSamplings,
        });
      },
      async completeTaskCard(varietyId, taskCode, cardId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        const currentCard = currentTask.cards.find((card) => card.id === cardId);
        if (!currentCard) {
          throw new Error(v2Copy.localSyncError);
        }

        if (currentTask.flowKind === 'disease_cards') {
          if (!currentCard.photoUri) {
            throw new Error(v2Copy.taskDiseasePhotoRequired);
          }
          if (!currentCard.rowNumber?.trim()) {
            throw new Error(v2Copy.taskDiseaseRowRequired);
          }
          if (!currentCard.plot) {
            throw new Error(v2Copy.taskDiseasePlotRequired);
          }
          if (!currentCard.capturedAt || !currentCard.capturedLocation?.mapsUrl) {
            throw new Error(v2Copy.taskDiseaseLocationRequired);
          }
          const taskDef = taskDefinitionsByCode[taskCode];
          if (!taskDef?.logicalSheetKey) {
            throw new Error(v2Copy.localSyncError);
          }

          const now = new Date().toISOString();
          const operation: QueuedOperation = {
            id: createId('queue'),
            type: 'write_sheet',
            varietyId,
            screenId: taskCode,
            status: 'queued',
            idempotencyKey: `${varietyId}:${taskCode}:${cardId}:${now}`,
            createdAt: now,
            updatedAt: now,
            retryCount: 0,
            payload: {
              kind: 'disease_card',
              logicalSheetKey: taskDef.logicalSheetKey,
              taskCode,
              cardId,
              plot: currentCard.plot,
              rowNumber: currentCard.rowNumber,
              plantNumber: currentCard.plantNumber,
              photoUri: currentCard.photoUri,
              capturedAt: currentCard.capturedAt,
              capturedLocation: currentCard.capturedLocation,
            },
            media: currentCard.photoUri
              ? [{
                  localUri: currentCard.photoUri,
                  mimeType: 'image/jpeg',
                  targetSheet: taskDef.logicalSheetKey
                    ? SHEET_ALIASES[taskDef.logicalSheetKey].futureRemote
                    : currentTask.title,
                  capturedAt: currentCard.capturedAt,
                }]
              : [],
          };

          const nextQueue = [operation, ...stateRef.current.syncQueue];
          const nextTask: InspectionTask = {
            ...currentTask,
            completedAt: currentTask.completedAt || now,
            updatedAt: now,
            cardsCompleted: true,
            cards: currentTask.cards.map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    note: card.note || currentTask.title,
                    isComplete: true,
                    syncStatus: 'queued',
                    queuedOperationId: operation.id,
                  }
                : card,
            ),
          };

          setState((current) => ({
            ...current,
            syncQueue: nextQueue,
            catalog: current.catalog.map((item) =>
              item.id === varietyId
                ? { ...item, status: 'syncing', updatedAt: now }
                : item,
            ),
            inspections: {
              ...current.inspections,
              [varietyId]: {
                ...current.inspections[varietyId],
                [taskCode]: {
                  ...nextTask,
                  uiStatus: getTaskUiStatus(varietyId, nextTask, nextQueue),
                },
              },
            },
          }));
          await processQueueInternal(nextQueue);
          return;
        }

        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: currentTask.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  note: card.note || currentTask.title,
                  isComplete: currentTask.flowKind === 'measurement_cards'
                    ? isMeasurementCardComplete(card)
                    : card.isComplete,
                }
              : card,
          ),
        });
      },
      removeTaskCard(varietyId, taskCode, cardId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        const target = currentTask.cards.find((card) => card.id === cardId);
        if (!target) {
          return;
        }
        if (currentTask.flowKind === 'disease_cards' && isLockedDiseaseCard(target)) {
          return;
        }
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: currentTask.cards.filter((card) => card.id !== cardId),
        });
      },
      completeTaskLocally(varietyId, taskCode) {
        const currentTask = getTaskInternal(varietyId, taskCode);

        if (currentTask.flowKind === 'disease_cards') {
          if (!currentTask.cards.length || currentTask.cards.some((card) => isDraftDiseaseCard(card))) {
            throw new Error(v2Copy.taskInfectionCardsRequired);
          }
        } else if (currentTask.flowKind === 'phenology_by_plot') {
          if (
            !currentTask.phenologyPlots ||
            !Object.values(currentTask.phenologyPlots).every(isPhenologyPlotComplete)
          ) {
            throw new Error(v2Copy.taskOverviewRequired);
          }
        } else if (currentTask.flowKind === 'choice_by_plot') {
          if (
            !currentTask.choicePlots ||
            !Object.values(currentTask.choicePlots).every(isChoicePlotComplete)
          ) {
            throw new Error(v2Copy.taskOverviewRequired);
          }
        } else if (currentTask.flowKind === 'score_by_plot') {
          if (
            !currentTask.scorePlots ||
            !Object.values(currentTask.scorePlots).every(isScorePlotComplete)
          ) {
            throw new Error(v2Copy.taskOverviewRequired);
          }
        } else if (currentTask.flowKind === 'yield_by_plot') {
          if (
            !currentTask.yieldPlots ||
            !Object.values(currentTask.yieldPlots).every(isYieldPlotComplete)
          ) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'thousand_seed_weight_step') {
          if (!isThousandSeedWeightCompletable(currentTask.thousandSeedWeight)) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'protein_content_step') {
          if (!isProteinContentCompletable(currentTask.proteinContent)) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'fat_content_step') {
          if (!isFatContentCompletable(currentTask.fatContent)) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'structure_by_sampling') {
          if (
            !currentTask.samplings ||
            !Object.values(currentTask.samplings).every(isSamplingComplete)
          ) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'measurement_cards') {
          if (!currentTask.cards.length || !currentTask.cards.every(isMeasurementCardComplete)) {
            throw new Error(v2Copy.taskMeasurementRequired);
          }
        } else if (currentTask.flowKind === 'placeholder_pending_spec') {
          if (!isPlaceholderTaskComplete(currentTask)) {
            throw new Error(v2Copy.taskPlaceholderRequired);
          }
        }

        const nextQueue = stripTaskQueueEntries(stateRef.current.syncQueue, varietyId, taskCode);
        saveTask(
          varietyId,
          taskCode,
          finalizeTask(varietyId, currentTask, nextQueue),
          nextQueue,
        );
      },
      async queueTaskSubmission(varietyId, taskCode) {
        const variety = stateRef.current.catalog.find((item) => item.id === varietyId);
        if (!variety) {
          throw new Error(v2Copy.varietyNotFound);
        }

        const task = getTaskInternal(varietyId, taskCode);
        if (!task.completedAt) {
          throw new Error(v2Copy.completeTaskBeforeQueue);
        }

        const taskDef = taskDefinitionsByCode[taskCode];
        if (
          (
            task.flowKind === 'phenology_by_plot' ||
            task.flowKind === 'choice_by_plot' ||
            task.flowKind === 'score_by_plot' ||
              task.flowKind === 'yield_by_plot' ||
              task.flowKind === 'thousand_seed_weight_step' ||
              task.flowKind === 'protein_content_step' ||
              task.flowKind === 'fat_content_step' ||
              task.flowKind === 'structure_by_sampling'
            ) &&
            !taskDef?.logicalSheetKey
          ) {
            throw new Error(v2Copy.localSyncError);
        }
        const operation: QueuedOperation =
          task.flowKind === 'phenology_by_plot'
            ? {
                id: createId('queue'),
                type: 'write_sheet',
                varietyId,
                screenId: taskCode,
                status: 'queued',
                idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                retryCount: 0,
                payload: {
                  kind: 'phenology_step',
                  taskCode,
                  logicalSheetKey: taskDef.logicalSheetKey,
                  plots: task.phenologyPlots,
                },
                  media: Object.values(task.phenologyPlots || {})
                    .filter((plot) => plot.photoUri)
                    .map((plot) => ({
                      localUri: plot.photoUri as string,
                      mimeType: 'image/jpeg' as const,
                      targetSheet: taskDef.logicalSheetKey ? SHEET_ALIASES[taskDef.logicalSheetKey].futureRemote : task.title,
                      capturedAt: plot.capturedAt,
                    })),
              }
            : task.flowKind === 'choice_by_plot'
              ? {
                  id: createId('queue'),
                  type: 'write_sheet',
                  varietyId,
                  screenId: taskCode,
                  status: 'queued',
                  idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  retryCount: 0,
                  payload: {
                    kind: 'choice_step',
                    taskCode,
                    logicalSheetKey: taskDef.logicalSheetKey,
                    plots: task.choicePlots,
                  },
                  media: Object.values(task.choicePlots || {})
                    .filter((plot) => plot.photoUri)
                    .map((plot) => ({
                      localUri: plot.photoUri as string,
                      mimeType: 'image/jpeg' as const,
                      targetSheet: taskDef.logicalSheetKey ? SHEET_ALIASES[taskDef.logicalSheetKey].futureRemote : task.title,
                      capturedAt: plot.capturedAt,
                    })),
                }
              : task.flowKind === 'score_by_plot'
                ? {
                    id: createId('queue'),
                    type: 'write_sheet',
                    varietyId,
                    screenId: taskCode,
                    status: 'queued',
                    idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    retryCount: 0,
                    payload: {
                      kind: 'score_step',
                      taskCode,
                      logicalSheetKey: taskDef.logicalSheetKey,
                      plots: task.scorePlots,
                    },
                    media: Object.values(task.scorePlots || {})
                      .filter((plot) => plot.photoUri)
                      .map((plot) => ({
                        localUri: plot.photoUri as string,
                        mimeType: 'image/jpeg' as const,
                        targetSheet: taskDef.logicalSheetKey ? SHEET_ALIASES[taskDef.logicalSheetKey].futureRemote : task.title,
                        capturedAt: plot.capturedAt,
                      })),
                  }
              : task.flowKind === 'yield_by_plot'
                ? {
                    id: createId('queue'),
                    type: 'write_sheet',
                    varietyId,
                    screenId: taskCode,
                    status: 'queued',
                    idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    retryCount: 0,
                    payload: {
                      kind: 'yield_step',
                      taskCode,
                      logicalSheetKey: taskDef.logicalSheetKey,
                      plots: task.yieldPlots,
                    },
                    media: [],
                  }
              : task.flowKind === 'thousand_seed_weight_step'
                ? {
                    id: createId('queue'),
                    type: 'write_sheet',
                    varietyId,
                    screenId: taskCode,
                    status: 'queued',
                    idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    retryCount: 0,
                    payload: {
                      kind: 'thousand_seed_weight_step',
                      taskCode,
                      logicalSheetKey: taskDef.logicalSheetKey,
                      draft: task.thousandSeedWeight,
                    },
                    media: [],
                  }
                : task.flowKind === 'protein_content_step'
                  ? {
                      id: createId('queue'),
                      type: 'write_sheet',
                    varietyId,
                    screenId: taskCode,
                    status: 'queued',
                    idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    retryCount: 0,
                    payload: {
                      kind: 'protein_content_step',
                      taskCode,
                      logicalSheetKey: taskDef.logicalSheetKey,
                      draft: task.proteinContent,
                      },
                      media: [],
                    }
                : task.flowKind === 'fat_content_step'
                  ? {
                      id: createId('queue'),
                      type: 'write_sheet',
                      varietyId,
                      screenId: taskCode,
                      status: 'queued',
                      idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      retryCount: 0,
                      payload: {
                        kind: 'fat_content_step',
                        taskCode,
                        logicalSheetKey: taskDef.logicalSheetKey,
                        draft: task.fatContent,
                      },
                      media: [],
                    }
                : task.flowKind === 'structure_by_sampling'
                  ? {
                    id: createId('queue'),
                    type: 'write_sheet',
                    varietyId,
                    screenId: taskCode,
                    status: 'queued',
                    idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    retryCount: 0,
                    payload: {
                      kind: 'structure_sampling_step',
                      taskCode,
                      logicalSheetKey: taskDef.logicalSheetKey,
                      samplings: task.samplings,
                    },
                    media: Object.values(task.samplings || {})
                      .flatMap((sampling) => sampling.cards)
                      .filter((card) => card.photoUri)
                      .map((card) => ({
                        localUri: card.photoUri as string,
                        mimeType: 'image/jpeg' as const,
                        targetSheet: taskDef.logicalSheetKey ? SHEET_ALIASES[taskDef.logicalSheetKey].futureRemote : task.title,
                        capturedAt: card.capturedAt,
                      })),
                  }
            : {
                id: createId('queue'),
                type: 'submit_task',
                varietyId,
                screenId: taskCode,
                status: 'queued',
                idempotencyKey: `${variety.binding.spreadsheetId}:${taskCode}:${task.updatedAt}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                retryCount: 0,
                payload: {
                  taskCode,
                  title: task.title,
                },
                writes: templateService.buildTaskWrites(
                  variety,
                  task,
                  variety.setup?.mapsUrl,
                  stateRef.current.session?.email,
                ),
                media: [
                  ...(task.overviewPhotoUri
                    ? [{
                        localUri: task.overviewPhotoUri,
                        mimeType: 'image/jpeg' as const,
                        targetSheet: taskDef?.futureRemoteSheetName || task.title,
                        capturedAt: task.completedAt,
                      }]
                    : []),
                  ...task.cards
                    .filter((card) => card.photoUri)
                    .map((card) => ({
                      localUri: card.photoUri as string,
                      mimeType: 'image/jpeg' as const,
                      targetSheet: taskDef?.futureRemoteSheetName || task.title,
                      capturedAt: card.capturedAt,
                    })),
                ],
              };

        const nextQueue = [
          operation,
          ...stripTaskQueueEntries(stateRef.current.syncQueue, varietyId, taskCode),
        ];

        setState((current) => ({
          ...current,
          syncQueue: nextQueue,
          catalog: current.catalog.map((item) =>
            item.id === varietyId
              ? { ...item, status: 'syncing', updatedAt: new Date().toISOString() }
              : item,
          ),
          inspections: {
            ...current.inspections,
            [varietyId]: {
              ...current.inspections[varietyId],
              [taskCode]: {
                ...task,
                uiStatus: getTaskUiStatus(varietyId, task, nextQueue),
              },
            },
          },
        }));

        await processQueueInternal(nextQueue);
      },
      async processQueue() {
        await processQueueInternal();
      },
    }),
    [creationStepIndex, hydrated, online, state],
  );

  return <V2AppContext.Provider value={value}>{children}</V2AppContext.Provider>;
}

export function useV2App() {
  const context = useContext(V2AppContext);
  if (!context) {
    throw new Error('useV2App must be used within V2AppProvider');
  }

  return context;
}
