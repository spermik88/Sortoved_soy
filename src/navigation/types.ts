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
  FusariumOverview: { varietyId: string; plotIndex: number };
  FusariumInfections: { varietyId: string; plotIndex: number };
  FusariumReview: { varietyId: string; plotIndex: number };
};
