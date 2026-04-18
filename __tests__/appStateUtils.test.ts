import {
  computeTraitState,
  getCompletedPlotsCount,
  getLatestPlotStatus,
  getOrCreatePlotDraft,
  isInfectionCardComplete,
} from '../src/context/appStateUtils';
import { FusariumDraft } from '../src/types/app';

describe('appStateUtils', () => {
  it('creates empty plot draft by default', () => {
    const draft = getOrCreatePlotDraft(undefined, 2);

    expect(draft.plotIndex).toBe(2);
    expect(draft.syncStatus).toBe('idle');
    expect(draft.infections).toHaveLength(0);
  });

  it('marks card complete only when all fields are filled', () => {
    expect(
      isInfectionCardComplete({
        photoUri: 'file:///1.jpg',
        plantNumber: '7',
        rowNumber: '2',
      }),
    ).toBe(true);

    expect(
      isInfectionCardComplete({
        photoUri: undefined,
        plantNumber: '7',
        rowNumber: '2',
      }),
    ).toBe(false);
  });

  it('computes completed trait state for three synced plots', () => {
    const draft: FusariumDraft = {
      varietyId: 'v1',
      lastUpdated: '2026-04-18T00:00:00.000Z',
      plots: {
        '1': { plotIndex: 1, infections: [], syncStatus: 'synced' },
        '2': { plotIndex: 2, infections: [], syncStatus: 'synced' },
        '3': { plotIndex: 3, infections: [], syncStatus: 'synced' },
      },
    };

    expect(computeTraitState(draft)).toBe('completed');
    expect(getCompletedPlotsCount(draft)).toBe(3);
  });

  it('derives latest status from timestamps', () => {
    const draft: FusariumDraft = {
      varietyId: 'v1',
      lastUpdated: '2026-04-18T00:00:00.000Z',
      plots: {
        '1': {
          plotIndex: 1,
          infections: [],
          syncStatus: 'queued',
          lastQueuedAt: '2026-04-18T10:00:00.000Z',
        },
        '2': {
          plotIndex: 2,
          infections: [],
          syncStatus: 'synced',
          lastSyncAt: '2026-04-18T11:00:00.000Z',
        },
      },
    };

    expect(getLatestPlotStatus(draft)).toBe('synced');
  });
});
