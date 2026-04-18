import AsyncStorage from '@react-native-async-storage/async-storage';

import { PersistedAppState } from '../types/app';

const STORAGE_KEY = 'sortoved-soy/app-state-v1';

export interface CollectorRepository {
  load(): Promise<PersistedAppState | null>;
  save(state: PersistedAppState): Promise<void>;
  clear(): Promise<void>;
}

class AsyncStorageCollectorRepository implements CollectorRepository {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedAppState) : null;
  }

  async save(state: PersistedAppState) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async clear() {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const collectorRepository: CollectorRepository =
  new AsyncStorageCollectorRepository();
