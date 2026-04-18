import {
  computeAggregateTraitState,
  computeTraitState,
  getCompletedPlotsCount,
  getLatestPlotStatus,
  getOrCreatePlotDraft,
  getSyncedPlotsCount,
  isTraitFullySynced,
  isTraitRouteCompleted,
  isInfectionCardComplete,
} from '../src/context/appStateUtils';
import { TraitDraft } from '../src/types/app';

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
    const draft: TraitDraft = {
      varietyId: 'v1',
      traitCode: 'fusarium',
      lastUpdated: '2026-04-18T00:00:00.000Z',
      plots: {
        '1': {
          plotIndex: 1,
          infections: [],
          confirmedAt: '2026-04-18T09:00:00.000Z',
          syncStatus: 'synced',
        },
        '2': {
          plotIndex: 2,
          infections: [],
          confirmedAt: '2026-04-18T09:10:00.000Z',
          syncStatus: 'synced',
        },
        '3': {
          plotIndex: 3,
          infections: [],
          confirmedAt: '2026-04-18T09:20:00.000Z',
          syncStatus: 'synced',
        },
      },
    };

    expect(computeTraitState(draft)).toBe('completed');
    expect(getCompletedPlotsCount(draft)).toBe(3);
    expect(getSyncedPlotsCount(draft)).toBe(3);
    expect(isTraitRouteCompleted(draft)).toBe(true);
    expect(isTraitFullySynced(draft)).toBe(true);
  });

  it('derives latest status from timestamps', () => {
    const draft: TraitDraft = {
      varietyId: 'v1',
      traitCode: 'fusarium',
      lastUpdated: '2026-04-18T00:00:00.000Z',
      plots: {
        '1': {
          plotIndex: 1,
          infections: [],
          confirmedAt: '2026-04-18T10:00:00.000Z',
          syncStatus: 'queued',
          lastQueuedAt: '2026-04-18T10:00:00.000Z',
        },
        '2': {
          plotIndex: 2,
          infections: [],
          confirmedAt: '2026-04-18T11:00:00.000Z',
          syncStatus: 'synced',
          lastSyncAt: '2026-04-18T11:00:00.000Z',
        },
      },
    };

    expect(getLatestPlotStatus(draft)).toBe('synced');
  });

  it('treats queued confirmed plots as completed for route progress', () => {
    const draft: TraitDraft = {
      varietyId: 'v1',
      traitCode: 'fusarium',
      lastUpdated: '2026-04-18T00:00:00.000Z',
      plots: {
        '1': {
          plotIndex: 1,
          infections: [],
          confirmedAt: '2026-04-18T10:00:00.000Z',
          syncStatus: 'queued',
          lastQueuedAt: '2026-04-18T10:00:00.000Z',
        },
      },
    };

    expect(getCompletedPlotsCount(draft)).toBe(1);
    expect(getSyncedPlotsCount(draft)).toBe(0);
    expect(isTraitRouteCompleted(draft)).toBe(false);
    expect(isTraitFullySynced(draft)).toBe(false);
  });

  it('computes aggregate trait state across active flows', () => {
    expect(
      computeAggregateTraitState(
        {
          fusarium: 'not_started',
          septoria: 'not_started',
          flea_damage: 'not_started',
          bacteriosis: 'not_started',
          downy_mildew: 'not_started',
          cercospora: 'not_started',
          aphid_damage: 'not_started',
        },
        [
          'fusarium',
          'septoria',
          'flea_damage',
          'bacteriosis',
          'downy_mildew',
          'cercospora',
          'aphid_damage',
        ],
      ),
    ).toBe('not_started');

    expect(
      computeAggregateTraitState(
        {
          fusarium: 'completed',
          septoria: 'completed',
          flea_damage: 'completed',
          bacteriosis: 'completed',
          downy_mildew: 'completed',
          cercospora: 'completed',
          aphid_damage: 'in_progress',
        },
        [
          'fusarium',
          'septoria',
          'flea_damage',
          'bacteriosis',
          'downy_mildew',
          'cercospora',
          'aphid_damage',
        ],
      ),
    ).toBe('in_progress');
  });
});
