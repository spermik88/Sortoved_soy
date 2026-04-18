import { t } from '../i18n';
import { SyncTaskStatus, TraitPlotDraft } from '../types/app';

export function getSyncStatusText(
  status: TraitPlotDraft['syncStatus'] | SyncTaskStatus | 'idle',
) {
  switch (status) {
    case 'queued':
      return t('traitFlow.statusQueued');
    case 'waiting_for_network':
      return t('traitFlow.statusWaitingNetwork');
    case 'processing':
    case 'syncing':
      return t('traitFlow.statusProcessing');
    case 'success':
    case 'synced':
      return t('traitFlow.statusSuccess');
    case 'failed':
      return t('traitFlow.statusFailed');
    default:
      return t('traitFlow.statusIdle');
  }
}
