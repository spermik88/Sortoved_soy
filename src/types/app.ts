export type AccountRole = 'collector' | 'analyst' | 'manager';
export type CollectorMode = 'linked' | 'test';
export type TraitCode =
  | 'fusarium'
  | 'septoria'
  | 'flea_damage'
  | 'bacteriosis'
  | 'downy_mildew'
  | 'cercospora'
  | 'aphid_damage';
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

export interface TraitPlotDraft {
  plotIndex: number;
  overviewPhoto?: string;
  infections: InfectionCard[];
  confirmedAt?: string;
  syncStatus: 'idle' | 'queued' | 'syncing' | 'synced' | 'failed';
  lastSyncAt?: string;
  lastQueuedAt?: string;
}

export interface TraitDraft {
  varietyId: string;
  traitCode: TraitCode;
  plots: Record<string, TraitPlotDraft>;
  lastUpdated: string;
}

export type TraitDraftMap = Partial<Record<TraitCode, TraitDraft>>;

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
  type: 'trait_plot';
  traitCode: TraitCode;
  varietyId: string;
  plotIndex: number;
  payload: TraitPlotDraft;
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
  traitDrafts: Record<string, TraitDraftMap>;
  syncQueue: SyncTask[];
  syncHistory: SyncTask[];
}
