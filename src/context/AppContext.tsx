import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ENABLED_TRAIT_CODES, createEmptyTraitStatuses } from '../constants/traits';
import { collectorRepository } from '../repositories/collectorRepository';
import { t } from '../i18n';
import { mockSyncAdapter } from '../services/mockSyncAdapter';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { qrResolver } from '../services/qrResolver';
import {
  AccountRole,
  InfectionCard,
  MeasurementCardDraft,
  MeasurementSubplotDraft,
  PersistedAppState,
  SyncTask,
  SyncTaskStatus,
  TraitCode,
  TraitDraft,
  TraitPlotDraft,
  TraitState,
  VarietyLink,
} from '../types/app';
import { createId } from '../utils/id';
import {
  computeTraitState,
  createMeasurementCardDraft,
  getCompletedPlotsCount as countCompletedPlots,
  getLatestPlotStatus,
  getMeasurementSubplot,
  getOrCreateMeasurementDraft,
  getOrCreatePlotDraft,
  getSyncedPlotsCount as countSyncedPlots,
  isInfectionCardComplete,
  isMeasurementCardComplete,
  isTraitFullySynced,
  isTraitRouteCompleted,
} from './appStateUtils';

const initialState: PersistedAppState = {
  activeRole: null,
  firstLaunchCompleted: false,
  collectorMode: null,
  varieties: [],
  pendingVariety: null,
  traitDrafts: {},
  syncQueue: [],
  syncHistory: [],
};

function createTestVariety(): VarietyLink {
  return {
    id: 'test-variety',
    title: 'Тестовый сорт',
    sheetUrl: 'local://test-variety',
    sourceMode: 'test',
    plotPhotos: [1, 2, 3].map((plotIndex) => ({
      plotIndex,
      mapsUrl: `https://maps.google.com/?q=test-${plotIndex}`,
      isPlaceholder: true,
    })),
    traitStatuses: createEmptyTraitStatuses(),
  };
}

function ensureTraitStatuses(variety: VarietyLink): VarietyLink {
  return {
    ...variety,
    traitStatuses: {
      ...createEmptyTraitStatuses(),
      ...variety.traitStatuses,
    },
  };
}

function ensureTestVariety(state: PersistedAppState): PersistedAppState {
  const hasTestVariety = state.varieties.some((variety) => variety.id === 'test-variety');

  if (hasTestVariety) {
    return state;
  }

  return {
    ...state,
    varieties: [...state.varieties, createTestVariety()],
  };
}

function getTraitDraft(
  state: PersistedAppState,
  varietyId: string,
  traitCode: TraitCode,
): TraitDraft | undefined {
  return state.traitDrafts[varietyId]?.[traitCode];
}

function withUpdatedTraitDraft(
  state: PersistedAppState,
  varietyId: string,
  traitCode: TraitCode,
  update: (draft: TraitDraft | undefined) => TraitDraft,
): PersistedAppState {
  const varietyDrafts = state.traitDrafts[varietyId] || {};

  return {
    ...state,
    traitDrafts: {
      ...state.traitDrafts,
      [varietyId]: {
        ...varietyDrafts,
        [traitCode]: update(varietyDrafts[traitCode]),
      },
    },
  };
}

function updateVarietyTraitStatus(
  state: PersistedAppState,
  varietyId: string,
  traitCode: TraitCode,
): PersistedAppState {
  const traitState = computeTraitState(getTraitDraft(state, varietyId, traitCode));

  return {
    ...state,
    varieties: state.varieties.map((variety) =>
      variety.id === varietyId
        ? {
            ...variety,
            traitStatuses: {
              ...variety.traitStatuses,
              [traitCode]: traitState,
            },
          }
        : variety,
    ),
  };
}

function updateMeasurementSubplot(
  subplot: MeasurementSubplotDraft,
  changes: Partial<MeasurementSubplotDraft>,
): MeasurementSubplotDraft {
  return {
    ...subplot,
    ...changes,
  };
}

function updateMeasurementCardList(
  cards: MeasurementCardDraft[],
  cardId: string,
  changes: Partial<MeasurementCardDraft>,
) {
  return cards.map((card) => {
    if (card.id !== cardId) {
      return card;
    }

    const nextCard = {
      ...card,
      ...changes,
    };

    return {
      ...nextCard,
      isComplete: isMeasurementCardComplete(nextCard),
    };
  });
}

interface AppContextValue {
  hydrated: boolean;
  state: PersistedAppState;
  selectRole: (role: AccountRole) => void;
  switchRole: (role: AccountRole) => void;
  enableTestMode: () => void;
  scanQr: (rawValue: string) => { duplicate: boolean; invalid?: string };
  confirmPendingVariety: () => void;
  clearPendingVariety: () => void;
  saveOverviewPhoto: (traitCode: TraitCode, varietyId: string, plotIndex: number, uri: string) => void;
  addInfectionCard: (traitCode: TraitCode, varietyId: string, plotIndex: number) => void;
  updateInfectionCard: (
    traitCode: TraitCode,
    varietyId: string,
    plotIndex: number,
    cardId: string,
    changes: Partial<InfectionCard>,
  ) => void;
  removeInfectionCard: (
    traitCode: TraitCode,
    varietyId: string,
    plotIndex: number,
    cardId: string,
  ) => void;
  confirmTraitPlot: (traitCode: TraitCode, varietyId: string, plotIndex: number) => void;
  getTraitPlotDraft: (traitCode: TraitCode, varietyId: string, plotIndex: number) => TraitPlotDraft;
  saveMeasurementSubplotPhoto: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
    uri: string,
  ) => void;
  confirmMeasurementSubplotPhoto: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
  ) => void;
  setMeasurementSubplotPlantCount: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
    plantCount: string,
  ) => void;
  addMeasurementCard: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
  ) => void;
  updateMeasurementCard: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
    cardId: string,
    changes: Partial<MeasurementCardDraft>,
  ) => void;
  completeMeasurementCard: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
    cardId: string,
  ) => void;
  toggleMeasurementCardCollapsed: (
    traitCode: TraitCode,
    varietyId: string,
    subplot: 'A' | 'B',
    cardId: string,
  ) => void;
  setMeasurementCurrentStep: (
    traitCode: TraitCode,
    varietyId: string,
    step: 1 | 2 | 3 | 4,
  ) => void;
  completeMeasurementTrait: (traitCode: TraitCode, varietyId: string) => void;
  getMeasurementTraitDraft: (traitCode: TraitCode, varietyId: string) => TraitDraft['measurement'];
  getNextTraitPlot: (traitCode: TraitCode, varietyId: string) => number;
  getCompletedPlotsCount: (traitCode: TraitCode, varietyId: string) => number;
  getSyncedPlotsCount: (traitCode: TraitCode, varietyId: string) => number;
  getLatestVarietySyncStatus: (
    traitCode: TraitCode,
    varietyId: string,
  ) => TraitPlotDraft['syncStatus'] | SyncTaskStatus | 'idle';
  getAggregateTraitState: (varietyId: string) => TraitState;
  getTraitCheckboxState: (
    traitCode: TraitCode,
    varietyId: string,
  ) => 'not_started' | 'completed_pending_sync' | 'fully_synced';
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedAppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    collectorRepository.load().then((stored) => {
      if (stored) {
        setState({
          ...stored,
          traitDrafts: stored.traitDrafts || {},
          varieties: stored.varieties.map(ensureTraitStatuses),
        });
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void collectorRepository.save(state);
  }, [hydrated, state]);

  async function processTask(taskId: string): Promise<'synced' | 'queued'> {
    const taskSnapshot = stateRef.current.syncQueue.find((task) => task.id === taskId);
    const now = new Date().toISOString();
    const isOnline = await isInternetReachable();

    if (!taskSnapshot) {
      return 'queued';
    }

    if (!isOnline) {
      setState((current) => {
        const nextState = withUpdatedTraitDraft(
          current,
          taskSnapshot.varietyId,
          taskSnapshot.traitCode,
          (draft) => ({
            varietyId: taskSnapshot.varietyId,
            traitCode: taskSnapshot.traitCode,
            lastUpdated: now,
            measurement: draft?.measurement,
            plots: {
              ...draft?.plots,
              [String(taskSnapshot.plotIndex)]: {
                ...getOrCreatePlotDraft(draft, taskSnapshot.plotIndex),
                syncStatus: 'queued',
                lastQueuedAt: now,
              },
            },
          }),
        );

        const queuedState = {
          ...nextState,
          syncQueue: current.syncQueue.map((task) =>
            task.id === taskId
              ? { ...task, status: 'waiting_for_network' as const, updatedAt: now }
              : task,
          ),
        };

        return updateVarietyTraitStatus(
          queuedState,
          taskSnapshot.varietyId,
          taskSnapshot.traitCode,
        );
      });
      return 'queued';
    }

    setState((current) => {
      const nextState = withUpdatedTraitDraft(
        current,
        taskSnapshot.varietyId,
        taskSnapshot.traitCode,
        (draft) => ({
          varietyId: taskSnapshot.varietyId,
          traitCode: taskSnapshot.traitCode,
          lastUpdated: now,
          measurement: draft?.measurement,
          plots: {
            ...draft?.plots,
            [String(taskSnapshot.plotIndex)]: {
              ...getOrCreatePlotDraft(draft, taskSnapshot.plotIndex),
              syncStatus: 'syncing',
            },
          },
        }),
      );

      const processingState = {
        ...nextState,
        syncQueue: current.syncQueue.map((task) =>
          task.id === taskId
            ? { ...task, status: 'processing' as const, updatedAt: now }
            : task,
        ),
      };

      return updateVarietyTraitStatus(
        processingState,
        taskSnapshot.varietyId,
        taskSnapshot.traitCode,
      );
    });

    await mockSyncAdapter.process(taskSnapshot);

    setState((current) => {
      const completedTask = current.syncQueue.find((task) => task.id === taskId);

      if (!completedTask) {
        return current;
      }

      const nextState = withUpdatedTraitDraft(
        current,
        completedTask.varietyId,
        completedTask.traitCode,
        (draft) => ({
          varietyId: completedTask.varietyId,
          traitCode: completedTask.traitCode,
          lastUpdated: new Date().toISOString(),
          measurement: draft?.measurement,
          plots: {
            ...draft?.plots,
            [String(completedTask.plotIndex)]: {
              ...getOrCreatePlotDraft(draft, completedTask.plotIndex),
              syncStatus: 'synced',
              lastSyncAt: new Date().toISOString(),
            },
          },
        }),
      );

      const completedState = {
        ...nextState,
        syncQueue: current.syncQueue.filter((task) => task.id !== taskId),
        syncHistory: [
          {
            ...completedTask,
            status: 'success' as const,
            updatedAt: new Date().toISOString(),
          },
          ...current.syncHistory,
        ],
      };

      return updateVarietyTraitStatus(
        completedState,
        completedTask.varietyId,
        completedTask.traitCode,
      );
    });

    return 'synced';
  }

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const subscription = subscribeToNetwork((isConnected) => {
      if (!isConnected) {
        return;
      }

      const queue = stateRef.current.syncQueue.filter((task) =>
        ['queued', 'waiting_for_network'].includes(task.status),
      );

      queue.forEach((task) => {
        void processTask(task.id);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [hydrated]);

  const value = useMemo<AppContextValue>(
    () => ({
      hydrated,
      state,
      selectRole(role) {
        setState((current) => ({
          ...current,
          activeRole: role,
          firstLaunchCompleted: true,
          collectorMode: role === 'collector' ? current.collectorMode : null,
        }));
      },
      switchRole(role) {
        setState({
          ...initialState,
          activeRole: role,
          firstLaunchCompleted: true,
        });
      },
      enableTestMode() {
        setState((current) =>
          ensureTestVariety({
            ...current,
            activeRole: 'collector',
            firstLaunchCompleted: true,
            collectorMode: 'test',
            pendingVariety: null,
          }),
        );
      },
      scanQr(rawValue) {
        try {
          const resolved = qrResolver.resolve(
            rawValue,
            stateRef.current.varieties
              .filter((variety) => variety.sourceMode === 'linked')
              .map((variety) => variety.sheetUrl),
          );

          if (resolved.duplicateStatus) {
            return { duplicate: true };
          }

          setState((current) => ({
            ...current,
            collectorMode: 'linked',
            pendingVariety: {
              id: resolved.id,
              sheetUrl: resolved.sheetUrl,
              title: resolved.title,
              plotPhotos: resolved.plotPhotos,
            },
          }));

          return { duplicate: false };
        } catch (error) {
          return {
            duplicate: false,
            invalid: error instanceof Error ? error.message : t('qr.invalidGeneric'),
          };
        }
      },
      confirmPendingVariety() {
        setState((current) => {
          if (!current.pendingVariety) {
            return current;
          }

          return {
            ...current,
            collectorMode: 'linked',
            pendingVariety: null,
            varieties: [
              ...current.varieties.filter(
                (variety) =>
                  variety.id !== 'test-variety' &&
                  variety.sheetUrl !== current.pendingVariety?.sheetUrl,
              ),
              {
                id: current.pendingVariety.id,
                sheetUrl: current.pendingVariety.sheetUrl,
                title: current.pendingVariety.title,
                sourceMode: 'linked',
                plotPhotos: current.pendingVariety.plotPhotos,
                traitStatuses: createEmptyTraitStatuses(),
              },
            ],
          };
        });
      },
      clearPendingVariety() {
        setState((current) => ({
          ...current,
          pendingVariety: null,
        }));
      },
      saveOverviewPhoto(traitCode, varietyId, plotIndex, uri) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => ({
            varietyId,
            traitCode,
            lastUpdated: new Date().toISOString(),
            measurement: draft?.measurement,
            plots: {
              ...draft?.plots,
              [String(plotIndex)]: {
                ...getOrCreatePlotDraft(draft, plotIndex),
                overviewPhoto: uri,
              },
            },
          }));

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      addInfectionCard(traitCode, varietyId, plotIndex) {
        setState((current) => {
          const card: InfectionCard = {
            id: createId('infection'),
            plantNumber: '',
            rowNumber: '',
            isComplete: false,
          };

          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => ({
            varietyId,
            traitCode,
            lastUpdated: new Date().toISOString(),
            measurement: draft?.measurement,
            plots: {
              ...draft?.plots,
              [String(plotIndex)]: {
                ...getOrCreatePlotDraft(draft, plotIndex),
                infections: [...getOrCreatePlotDraft(draft, plotIndex).infections, card],
              },
            },
          }));

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      updateInfectionCard(traitCode, varietyId, plotIndex, cardId, changes) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const plotDraft = getOrCreatePlotDraft(draft, plotIndex);

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: draft?.measurement,
              plots: {
                ...draft?.plots,
                [String(plotIndex)]: {
                  ...plotDraft,
                  infections: plotDraft.infections.map((card) => {
                    if (card.id !== cardId) {
                      return card;
                    }

                    const nextCard = {
                      ...card,
                      ...changes,
                    };

                    return {
                      ...nextCard,
                      isComplete: isInfectionCardComplete(nextCard),
                    };
                  }),
                },
              },
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      removeInfectionCard(traitCode, varietyId, plotIndex, cardId) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const plotDraft = getOrCreatePlotDraft(draft, plotIndex);

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: draft?.measurement,
              plots: {
                ...draft?.plots,
                [String(plotIndex)]: {
                  ...plotDraft,
                  infections: plotDraft.infections.filter((card) => card.id !== cardId),
                },
              },
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      confirmTraitPlot(traitCode, varietyId, plotIndex) {
        const draft = getTraitDraft(stateRef.current, varietyId, traitCode);
        const plotDraft = getOrCreatePlotDraft(draft, plotIndex);
        const existingTask = stateRef.current.syncQueue.find(
          (task) =>
            task.traitCode === traitCode &&
            task.varietyId === varietyId &&
            task.plotIndex === plotIndex,
        );

        if (plotDraft.confirmedAt && existingTask) {
          return;
        }

        if (plotDraft.confirmedAt && plotDraft.syncStatus === 'synced') {
          return;
        }

        const taskId = createId('sync');
        const now = new Date().toISOString();
        const task: SyncTask = {
          id: taskId,
          type: 'trait_plot',
          traitCode,
          varietyId,
          plotIndex,
          payload: {
            ...plotDraft,
            syncStatus: 'queued',
            lastQueuedAt: now,
          },
          status: 'queued',
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (currentDraft) => ({
            varietyId,
            traitCode,
            lastUpdated: now,
            measurement: currentDraft?.measurement,
            plots: {
              ...currentDraft?.plots,
              [String(plotIndex)]: {
                ...getOrCreatePlotDraft(currentDraft, plotIndex),
                confirmedAt: currentDraft?.plots[String(plotIndex)]?.confirmedAt || now,
                syncStatus: 'queued',
                lastQueuedAt: now,
              },
            },
          }));

          const queuedState = {
            ...nextState,
            syncQueue: [task, ...current.syncQueue],
          };

          return updateVarietyTraitStatus(queuedState, varietyId, traitCode);
        });

        void processTask(taskId);
      },
      saveMeasurementSubplotPhoto(traitCode, varietyId, subplot, uri) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              photoUri: uri,
              photoConfirmed: false,
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      confirmMeasurementSubplotPhoto(traitCode, varietyId, subplot) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              photoConfirmed: Boolean(currentSubplot.photoUri),
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      setMeasurementSubplotPlantCount(traitCode, varietyId, subplot, plantCount) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              plantCount,
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      addMeasurementCard(traitCode, varietyId, subplot) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const plantCount = Number.parseInt(currentSubplot.plantCount, 10);
            const hasIncompleteCard = currentSubplot.measurements.some((card) => !card.isComplete);

            if (
              hasIncompleteCard ||
              !Number.isInteger(plantCount) ||
              plantCount <= 0 ||
              currentSubplot.measurements.length >= plantCount
            ) {
              return {
                varietyId,
                traitCode,
                lastUpdated: draft?.lastUpdated || new Date().toISOString(),
                measurement: measurementDraft,
                plots: draft?.plots || {},
              };
            }

            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              measurements: [
                ...currentSubplot.measurements,
                createMeasurementCardDraft(createId('measurement')),
              ],
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      updateMeasurementCard(traitCode, varietyId, subplot, cardId, changes) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              measurements: updateMeasurementCardList(currentSubplot.measurements, cardId, changes),
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      completeMeasurementCard(traitCode, varietyId, subplot, cardId) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const card = currentSubplot.measurements.find((item) => item.id === cardId);

            if (!card || !isMeasurementCardComplete(card)) {
              return {
                varietyId,
                traitCode,
                lastUpdated: draft?.lastUpdated || new Date().toISOString(),
                measurement: measurementDraft,
                plots: draft?.plots || {},
              };
            }

            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              measurements: currentSubplot.measurements.map((item) =>
                item.id === cardId
                  ? { ...item, isComplete: true, isCollapsed: true }
                  : item,
              ),
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      toggleMeasurementCardCollapsed(traitCode, varietyId, subplot, cardId) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => {
            const measurementDraft = getOrCreateMeasurementDraft(draft);
            const currentSubplot = getMeasurementSubplot(draft, subplot);
            const nextSubplot = updateMeasurementSubplot(currentSubplot, {
              measurements: currentSubplot.measurements.map((item) =>
                item.id === cardId && item.isComplete
                  ? { ...item, isCollapsed: !item.isCollapsed }
                  : item,
              ),
            });

            return {
              varietyId,
              traitCode,
              lastUpdated: new Date().toISOString(),
              measurement: {
                ...measurementDraft,
                subplotA: subplot === 'A' ? nextSubplot : measurementDraft.subplotA,
                subplotB: subplot === 'B' ? nextSubplot : measurementDraft.subplotB,
              },
              plots: draft?.plots || {},
            };
          });

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      setMeasurementCurrentStep(traitCode, varietyId, step) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => ({
            varietyId,
            traitCode,
            lastUpdated: new Date().toISOString(),
            measurement: {
              ...getOrCreateMeasurementDraft(draft),
              currentStep: step,
            },
            plots: draft?.plots || {},
          }));

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      completeMeasurementTrait(traitCode, varietyId) {
        setState((current) => {
          const nextState = withUpdatedTraitDraft(current, varietyId, traitCode, (draft) => ({
            varietyId,
            traitCode,
            lastUpdated: new Date().toISOString(),
            measurement: {
              ...getOrCreateMeasurementDraft(draft),
              currentStep: 4,
              completedAt: new Date().toISOString(),
            },
            plots: draft?.plots || {},
          }));

          return updateVarietyTraitStatus(nextState, varietyId, traitCode);
        });
      },
      getTraitPlotDraft(traitCode, varietyId, plotIndex) {
        return getOrCreatePlotDraft(getTraitDraft(state, varietyId, traitCode), plotIndex);
      },
      getMeasurementTraitDraft(traitCode, varietyId) {
        return getOrCreateMeasurementDraft(getTraitDraft(state, varietyId, traitCode));
      },
      getNextTraitPlot(traitCode, varietyId) {
        const plots = getTraitDraft(state, varietyId, traitCode)?.plots || {};

        for (const plotIndex of [1, 2, 3]) {
          if (!plots[String(plotIndex)]?.confirmedAt) {
            return plotIndex;
          }
        }

        return 1;
      },
      getCompletedPlotsCount(traitCode, varietyId) {
        return countCompletedPlots(getTraitDraft(state, varietyId, traitCode));
      },
      getSyncedPlotsCount(traitCode, varietyId) {
        return countSyncedPlots(getTraitDraft(state, varietyId, traitCode));
      },
      getLatestVarietySyncStatus(traitCode, varietyId) {
        return getLatestPlotStatus(getTraitDraft(state, varietyId, traitCode));
      },
      getAggregateTraitState(varietyId) {
        const variety = state.varieties.find((item) => item.id === varietyId);
        if (!variety) {
          return 'not_started';
        }

        const activeStatuses = ENABLED_TRAIT_CODES.map((code) => variety.traitStatuses[code]);

        if (activeStatuses.every((status) => status === 'completed')) {
          return 'completed';
        }

        if (activeStatuses.every((status) => status === 'not_started')) {
          return 'not_started';
        }

        return 'in_progress';
      },
      getTraitCheckboxState(traitCode, varietyId) {
        const draft = getTraitDraft(state, varietyId, traitCode);

        if (isTraitFullySynced(draft, traitCode)) {
          return 'fully_synced';
        }

        if (isTraitRouteCompleted(draft, traitCode)) {
          return 'completed_pending_sync';
        }

        return 'not_started';
      },
    }),
    [hydrated, state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
}
