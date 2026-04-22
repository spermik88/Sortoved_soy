import { VarietyCreationDraft } from '../types/app';
import { creationSteps } from '../config/flowRegistry';

export function useCanAdvanceCreation(stepIndex: number, draft: VarietyCreationDraft | null) {
  if (!draft) {
    return false;
  }

  const step = creationSteps[stepIndex];
  if (step.type === 'text') {
    return Boolean(draft.varietyName.trim());
  }
  if (step.type === 'location') {
    return Boolean(draft.mapsUrl);
  }
  if (step.type === 'choice' && step.plot) {
    return Boolean(draft.plots[step.plot][step.field as 'rowSpacing' | 'rowCount']);
  }
  if (step.type === 'photo' && step.plot) {
    return Boolean(draft.plots[step.plot].photoUri);
  }
  return true;
}
