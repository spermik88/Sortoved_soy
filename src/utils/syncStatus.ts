import { t } from '../i18n';
import { FusariumPlotDraft, SyncTaskStatus } from '../types/app';

export function getSyncStatusText(
  status: FusariumPlotDraft['syncStatus'] | SyncTaskStatus | 'idle',
) {
  switch (status) {
    case 'queued':
      return t('fusarium.statusQueued');
    case 'waiting_for_network':
      return t('fusarium.statusWaitingNetwork');
    case 'processing':
    case 'syncing':
      return t('fusarium.statusProcessing');
    case 'success':
    case 'synced':
      return t('fusarium.statusSuccess');
    case 'failed':
      return t('fusarium.statusFailed');
    default:
      return t('fusarium.statusIdle');
  }
}
