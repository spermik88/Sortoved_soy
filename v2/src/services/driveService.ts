export interface DriveFolderInfo {
  id: string;
  webViewLink?: string;
}

export interface DriveFileInfo extends DriveFolderInfo {
  webContentLink?: string;
}

export interface DriveService {
  findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFolderInfo>;
  createFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFolderInfo>;
  shareFolderForEditingByLink(accessToken: string, folderId: string): Promise<void>;
  assertFolderWritable(accessToken: string, folderId: string): Promise<void>;
  uploadPhoto(
    accessToken: string,
    localUri: string,
    fileName: string,
    parentId?: string,
  ): Promise<DriveFileInfo>;
}

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function driveFileUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function driveFolderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

function imageFormulaUrl(id: string) {
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

async function ensureOk(response: Response, message: string) {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }
}

class GoogleDriveService implements DriveService {
  async findOrCreateFolder(accessToken: string, name: string, parentId?: string) {
    const parentClause = parentId ? `'${parentId}' in parents and ` : '';
    const query = `${parentClause}name='${escapeDriveQueryValue(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
    const response = await fetch(
      `${DRIVE_BASE}?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    await ensureOk(response, 'Google Drive folder search error');
    const data = (await response.json()) as { files?: DriveFolderInfo[] };
    const [existing] = data.files || [];
    return existing || this.createFolder(accessToken, name, parentId);
  }

  async createFolder(accessToken: string, name: string, parentId?: string) {
    const response = await fetch(`${DRIVE_BASE}?fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      }),
    });
    await ensureOk(response, 'Google Drive folder create error');
    const data = (await response.json()) as DriveFolderInfo;
    return { ...data, webViewLink: data.webViewLink || driveFolderUrl(data.id) };
  }

  async shareFolderForEditingByLink(accessToken: string, folderId: string) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'anyone',
        role: 'writer',
        allowFileDiscovery: false,
      }),
    });
    await ensureOk(response, 'Google Drive folder sharing error');
  }

  async assertFolderWritable(accessToken: string, folderId: string) {
    const response = await fetch(
      `${DRIVE_BASE}/${folderId}?fields=id,capabilities/canAddChildren,capabilities/canEdit`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    await ensureOk(response, 'Google Drive folder access error');
    const data = (await response.json()) as {
      capabilities?: { canAddChildren?: boolean; canEdit?: boolean };
    };
    if (!data.capabilities?.canAddChildren && !data.capabilities?.canEdit) {
      throw new Error('Нет доступа к Drive-папке сорта. Получите доступ к папке и повторите попытку.');
    }
  }

  async uploadPhoto(accessToken: string, localUri: string, fileName: string, parentId?: string) {
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify({ name: fileName, mimeType: 'image/jpeg', parents: parentId ? [parentId] : undefined })], {
        type: 'application/json',
      }),
    );
    form.append('file', {
      uri: localUri,
      name: fileName,
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,webViewLink,webContentLink`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      },
    );

    await ensureOk(response, 'Google Drive upload error');

    const data = (await response.json()) as DriveFileInfo;
    return {
      ...data,
      webViewLink: data.webViewLink || driveFileUrl(data.id),
      webContentLink: data.webContentLink || imageFormulaUrl(data.id),
    };
  }
}

export const driveService: DriveService = new GoogleDriveService();
