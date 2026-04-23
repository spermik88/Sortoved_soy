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
import { SHEET_ALIASES } from '../config/templateSchema';
import { v2Repository } from '../repositories/v2Repository';
import { clipboardService } from '../services/clipboardService';
import { locationService } from '../services/locationService';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { isValidGoogleSheetsUrl } from '../services/sheetsService';
import {
  calculateYieldTonsPerHectare,
  resolveThousandSeedWeightOutcome,
  templateService,
} from '../services/templateService';
import {
  AuthMode,
  CandidatePairResult,
  ChoicePlotDraft,
  ChoiceSheetKey,
  DiseaseSheetKey,
  InspectionCardDraft,
  InspectionTask,
  LocalSheetKey,
  PhenologyPlotDraft,
  PhenologySheetKey,
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

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
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

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
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

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
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

    if (taskQueue && ['queued', 'processing', 'failed'].includes(taskQueue.status)) {
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
  return {
    ...stored,
    inspections: normalizeInspections(stored.inspections, stored.syncQueue),
  };
}

interface V2ContextValue {
  hydrated: boolean;
  state: PersistedV2State;
  online: boolean;
  prepareMode(mode: AuthMode): Promise<void>;
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
    Promise.all([v2Repository.load(), isInternetReachable()]).then(([stored, isOnline]) => {
      setOnline(isOnline);
      setState(stored ? normalizeState(stored) : initialState);
      setHydrated(true);
    });
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
    });

    return () => sub.remove();
  }, []);

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
    const queue = queueOverride || stateRef.current.syncQueue;
    for (const item of queue) {
      if (!['queued', 'failed'].includes(item.status)) {
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
          (item.payload as Record<string, unknown>).kind === 'structure_sampling_step'
        ) {
          await processStructureSamplingStepOperation(item);
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        setState((current) => {
          const nextQueue: QueuedOperation[] = current.syncQueue.map((entry) =>
            entry.id === item.id
              ? ({
                  ...entry,
                  status: 'synced',
                  updatedAt: new Date().toISOString(),
                  lastError: undefined,
                } satisfies QueuedOperation)
              : entry,
          );

          return {
            ...current,
            syncQueue: nextQueue,
            catalog: current.catalog.map((variety) =>
              variety.id === item.varietyId
                ? {
                    ...variety,
                    status: 'ready',
                    updatedAt: new Date().toISOString(),
                    lastError: undefined,
                  }
                : variety,
            ),
            inspections: normalizeInspections(current.inspections, nextQueue),
          };
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

          return {
            ...current,
            syncQueue: nextQueue,
            catalog: current.catalog.map((variety) =>
              variety.id === item.varietyId
                ? {
                    ...variety,
                    status: 'error',
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
                              syncStatus: 'failed',
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
                                  syncStatus: 'failed',
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
      async prepareMode(mode) {
        setState((current) => ({ ...current, pendingAuthMode: mode }));
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
        const title = buildImportedVarietyTitle(raw);
        const record: VarietyRecord = {
          id: varietyId,
          title,
          source: 'linked',
          binding: buildLocalBinding(varietyId, title, 'linked', raw),
          setup: createWorkbookSetup(varietyId),
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
        const draft = stateRef.current.creationDraft;
        if (!draft) {
          throw new Error(v2Copy.creationDraftMissing);
        }

        const title = normalizeTitle(draft.varietyName);
        if (!title) {
          throw new Error(v2Copy.varietyNameRequired);
        }

        const varietyId = createId('variety');
        const workbookWrites = templateService.buildCreationWrites(draft);
        const now = new Date().toISOString();
        const record: VarietyRecord = {
          id: varietyId,
          title,
          source: 'created',
          binding: buildLocalBinding(varietyId, title, 'created'),
          setup: {
            mapsUrl: draft.mapsUrl,
            plotPhotos: {
              '1': draft.plots['1'].photoUri,
              '2': draft.plots['2'].photoUri,
              '3': draft.plots['3'].photoUri,
            },
            ...createWorkbookSetup(varietyId, draft),
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
            })),
        };

        setState((current) => ({
          ...current,
          catalog: [...current.catalog, record],
          creationDraft: null,
          pendingAuthMode: null,
          syncQueue: [operation, ...current.syncQueue],
        }));
        setCreationStepIndex(0);
        await processQueueInternal([operation, ...stateRef.current.syncQueue]);
        return record;
      },
      getVariety(varietyId) {
        return state.catalog.find((item) => item.id === varietyId);
      },
      getTask(varietyId, taskCode) {
        return getTaskFromState(state, varietyId, taskCode);
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
              ? [{ localUri: currentCard.photoUri, mimeType: 'image/jpeg' }]
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
                    ? [{ localUri: task.overviewPhotoUri, mimeType: 'image/jpeg' as const }]
                    : []),
                  ...task.cards
                    .filter((card) => card.photoUri)
                    .map((card) => ({
                      localUri: card.photoUri as string,
                      mimeType: 'image/jpeg' as const,
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
