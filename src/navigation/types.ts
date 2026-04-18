import { TraitCode } from '../types/app';

export type RootStackParamList = {
  RoleSelection: undefined;
  PlaceholderRole: { role: 'analyst' | 'manager' };
  QrScanner: { origin: 'onboarding' | 'varieties' | 'settings' };
  QrValidation: undefined;
  TestModeWarning: undefined;
  MainMenu: undefined;
  Varieties: undefined;
  VarietyDetail: { varietyId: string };
  Settings: undefined;
  TraitOverview: { traitCode: TraitCode; varietyId: string; plotIndex: number };
  TraitInfections: { traitCode: TraitCode; varietyId: string; plotIndex: number };
  TraitReview: { traitCode: TraitCode; varietyId: string; plotIndex: number };
  TraitCompletion: { traitCode: TraitCode; varietyId: string };
  MeasurementTraitFlow: {
    traitCode: TraitCode;
    varietyId: string;
    step: 1 | 2 | 3 | 4;
  };
  MeasurementTraitCompletion: { traitCode: TraitCode; varietyId: string };
};
