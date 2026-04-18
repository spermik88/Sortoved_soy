import { FusariumDraft, FusariumPlotDraft, SyncTaskStatus, TraitState } from '../types/app';

export function getOrCreatePlotDraft(
  draft: FusariumDraft | undefined,
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

export function isInfectionCardComplete(card: {
  photoUri?: string;
  plantNumber: string;
  rowNumber: string;
}) {
  return Boolean(card.photoUri && card.plantNumber.trim() && card.rowNumber.trim());
}

export function computeTraitState(draft: FusariumDraft | undefined): TraitState {
  if (!draft) {
    return 'not_started';
  }

  const plots = Object.values(draft.plots);
  if (plots.length >= 3 && plots.every((plot) => plot.syncStatus === 'synced')) {
    return 'completed';
  }

  return 'in_progress';
}

export function getCompletedPlotsCount(draft: FusariumDraft | undefined) {
  if (!draft) {
    return 0;
  }

  return Object.values(draft.plots).filter((plot) => plot.syncStatus === 'synced').length;
}

export function getLatestPlotStatus(
  draft: FusariumDraft | undefined,
): FusariumPlotDraft['syncStatus'] | SyncTaskStatus | 'idle' {
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
