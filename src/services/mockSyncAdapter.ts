import { SyncTask } from '../types/app';

export interface SyncAdapter {
  process(task: SyncTask): Promise<{ success: boolean }>;
}

class MockSyncAdapter implements SyncAdapter {
  async process() {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return { success: true };
  }
}

export const mockSyncAdapter: SyncAdapter = new MockSyncAdapter();
