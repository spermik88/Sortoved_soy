export interface DriveService {
  uploadPhoto(accessToken: string, localUri: string, fileName: string): Promise<string>;
}

class GoogleDriveService implements DriveService {
  async uploadPhoto(accessToken: string, localUri: string, fileName: string) {
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify({ name: fileName, mimeType: 'image/jpeg' })], {
        type: 'application/json',
      }),
    );
    form.append('file', {
      uri: localUri,
      name: fileName,
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      },
    );

    if (!response.ok) {
      throw new Error(`Google Drive upload error: ${response.status}`);
    }

    const data = (await response.json()) as { id?: string; webViewLink?: string };
    return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
  }
}

export const driveService: DriveService = new GoogleDriveService();
