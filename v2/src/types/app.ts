export type ScreenId = string;

export type VarietySource = 'created' | 'linked';
export type QueueStatus = 'queued' | 'processing' | 'synced' | 'failed' | 'waiting_for_auth';
export type TaskKind = 'infection' | 'measurement' | 'observation';
export type TaskFlowKind =
  | 'infection_split'
  | 'observation_single'
  | 'measurement_cards'
  | 'placeholder_pending_spec';
export type AuthMode = 'link' | 'create';
export type TaskUiStatus =
  | 'not_started'
  | 'draft'
  | 'ready_local'
  | 'queued'
  | 'processed';

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  email?: string;
  expiresAt?: number;
}

export interface VarietySheetBinding {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export interface VarietySetupSnapshot {
  mapsUrl?: string;
  plotPhotos?: Partial<Record<'1' | '2' | '3', string>>;
}

export interface VarietyRecord {
  id: string;
  title: string;
  source: VarietySource;
  binding: VarietySheetBinding;
  setup?: VarietySetupSnapshot;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready' | 'syncing' | 'error';
  lastError?: string;
}

export interface PlotDraft {
  areaConfirmed: boolean;
  rowSpacing?: string;
  rowCount?: string;
  plantSpacingConfirmed: boolean;
  photoUri?: string;
}

export interface VarietyCreationDraft {
  varietyName: string;
  creationDate?: string;
  sowingDate?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  plots: Record<'1' | '2' | '3', PlotDraft>;
}

export interface InspectionCardDraft {
  id: string;
  photoUri?: string;
  note: string;
  rowNumber?: string;
  plantNumber?: string;
  plot?: '1' | '2' | '3';
  value?: string;
  isComplete: boolean;
}

export interface InspectionTask {
  code: string;
  title: string;
  kind: TaskKind;
  flowKind: TaskFlowKind;
  intro?: string;
  overviewHint?: string;
  cardsHint?: string;
  observationLabel?: string;
  valueLabel?: string;
  overviewPhotoUri?: string;
  overviewCompleted: boolean;
  cardsCompleted: boolean;
  completedAt?: string;
  uiStatus: TaskUiStatus;
  cards: InspectionCardDraft[];
  updatedAt: string;
}

export interface QueuedMediaUpload {
  localUri: string;
  remoteUrl?: string;
  mimeType: string;
}

export interface SheetWriteOperation {
  strategy: 'replace' | 'append' | 'next-empty' | 'upload-meta';
  sheet: string;
  range?: string;
  values: (string | number | boolean)[][];
}

export interface QueuedOperation {
  id: string;
  type: 'create_variety' | 'write_sheet' | 'submit_task';
  varietyId?: string;
  screenId?: string;
  status: QueueStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  payload: Record<string, unknown>;
  writes?: SheetWriteOperation[];
  media?: QueuedMediaUpload[];
  lastError?: string;
}

export interface ScreenMappingRule {
  screenId: string;
  title: string;
  type: 'text' | 'date' | 'location' | 'confirm' | 'choice' | 'photo' | 'task';
  sheet?: string;
  field?: string;
  plot?: '1' | '2' | '3';
  strategy?: 'replace' | 'append' | 'next-empty' | 'upload-meta';
  defaults?: Record<string, string | number | boolean>;
}

export interface PersistedV2State {
  session: GoogleSession | null;
  pendingAuthMode: AuthMode | null;
  catalog: VarietyRecord[];
  creationDraft: VarietyCreationDraft | null;
  inspections: Record<string, Record<string, InspectionTask>>;
  syncQueue: QueuedOperation[];
}
