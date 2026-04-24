export type ScreenId = string;

export type VarietySource = 'created' | 'linked';
export type QueueStatus = 'queued' | 'processing' | 'synced' | 'failed' | 'waiting_for_auth';
export type TaskKind = 'infection' | 'measurement' | 'observation';
export type DiseaseSheetKey =
  | 'fusarium_sheet'
  | 'septoria_sheet'
  | 'flea_sheet'
  | 'bacteriosis_sheet'
  | 'peronosporosis_sheet'
  | 'cercosporosis_sheet'
  | 'aphid_damage_sheet';
export type ChoiceSheetKey =
  | 'flower_color_sheet'
  | 'leaf_shape_sheet'
  | 'stem_pubescence_color_sheet';
export type ScoreSheetKey =
  | 'lodging_resistance_sheet'
  | 'shattering_resistance_sheet';
export type YieldSheetKey = 'yield_per_area_sheet';
export type ThousandSeedWeightSheetKey = 'thousand_seed_weight_sheet';
export type ProteinContentSheetKey = 'protein_content_sheet';
export type FatContentSheetKey = 'fat_content_sheet';
export type StructureSheetKey =
  | 'stem_length_sheet'
  | 'lower_pod_attachment_sheet'
  | 'productive_nodes_sheet'
  | 'branch_count_sheet'
  | 'productive_pods_sheet'
  | 'pods_per_node_sheet'
  | 'seeds_per_plant_sheet'
  | 'seeds_per_pod_sheet'
  | 'seed_weight_per_plant_sheet';
export type PhenologySheetKey =
  | 'start_flowering_sheet'
  | 'full_flowering_sheet'
  | 'end_flowering_sheet'
  | 'full_maturity_sheet';
export type LocalSheetKey =
  | DiseaseSheetKey
  | ChoiceSheetKey
  | ScoreSheetKey
  | YieldSheetKey
  | ThousandSeedWeightSheetKey
  | ProteinContentSheetKey
  | FatContentSheetKey
  | StructureSheetKey
  | PhenologySheetKey;
export type TaskFlowKind =
  | 'infection_split'
  | 'disease_cards'
  | 'choice_by_plot'
  | 'score_by_plot'
  | 'yield_by_plot'
  | 'thousand_seed_weight_step'
  | 'protein_content_step'
  | 'fat_content_step'
  | 'structure_by_sampling'
  | 'phenology_by_plot'
  | 'observation_single'
  | 'measurement_cards'
  | 'placeholder_pending_spec';
export type AuthMode = 'link' | 'create';
export type TaskUiStatus =
  | 'not_started'
  | 'draft'
  | 'ready_local'
  | 'queued'
  | 'analysis_invalid'
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
  localWorkbookPath?: string;
  localWorkbook?: Record<string, (string | number | boolean)[][]>;
  sheetAliases?: Partial<Record<LocalSheetKey, string>>;
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
  syncStatus?: 'draft' | 'queued' | 'synced' | 'failed';
  queuedOperationId?: string;
  capturedAt?: string;
  capturedLocation?: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
  };
  localWorkbookRow?: number;
}

export interface PhenologyPlotDraft {
  plot: '1' | '2' | '3';
  photoUri?: string;
  confirmed: boolean;
  capturedAt?: string;
  capturedLocation?: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
  };
  isComplete: boolean;
}

export interface ChoicePlotDraft {
  plot: '1' | '2' | '3';
  photoUri?: string;
  selectedValue?: string;
  capturedAt?: string;
  capturedLocation?: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
  };
  isComplete: boolean;
}

export interface ScorePlotDraft {
  plot: '1' | '2' | '3';
  photoUri?: string;
  selectedScore?: string;
  capturedAt?: string;
  capturedLocation?: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
  };
  isComplete: boolean;
}

export interface YieldPlotDraft {
  plot: '1' | '2' | '3';
  rawGrainMassKg?: string;
  moisturePercent?: string;
  areaSquareMeters: number;
  yieldTonsPerHectare?: string;
  isComplete: boolean;
}

export type SeedWeightPair = '1+2' | '1+3' | '2+3';

export interface CandidatePairResult {
  pair: SeedWeightPair;
  sumWeight: number;
  actualDifference: number;
  allowedDifference: number;
  isAllowed: boolean;
  finalWeight: number;
}

export interface ThousandSeedWeightDraft {
  sample1Weight?: string;
  sample2Weight?: string;
  sample3Weight?: string;
  requiresThirdSample: boolean;
  candidatePairs: CandidatePairResult[];
  selectedPair?: SeedWeightPair;
  sumWeight?: string;
  actualDifference?: string;
  allowedDifference?: string;
  finalWeight?: string;
  analysisStatus: 'valid' | 'invalid';
  isComplete: boolean;
}

export interface ProteinContentDraft {
  sampleSource: 'средняя проба';
  sampleMassGrams?: string;
  analysisMethod: 'Инфракрасный анализатор';
  proteinPercent?: string;
  sampleToleranceStatus: 'valid' | 'out_of_tolerance';
  isComplete: boolean;
}

export interface FatContentDraft {
  sampleSource: 'средняя проба';
  sampleMassGrams?: string;
  analysisMethod: 'Инфракрасный анализатор';
  fatPercent?: string;
  sampleToleranceStatus: 'valid' | 'out_of_tolerance';
  isComplete: boolean;
}

export interface StructurePlantCardDraft {
  id: string;
  samplingId: '1' | '2';
  photoUri?: string;
  plantNumber?: string;
  value?: string;
  capturedAt?: string;
  capturedLocation?: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
  };
  isComplete: boolean;
}

export interface StructureSamplingDraft {
  samplingId: '1' | '2';
  plot?: '1' | '2' | '3';
  cards: StructurePlantCardDraft[];
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
  phenologyPlots?: Record<'1' | '2' | '3', PhenologyPlotDraft>;
  choicePlots?: Record<'1' | '2' | '3', ChoicePlotDraft>;
  scorePlots?: Record<'1' | '2' | '3', ScorePlotDraft>;
  yieldPlots?: Record<'1' | '2' | '3', YieldPlotDraft>;
  thousandSeedWeight?: ThousandSeedWeightDraft;
  proteinContent?: ProteinContentDraft;
  fatContent?: FatContentDraft;
  samplings?: Record<'1' | '2', StructureSamplingDraft>;
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
