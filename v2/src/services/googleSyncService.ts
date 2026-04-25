import { InspectionTask, VarietyRecord } from '../types/app';
import { getTaskFlowAdapter } from './taskFlowAdapters';
import { sheetsService } from './sheetsService';

export async function syncTaskReadState(
  accessToken: string,
  variety: VarietyRecord,
  task: InspectionTask,
): Promise<InspectionTask> {
  const adapter = getTaskFlowAdapter(task.code);
  if (!adapter) {
    return task;
  }

  const sheet = variety.setup?.sheetAliases?.[adapter.logicalSheetKey];
  if (!sheet) {
    return task;
  }

  const values = await sheetsService.readSheet(accessToken, variety.binding.spreadsheetId, sheet);
  if (!adapter.isTaskCompletedInGoogle(values)) {
    return task;
  }

  return {
    ...task,
    uiStatus: 'locked_by_google',
    cloudStatus: 'locked_by_google',
    cloudLockedAt: new Date().toISOString(),
    completedAt: task.completedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phenologyPlots: task.flowKind === 'phenology_by_plot' ? undefined : task.phenologyPlots,
    choicePlots: task.flowKind === 'choice_by_plot' ? undefined : task.choicePlots,
    scorePlots: task.flowKind === 'score_by_plot' ? undefined : task.scorePlots,
    yieldPlots: task.flowKind === 'yield_by_plot' ? undefined : task.yieldPlots,
  };
}
