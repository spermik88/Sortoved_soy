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
          flowering_start: 'not_started',
          flowering_full: 'not_started',
          bacteriosis: 'not_started',
          downy_mildew: 'not_started',
          cercospora: 'not_started',
          aphid_damage: 'not_started',
          flower_color: 'not_started',
          flowering_end: 'not_started',
          lateral_leaf_shape: 'not_started',
          full_maturity: 'not_started',
          stem_pubescence_color: 'not_started',
          lodging_resistance: 'not_started',
          shattering_resistance: 'not_started',
        },
        [
          'fusarium',
          'septoria',
          'flea_damage',
          'flowering_start',
          'flowering_full',
          'bacteriosis',
          'downy_mildew',
          'cercospora',
          'aphid_damage',
          'flower_color',
          'flowering_end',
          'lateral_leaf_shape',
          'full_maturity',
          'stem_pubescence_color',
          'lodging_resistance',
          'shattering_resistance',
        ],
      ),
    ).toBe('not_started');

    expect(
      computeAggregateTraitState(
        {
          fusarium: 'completed',
          septoria: 'completed',
          flea_damage: 'completed',
          flowering_start: 'completed',
          flowering_full: 'completed',
          bacteriosis: 'completed',
          downy_mildew: 'completed',
          cercospora: 'completed',
          aphid_damage: 'in_progress',
          flower_color: 'completed',
          flowering_end: 'completed',
          lateral_leaf_shape: 'completed',
          full_maturity: 'completed',
          stem_pubescence_color: 'completed',
          lodging_resistance: 'completed',
          shattering_resistance: 'completed',
        },
        [
          'fusarium',
          'septoria',
          'flea_damage',
          'flowering_start',
          'flowering_full',
          'bacteriosis',
          'downy_mildew',
          'cercospora',
          'aphid_damage',
          'flower_color',
          'flowering_end',
          'lateral_leaf_shape',
          'full_maturity',
          'stem_pubescence_color',
          'lodging_resistance',
          'shattering_resistance',
        ],
      ),
    ).toBe('in_progress');
  });
});
