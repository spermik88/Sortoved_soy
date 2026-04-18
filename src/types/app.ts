export type AccountRole = 'collector' | 'analyst' | 'manager';
export type CollectorMode = 'linked' | 'test';
export type TraitCode = 'fusarium';
export type TraitState = 'not_started' | 'in_progress' | 'completed';
export type SyncTaskStatus =
  | 'queued'
  | 'processing'
  | 'success'
  | 'waiting_for_network'
  | 'failed';

export interface PlotPhoto {
  plotIndex: number;
  imageUri?: string;
  mapsUrl?: string;
  isPlaceholder: boolean;
}

export interface InfectionCard {
  id: string;
  photoUri?: string;
  plantNumber: string;
  rowNumber: string;
  isComplete: boolean;
}

export interface FusariumPlotDraft {
  plotIndex: number;
  overviewPhoto?: string;
  infections: InfectionCard[];
  syncStatus: 'idle' | 'queued' | 'syncing' | 'synced' | 'failed';
}

export interface FusariumDraft {
  varietyId: string;
  plots: Record<string, FusariumPlotDraft>;
  lastUpdated: string;
}

export interface VarietyLink {
  id: string;
  sheetUrl: string;
  title: string;
  sourceMode: CollectorMode;
  plotPhotos: PlotPhoto[];
  traitStatuses: Record<TraitCode, TraitState>;
}

export interface SyncTask {
  id: string;
  type: 'fusarium_plot';
  varietyId: string;
  plotIndex: number;
  payload: FusariumPlotDraft;
  status: SyncTaskStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingVariety {
  id: string;
  sheetUrl: string;
  title: string;
  plotPhotos: PlotPhoto[];
}

export interface PersistedAppState {
  activeRole: AccountRole | null;
  firstLaunchCompleted: boolean;
  collectorMode: CollectorMode | null;
  varieties: VarietyLink[];
  pendingVariety: PendingVariety | null;
  fusariumDrafts: Record<string, FusariumDraft>;
  syncQueue: SyncTask[];
  syncHistory: SyncTask[];
}
