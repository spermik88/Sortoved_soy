import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStorage = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
      }),
      clear: jest.fn(async () => {
        mockStorage.clear();
      }),
    },
  };
});

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addNetworkStateListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///mock-photo.jpg' }],
  })),
  CameraType: {
    back: 'back',
  },
}));
