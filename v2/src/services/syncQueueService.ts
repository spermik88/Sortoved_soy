import { driveService } from './driveService';
import { sheetsService } from './sheetsService';
import { QueuedOperation, GoogleSession, VarietyRecord } from '../types/app';

export interface SyncQueueDependencies {
  session: GoogleSession | null;
  catalog: VarietyRecord[];
}

export async function processQueuedOperation(
  operation: QueuedOperation,
  deps: SyncQueueDependencies,
) {
  if (!deps.session?.accessToken) {
    throw new Error('Нет Google-сессии для синхронизации');
  }

  if (operation.media?.length) {
    for (let index = 0; index < operation.media.length; index += 1) {
      const media = operation.media[index];
      if (!media.remoteUrl) {
        media.remoteUrl = await driveService.uploadPhoto(
          deps.session.accessToken,
          media.localUri,
          `sortoved-${operation.id}-${index + 1}.jpg`,
        );
      }
    }
  }

  if (operation.writes?.length && operation.varietyId) {
    const variety = deps.catalog.find((item) => item.id === operation.varietyId);
    if (!variety) {
      throw new Error('Связанный сорт для синхронизации не найден');
    }

    await sheetsService.writeOperations(
      deps.session.accessToken,
      variety.binding.spreadsheetId,
      operation.writes,
    );
  }
}
