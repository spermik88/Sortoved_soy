import { driveService } from './driveService';
import { getTaskFlowAdapter } from './taskFlowAdapters';
import { sheetsService } from './sheetsService';
import { PLOTS_SHEET_NAME, SHEET_ALIASES } from '../config/templateSchema';
import {
  InspectionTask,
  LocalSheetKey,
  QueuedMediaUpload,
  QueuedOperation,
  GoogleSession,
  VarietyRecord,
} from '../types/app';

export interface SyncQueueDependencies {
  session: GoogleSession | null;
  catalog: VarietyRecord[];
  task?: InspectionTask;
}

function prepareWrites(
  variety: VarietyRecord,
  operation: QueuedOperation,
) {
  return (operation.writes || []).map((rawWrite) => {
    const write = retargetWriteToRemoteSheet(variety, rawWrite);
    if (!operation.media?.length) {
      return write;
    }

    let mediaIndex = 0;
    return {
      ...write,
      values: write.values.map((row) =>
        row.map((cell) => {
          if (cell !== 'photo_pending_upload') {
            return cell;
          }

          const mediaItem = operation.media?.[mediaIndex];
          mediaIndex += 1;
          return mediaItem?.remoteId && mediaItem.remoteUrl
            ? driveImageFormula(mediaItem.remoteId, mediaItem.remoteUrl)
            : mediaItem?.remoteUrl || '';
        }),
      ),
    };
  });
}

function resolveRemoteWriteSheet(variety: VarietyRecord, sheet: string) {
  const match = Object.entries(SHEET_ALIASES).find(([, alias]) => alias.local === sheet);
  if (!match) {
    return sheet;
  }

  const [logicalKey, alias] = match;
  return variety.setup?.sheetAliases?.[logicalKey as LocalSheetKey] || alias.futureRemote;
}

function retargetWriteToRemoteSheet(variety: VarietyRecord, write: NonNullable<QueuedOperation['writes']>[number]) {
  const sheet = resolveRemoteWriteSheet(variety, write.sheet);
  return {
    ...write,
    sheet,
    range: write.range?.startsWith(`${write.sheet}!`)
      ? `${sheet}!${write.range.slice(write.sheet.length + 1)}`
      : write.range,
  };
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

function formatFileTimestamp(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildPhotoFileName(sheet: string, capturedAt: string | undefined, email: string | undefined, index: number) {
  return `${sanitizeFileNamePart(sheet)}__${formatFileTimestamp(capturedAt)}__${sanitizeFileNamePart(email || 'unknown')}__${index}.jpg`;
}

function driveImageFormula(fileId: string, fallbackUrl: string) {
  const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  return `=IFERROR(IMAGE("${imageUrl}",4,180,240),"${fallbackUrl}")`;
}

export async function processQueuedOperation(
  operation: QueuedOperation,
  deps: SyncQueueDependencies,
) {
  if (!deps.session?.accessToken) {
    const error = new Error('Нет Google-сессии для синхронизации');
    (error as Error & { authRequired?: boolean }).authRequired = true;
    throw error;
  }

  const variety = operation.varietyId
    ? deps.catalog.find((item) => item.id === operation.varietyId)
    : undefined;

  if (operation.type === 'create_variety' && variety && operation.writes?.length) {
    await sheetsService.writeOperations(
      deps.session.accessToken,
      variety.binding.spreadsheetId,
      prepareWrites(variety, { ...operation, media: [] }),
    );
    operation.writes = [];
  }

  if (operation.media?.length) {
    for (let index = 0; index < operation.media.length; index += 1) {
      const media: QueuedMediaUpload = operation.media[index];
      if (!media.remoteUrl) {
        const targetSheet = media.targetSheet || PLOTS_SHEET_NAME;
        const folderId = variety?.setup?.drive?.foldersBySheet?.[targetSheet]?.folderId;
        if (variety?.setup?.drive?.varietyFolderId) {
          await driveService.assertFolderWritable(deps.session.accessToken, variety.setup.drive.varietyFolderId);
        }
        if (!folderId) {
          throw new Error('Не найдена Drive-папка для загрузки фото сорта');
        }
        const uploaded = await driveService.uploadPhoto(
          deps.session.accessToken,
          media.localUri,
          buildPhotoFileName(targetSheet, media.capturedAt, deps.session.email, index + 1),
          folderId,
        );
        media.remoteId = uploaded.id;
        media.remoteUrl = uploaded.webViewLink || uploaded.webContentLink || '';
      }
    }
  }

  if (!variety || !operation.varietyId) {
    return operation;
  }

  const taskCode = String((operation.payload as Record<string, unknown>).taskCode || operation.screenId || '');
  const adapter = taskCode ? getTaskFlowAdapter(taskCode) : null;

  if (adapter) {
    if (!deps.task) {
      throw new Error('Не найден task для cloud sync');
    }
    operation.writes = adapter.buildGoogleWriteOperations(
      variety,
      deps.task,
      variety.setup?.sheetAliases,
      operation,
    );

    if (operation.writes.some((write) => write.strategy === 'replace')) {
      const targetSheet = variety.setup?.sheetAliases?.[adapter.logicalSheetKey] || SHEET_ALIASES[adapter.logicalSheetKey].futureRemote;
      const currentValues = await sheetsService.readSheet(
        deps.session.accessToken,
        variety.binding.spreadsheetId,
        targetSheet,
      );
      if (adapter.isTaskCompletedInGoogle(currentValues)) {
        operation.writes = [];
      }
    }
  }

  if (operation.type !== 'create_variety' && operation.writes?.length) {
    await sheetsService.writeOperations(
      deps.session.accessToken,
      variety.binding.spreadsheetId,
      prepareWrites(variety, operation),
    );
  }

  return operation;
}
