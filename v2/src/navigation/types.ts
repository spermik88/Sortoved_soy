export type V2RootStackParamList = {
  Start: undefined;
  Auth: { mode: 'link' | 'create' };
  Catalog: undefined;
  Creation: undefined;
  Variety: { varietyId: string };
  FusariumOverview: { varietyId: string; taskCode: string };
  FusariumCards: { varietyId: string; taskCode: string };
  ObservationTask: { varietyId: string; taskCode: string };
  MeasurementTask: { varietyId: string; taskCode: string };
  PendingTask: { varietyId: string; taskCode: string };
  Queue: undefined;
  PlaceholderRole: { role: 'analyst' | 'manager' };
};
