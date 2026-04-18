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
import { mockSyncAdapter } from '../services/mockSyncAdapter';
import { isInternetReachable, subscribeToNetwork } from '../services/networkService';
import { qrResolver } from '../services/qrResolver';
import {
  AccountRole,
  CollectorMode,
  FusariumDraft,
  FusariumPlotDraft,
  InfectionCard,
  PersistedAppState,
  SyncTask,
  TraitState,
  VarietyLink,
} from '../types/app';
import { createId } from '../utils/id';

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

function getOrCreatePlotDraft(
  draft: FusariumDraft | undefined,
  varietyId: string,
  plotIndex: number,
): FusariumPlotDraft {
  return (
    draft?.plots[String(plotIndex)] || {
      plotIndex,
      infections: [],
      syncStatus: 'idle',
    }
  );
}

function isInfectionCardComplete(card: InfectionCard) {
  return Boolean(card.photoUri && card.plantNumber.trim() && card.rowNumber.trim());
}

function computeTraitState(draft: FusariumDraft | undefined): TraitState {
  if (!draft) {
    return 'not_started';
  }

  const plots = Object.values(draft.plots);

  if (plots.length >= 3 && plots.every((plot) => plot.syncStatus === 'synced')) {
    return 'completed';
  }

  return 'in_progress';
}

function updateVarietyTraitStatus(
  state: PersistedAppState,
  varietyId: string,
  traitState: TraitState,
) {
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
  confirmFusariumPlot: (varietyId: string, plotIndex: number) => Promise<'synced' | 'queued'>;
  getFusariumPlotDraft: (varietyId: string, plotIndex: number) => FusariumPlotDraft;
  getNextFusariumPlot: (varietyId: string) => number;
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

    collectorRepository.save(state);
  }, [hydrated, state]);

  async function processTask(taskId: string): Promise<'synced' | 'queued'> {
    const isOnline = await isInternetReachable();

    if (!isOnline) {
      setState((current) => ({
        ...current,
        syncQueue: current.syncQueue.map((task) =>
          task.id === taskId
            ? { ...task, status: 'waiting_for_network', updatedAt: new Date().toISOString() }
            : task,
        ),
      }));
      return 'queued';
    }

    setState((current) => ({
      ...current,
      syncQueue: current.syncQueue.map((task) =>
        task.id === taskId
          ? { ...task, status: 'processing', updatedAt: new Date().toISOString() }
          : task,
      ),
    }));

    const snapshot = stateRef.current.syncQueue.find((task) => task.id === taskId);
    if (!snapshot) {
      return 'queued';
    }

    await mockSyncAdapter.process(snapshot);

    setState((current) => {
      const completedTask = current.syncQueue.find((task) => task.id === taskId);

      if (!completedTask) {
        return current;
      }

      const updatedDrafts: Record<string, FusariumDraft> = {
        ...current.fusariumDrafts,
        [completedTask.varietyId]: {
          ...current.fusariumDrafts[completedTask.varietyId],
          plots: {
            ...current.fusariumDrafts[completedTask.varietyId].plots,
            [String(completedTask.plotIndex)]: {
              ...current.fusariumDrafts[completedTask.varietyId].plots[String(completedTask.plotIndex)],
              syncStatus: 'synced' as const,
            },
          },
          lastUpdated: new Date().toISOString(),
        },
      };

      const traitState = computeTraitState(updatedDrafts[completedTask.varietyId]);
      const nextState = updateVarietyTraitStatus(
        {
          ...current,
          fusariumDrafts: updatedDrafts,
          syncQueue: current.syncQueue.filter((task) => task.id !== taskId),
          syncHistory: [
            {
              ...completedTask,
              status: 'success',
              updatedAt: new Date().toISOString(),
            },
            ...current.syncHistory,
          ],
        },
        completedTask.varietyId,
        traitState,
      );

      return nextState;
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
        setState((current) => ({
          ...initialState,
          activeRole: role,
          firstLaunchCompleted: true,
        }));
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
            invalid:
              error instanceof Error ? error.message : 'Не удалось обработать QR-код.',
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
              ...current.varieties.filter((variety) => variety.id !== 'test-variety'),
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
          const plotDraft = getOrCreatePlotDraft(draft, varietyId, plotIndex);
          const nextDraft: FusariumDraft = {
            varietyId,
            lastUpdated: new Date().toISOString(),
            plots: {
              ...draft?.plots,
              [String(plotIndex)]: {
                ...plotDraft,
                overviewPhoto: uri,
              },
            },
          };

          return updateVarietyTraitStatus(
            {
              ...current,
              fusariumDrafts: {
                ...current.fusariumDrafts,
                [varietyId]: nextDraft,
              },
            },
            varietyId,
            'in_progress',
          );
        });
      },
      addInfectionCard(varietyId, plotIndex) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, varietyId, plotIndex);
          const card: InfectionCard = {
            id: createId('infection'),
            plantNumber: '',
            rowNumber: '',
            isComplete: false,
          };

          return {
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
        });
      },
      updateInfectionCard(varietyId, plotIndex, cardId, changes) {
        setState((current) => {
          const draft = current.fusariumDrafts[varietyId];
          const plotDraft = getOrCreatePlotDraft(draft, varietyId, plotIndex);

          return {
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
        });
      },
      async confirmFusariumPlot(varietyId, plotIndex) {
        const draft = stateRef.current.fusariumDrafts[varietyId];
        const plotDraft = getOrCreatePlotDraft(draft, varietyId, plotIndex);
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
          },
          status: 'queued',
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        setState((current) => ({
          ...current,
          fusariumDrafts: {
            ...current.fusariumDrafts,
            [varietyId]: {
              ...current.fusariumDrafts[varietyId],
              plots: {
                ...current.fusariumDrafts[varietyId].plots,
                [String(plotIndex)]: {
                  ...current.fusariumDrafts[varietyId].plots[String(plotIndex)],
                  syncStatus: 'queued',
                },
              },
            },
          },
          syncQueue: [task, ...current.syncQueue],
        }));

        return processTask(taskId);
      },
      getFusariumPlotDraft(varietyId, plotIndex) {
        return getOrCreatePlotDraft(state.fusariumDrafts[varietyId], varietyId, plotIndex);
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
