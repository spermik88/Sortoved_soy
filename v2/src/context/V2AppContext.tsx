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
import { v2Repository } from '../repositories/v2Repository';
import { clipboardService } from '../services/clipboardService';
import { locationService } from '../services/locationService';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { isValidGoogleSheetsUrl } from '../services/sheetsService';
import { templateService } from '../services/templateService';
import {
  AuthMode,
  InspectionCardDraft,
  InspectionTask,
  PersistedV2State,
  QueuedOperation,
  TaskUiStatus,
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
    return gid
      ? `${v2Copy.importedVarietyPrefix} ${gid}`
      : v2Copy.importedVarietyFallback;
  } catch {
    return v2Copy.importedVarietyFallback;
  }
}

function getTaskQueueEntries(
  queue: QueuedOperation[],
  varietyId: string,
  taskCode: string,
) {
  return queue
    .filter(
      (item) =>
        item.type === 'submit_task' &&
        item.varietyId === varietyId &&
        item.screenId === taskCode,
    )
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

function stripTaskQueueEntries(
  queue: QueuedOperation[],
  varietyId: string,
  taskCode: string,
) {
  return queue.filter(
    (item) =>
      !(
        item.type === 'submit_task' &&
        item.varietyId === varietyId &&
        item.screenId === taskCode
      ),
  );
}

function getTaskUiStatus(
  varietyId: string,
  task: InspectionTask,
  queue: QueuedOperation[],
): TaskUiStatus {
  const [taskQueue] = getTaskQueueEntries(queue, varietyId, task.code);

  if (taskQueue?.status === 'synced') {
    return 'processed';
  }

  if (taskQueue && ['queued', 'processing'].includes(taskQueue.status)) {
    return 'queued';
  }

  if (task.completedAt) {
    return 'ready_local';
  }

  if (task.overviewPhotoUri || task.cards.length) {
    return 'draft';
  }

  return 'not_started';
}

function isInfectionCardComplete(card: InspectionCardDraft) {
  return Boolean(
    card.photoUri &&
      card.note.trim() &&
      card.rowNumber?.trim() &&
      card.plantNumber?.trim(),
  );
}

function isMeasurementCardComplete(card: InspectionCardDraft) {
  return Boolean(card.photoUri && card.value?.trim() && card.plot?.trim());
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
        : task.flowKind === 'infection_split'
          ? task.cards.length > 0 && task.cards.every(isInfectionCardComplete)
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
  completeTaskCard(varietyId: string, taskCode: string, cardId: string): void;
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

  async function processQueueInternal(queueOverride?: QueuedOperation[]) {
    const queue = queueOverride || stateRef.current.syncQueue;
    for (const item of queue) {
      if (!['queued', 'failed'].includes(item.status)) {
        continue;
      }

      try {
        setState((current) => {
          const baseQueue = queueOverride || current.syncQueue;
          return {
            ...current,
            syncQueue: baseQueue.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: 'processing', updatedAt: new Date().toISOString() }
                : entry,
            ),
          };
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        setState((current) => {
          const baseQueue = queueOverride || current.syncQueue;
          const nextQueue: QueuedOperation[] = baseQueue.map((entry) =>
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
        setState((current) => ({
          ...current,
          syncQueue: current.syncQueue.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'failed',
                  retryCount: entry.retryCount + 1,
                  updatedAt: new Date().toISOString(),
                  lastError:
                    error instanceof Error ? error.message : v2Copy.localSyncError,
                }
              : entry,
          ),
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
        }));
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
        completedAt: undefined,
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
            if (card.isComplete && !('isComplete' in changes)) {
              return card;
            }

            const nextCard = { ...card, ...changes };
            return {
              ...nextCard,
              isComplete: isMeasurement
                ? isMeasurementCardComplete(nextCard)
                : isInfectionCardComplete(nextCard),
            };
          }),
        });
      },
      completeTaskCard(varietyId, taskCode, cardId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: currentTask.cards.map((card) => {
            if (card.id !== cardId) {
              return card;
            }
            if (currentTask.flowKind === 'infection_split' && !isInfectionCardComplete(card)) {
              throw new Error(v2Copy.taskInfectionCardsRequired);
            }
            if (currentTask.flowKind === 'measurement_cards' && !isMeasurementCardComplete(card)) {
              throw new Error(v2Copy.taskMeasurementRequired);
            }

            return {
              ...card,
              note: card.note || currentTask.title,
              isComplete: true,
            };
          }),
        });
      },
      removeTaskCard(varietyId, taskCode, cardId) {
        const currentTask = getTaskInternal(varietyId, taskCode);
        saveDraftTask(varietyId, taskCode, {
          ...currentTask,
          cards: currentTask.cards.filter((card) => card.id !== cardId),
        });
      },
      completeTaskLocally(varietyId, taskCode) {
        const currentTask = getTaskInternal(varietyId, taskCode);

        if (currentTask.flowKind === 'infection_split') {
          if (!currentTask.overviewCompleted) {
            throw new Error(v2Copy.taskOverviewStepRequired);
          }
          if (!currentTask.cards.length || !currentTask.cards.every((card) => card.isComplete)) {
            throw new Error(v2Copy.taskInfectionCardsRequired);
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
          finalizeTask(
            varietyId,
            {
              ...currentTask,
              cardsCompleted: currentTask.cards.length > 0,
            },
            nextQueue,
          ),
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

        const operation: QueuedOperation = {
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

        setState((current) => {

          return {
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
          };
        });

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
