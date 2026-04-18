import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { collectorRepository } from '../repositories/collectorRepository';
import { t } from '../i18n';
import { mockSyncAdapter } from '../services/mockSyncAdapter';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { qrResolver } from '../services/qrResolver';
import {
  AccountRole,
  FusariumDraft,
  FusariumPlotDraft,
  InfectionCard,
  PersistedAppState,
  SyncTask,
  SyncTaskStatus,
  VarietyLink,
} from '../types/app';
import { createId } from '../utils/id';
import {
  computeTraitState,
  getCompletedPlotsCount as countCompletedPlots,
  getLatestPlotStatus,
  getOrCreatePlotDraft,
  isInfectionCardComplete,
} from './appStateUtils';

const initialState: PersistedAppState = {
  activeRole: null,
  firstLaunchCompleted: false,
  collectorMode: null,
  varieties: [],
  pendingVariety: null,
  fusariumDrafts: {},
  syncQueue: [],
  syncHistory: [],
};

const FUSARIUM_CODE = 'fusarium';

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
    traitStatuses: {
      fusarium: 'not_started',
    },
  };
}

function ensureTraitStatuses(variety: VarietyLink): VarietyLink {
  return {
    ...variety,
    traitStatuses: {
      fusarium: variety.traitStatuses?.fusarium || 'not_started',
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

function updateVarietyTraitStatus(state: PersistedAppState, varietyId: string) {
  const traitState = computeTraitState(state.fusariumDrafts[varietyId]);

  return {
    ...state,
    varieties: state.varieties.map((variety) =>
      variety.id === varietyId
        ? {
            ...variety,
            traitStatuses: {
              ...variety.traitStatuses,
              [FUSARIUM_CODE]: traitState,
            },
          }
        : variety,
    ),
  };
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
  saveOverviewPhoto: (varietyId: string, plotIndex: number, uri: string) => void;
  addInfectionCard: (varietyId: string, plotIndex: number) => void;
  updateInfectionCard: (
    varietyId: string,
    plotIndex: number,
    cardId: string,
    changes: Partial<InfectionCard>,
  ) => void;
  removeInfectionCard: (varietyId: string, plotIndex: number, cardId: string) => void;
  confirmFusariumPlot: (varietyId: string, plotIndex: number) => Promise<'synced' | 'queued'>;
  getFusariumPlotDraft: (varietyId: string, plotIndex: number) => FusariumPlotDraft;
  getNextFusariumPlot: (varietyId: string) => number;
  getCompletedPlotsCount: (varietyId: string) => number;
  getLatestVarietySyncStatus: (
    varietyId: string,
  ) => FusariumPlotDraft['syncStatus'] | SyncTaskStatus | 'idle';
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
        const nextState = {
          ...current,
          fusariumDrafts: {
            ...current.fusariumDrafts,
            [taskSnapshot.varietyId]: {
              ...current.fusariumDrafts[taskSnapshot.varietyId],
              plots: {
                ...current.fusariumDrafts[taskSnapshot.varietyId].plots,
                [String(taskSnapshot.plotIndex)]: {
                  ...current.fusariumDrafts[taskSnapshot.varietyId].plots[
                    String(taskSnapshot.plotIndex)
                  ],
                  syncStatus: 'queued' as const,
                  lastQueuedAt: now,
                },
              },
              lastUpdated: now,
            },
          },
          syncQueue: current.syncQueue.map((task) =>
            task.id === taskId
              ? { ...task, status: 'waiting_for_network' as const, updatedAt: now }
              : task,
          ),
        };

        return updateVarietyTraitStatus(nextState, taskSnapshot.varietyId);
      });
      return 'queued';
    }

    setState((current) => {
      const nextState = {
        ...current,
        fusariumDrafts: {
          ...current.fusariumDrafts,
          [taskSnapshot.varietyId]: {
            ...current.fusariumDrafts[taskSnapshot.varietyId],
            plots: {
              ...current.fusariumDrafts[taskSnapshot.varietyId].plots,
              [String(taskSnapshot.plotIndex)]: {
                ...current.fusariumDrafts[taskSnapshot.varietyId].plots[
                  String(taskSnapshot.plotIndex)
                ],
                syncStatus: 'syncing' as const,
              },
            },
            lastUpdated: now,
          },
        },
        syncQueue: current.syncQueue.map((task) =>
          task.id === taskId
            ? { ...task, status: 'processing' as const, updatedAt: now }
            : task,
        ),
      };

      return updateVarietyTraitStatus(nextState, taskSnapshot.varietyId);
    });

    await mockSyncAdapter.process(taskSnapshot);

    setState((current) => {
      const completedTask = current.syncQueue.find((task) => task.id === taskId);

      if (!completedTask) {
        return current;
      }

      const nextState = {
        ...current,
        fusariumDrafts: {
          ...current.fusariumDrafts,
          [completedTask.varietyId]: {
            ...current.fusariumDrafts[completedTask.varietyId],
            plots: {
              ...current.fusariumDrafts[completedTask.varietyId].plots,
              [String(completedTask.plotIndex)]: {
                ...current.fusariumDrafts[completedTask.varietyId].plots[
                  String(completedTask.plotIndex)
                ],
                syncStatus: 'synced' as const,
                lastSyncAt: new Date().toISOString(),
              },
            },
            lastUpdated: new Date().toISOString(),
          },
        },
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

      return updateVarietyTraitStatus(nextState, completedTask.varietyId);
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
                traitStatuses: {
                  fusarium: 'not_started',
                },
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
      saveOverviewPhoto(varietyId, plotIndex, uri) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, plotIndex);
          const nextState = {
            ...current,
            fusariumDrafts: {
              ...current.fusariumDrafts,
              [varietyId]: {
                varietyId,
                lastUpdated: new Date().toISOString(),
                plots: {
                  ...draft?.plots,
                  [String(plotIndex)]: {
                    ...plotDraft,
                    overviewPhoto: uri,
                  },
                },
              },
            },
          };

          return updateVarietyTraitStatus(nextState, varietyId);
        });
      },
      addInfectionCard(varietyId, plotIndex) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, plotIndex);
          const card: InfectionCard = {
            id: createId('infection'),
            plantNumber: '',
            rowNumber: '',
            isComplete: false,
          };

          const nextState = {
            ...current,
            fusariumDrafts: {
              ...current.fusariumDrafts,
              [varietyId]: {
                varietyId,
                lastUpdated: new Date().toISOString(),
                plots: {
                  ...draft?.plots,
                  [String(plotIndex)]: {
                    ...plotDraft,
                    infections: [...plotDraft.infections, card],
                  },
                },
              },
            },
          };

          return updateVarietyTraitStatus(nextState, varietyId);
        });
      },
      updateInfectionCard(varietyId, plotIndex, cardId, changes) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, plotIndex);

          const nextState = {
            ...current,
            fusariumDrafts: {
              ...current.fusariumDrafts,
              [varietyId]: {
                varietyId,
                lastUpdated: new Date().toISOString(),
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
              },
            },
          };

          return updateVarietyTraitStatus(nextState, varietyId);
        });
      },
      removeInfectionCard(varietyId, plotIndex, cardId) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, plotIndex);
          const nextState = {
            ...current,
            fusariumDrafts: {
              ...current.fusariumDrafts,
              [varietyId]: {
                varietyId,
                lastUpdated: new Date().toISOString(),
                plots: {
                  ...draft?.plots,
                  [String(plotIndex)]: {
                    ...plotDraft,
                    infections: plotDraft.infections.filter((card) => card.id !== cardId),
                  },
                },
              },
            },
          };

          return updateVarietyTraitStatus(nextState, varietyId);
        });
      },
      async confirmFusariumPlot(varietyId, plotIndex) {
        const draft = stateRef.current.fusariumDrafts[varietyId];
        const plotDraft = getOrCreatePlotDraft(draft, plotIndex);
        const taskId = createId('sync');
        const now = new Date().toISOString();
        const task: SyncTask = {
          id: taskId,
          type: 'fusarium_plot',
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
          const nextState = {
            ...current,
            fusariumDrafts: {
              ...current.fusariumDrafts,
              [varietyId]: {
                ...current.fusariumDrafts[varietyId],
                plots: {
                  ...current.fusariumDrafts[varietyId].plots,
                  [String(plotIndex)]: {
                    ...current.fusariumDrafts[varietyId].plots[String(plotIndex)],
                    syncStatus: 'queued' as const,
                    lastQueuedAt: now,
                  },
                },
              },
            },
            syncQueue: [task, ...current.syncQueue],
          };

          return updateVarietyTraitStatus(nextState, varietyId);
        });

        return processTask(taskId);
      },
      getFusariumPlotDraft(varietyId, plotIndex) {
        return getOrCreatePlotDraft(state.fusariumDrafts[varietyId], plotIndex);
      },
      getNextFusariumPlot(varietyId) {
        const plots = state.fusariumDrafts[varietyId]?.plots || {};

        for (const plotIndex of [1, 2, 3]) {
          if (plots[String(plotIndex)]?.syncStatus !== 'synced') {
            return plotIndex;
          }
        }

        return 1;
      },
      getCompletedPlotsCount(varietyId) {
        return countCompletedPlots(state.fusariumDrafts[varietyId]);
      },
      getLatestVarietySyncStatus(varietyId) {
        return getLatestPlotStatus(state.fusariumDrafts[varietyId]);
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
