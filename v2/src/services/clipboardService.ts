import * as Clipboard from 'expo-clipboard';

export interface ClipboardService {
  readString(): Promise<string>;
}

class ExpoClipboardService implements ClipboardService {
  async readString() {
    return (await Clipboard.getStringAsync()).trim();
  }
}

export const clipboardService: ClipboardService = new ExpoClipboardService();
