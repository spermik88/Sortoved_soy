import {
  MeasurementCardDraft,
  MeasurementSubplotDraft,
  SyncTaskStatus,
  TraitCode,
  TraitDraft,
  TraitPlotDraft,
  TraitState,
} from '../types/app';
import { getTraitDefinition } from '../constants/traits';

export function getOrCreatePlotDraft(
  draft: TraitDraft | undefined,
  plotIndex: number,
): TraitPlotDraft {
  return (
    draft?.plots[String(plotIndex)] || {
      plotIndex,
      infections: [],
      syncStatus: 'idle',
    }
  );
}

export function isInfectionCardComplete(card: {
  photoUri?: string;
  plantNumber: string;
  rowNumber: string;
}) {
  return Boolean(card.photoUri && card.plantNumber.trim() && card.rowNumber.trim());
}

export function createMeasurementSubplotDraft(
  key: 'A' | 'B',
): MeasurementSubplotDraft {
  return {
    key,
    photoConfirmed: false,
    plantCount: '',
    measurements: [],
  };
}

export function getOrCreateMeasurementDraft(
  draft: TraitDraft | undefined,
) {
  return (
    draft?.measurement || {
      subplotA: createMeasurementSubplotDraft('A'),
      subplotB: createMeasurementSubplotDraft('B'),
      currentStep: 1 as const,
    }
  );
}

export function getMeasurementSubplot(
  draft: TraitDraft | undefined,
  key: 'A' | 'B',
) {
  const measurementDraft = getOrCreateMeasurementDraft(draft);
  return key === 'A' ? measurementDraft.subplotA : measurementDraft.subplotB;
}

export function createMeasurementCardDraft(id: string): MeasurementCardDraft {
  return {
    id,
    value: '',
    isComplete: false,
    isCollapsed: false,
  };
}

export function isMeasurementCardComplete(card: {
  photoUri?: string;
  value: string;
}) {
  return Boolean(card.photoUri && card.value.trim());
}

export function isMeasurementTraitCompleted(draft: TraitDraft | undefined) {
  return Boolean(draft?.measurement?.completedAt);
}

export function computeTraitState(draft: TraitDraft | undefined): TraitState {
  if (!draft) {
    return 'not_started';
  }

  if (draft.measurement) {
    return isMeasurementTraitCompleted(draft) ? 'completed' : 'in_progress';
  }

  const plots = Object.values(draft.plots);
  if (plots.length >= 3 && plots.every((plot) => plot.confirmedAt)) {
    return 'completed';
  }

  return 'in_progress';
}

export function computeAggregateTraitState(
  statuses: Record<TraitCode, TraitState>,
  activeCodes: TraitCode[],
): TraitState {
  const activeStatuses = activeCodes.map((code) => statuses[code]);

  if (activeStatuses.every((status) => status === 'completed')) {
    return 'completed';
  }

  if (activeStatuses.every((status) => status === 'not_started')) {
    return 'not_started';
  }

  return 'in_progress';
}

export function getCompletedPlotsCount(draft: TraitDraft | undefined) {
  if (!draft) {
    return 0;
  }

  if (draft.measurement) {
    return isMeasurementTraitCompleted(draft) ? 1 : 0;
  }

  return Object.values(draft.plots).filter((plot) => plot.confirmedAt).length;
}

export function getSyncedPlotsCount(draft: TraitDraft | undefined) {
  if (!draft) {
    return 0;
  }

  if (draft.measurement) {
    return isMeasurementTraitCompleted(draft) ? 1 : 0;
  }

  return Object.values(draft.plots).filter((plot) => plot.syncStatus === 'synced').length;
}

export function isTraitRouteCompleted(
  draft: TraitDraft | undefined,
  traitCode?: TraitCode,
) {
  if (traitCode && getTraitDefinition(traitCode).flowKind === 'measurement_ab_flow') {
    return isMeasurementTraitCompleted(draft);
  }

  return getCompletedPlotsCount(draft) >= 3;
}

export function isTraitFullySynced(
  draft: TraitDraft | undefined,
  traitCode?: TraitCode,
) {
  if (traitCode && getTraitDefinition(traitCode).flowKind === 'measurement_ab_flow') {
    return isMeasurementTraitCompleted(draft);
  }

  return getSyncedPlotsCount(draft) >= 3;
}

export function getLatestPlotStatus(
  draft: TraitDraft | undefined,
): TraitPlotDraft['syncStatus'] | SyncTaskStatus | 'idle' {
  if (!draft) {
    return 'idle';
  }

  const plots = Object.values(draft.plots);
  if (!plots.length) {
    return 'idle';
  }

  const sorted = [...plots].sort((left, right) => {
    const leftValue = left.lastSyncAt || left.lastQueuedAt || '';
    const rightValue = right.lastSyncAt || right.lastQueuedAt || '';
    return rightValue.localeCompare(leftValue);
  });

  return sorted[0]?.syncStatus || 'idle';
}
