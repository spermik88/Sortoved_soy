import AsyncStorage from '@react-native-async-storage/async-storage';

import { PersistedV2State } from '../types/app';

const STORAGE_KEY = 'sortoved-soy/app-state-v2';

export interface V2Repository {
  load(): Promise<PersistedV2State | null>;
  save(state: PersistedV2State): Promise<void>;
  clear(): Promise<void>;
}

class AsyncStorageV2Repository implements V2Repository {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedV2State) : null;
  }

  async save(state: PersistedV2State) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async clear() {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const v2Repository: V2Repository = new AsyncStorageV2Repository();
