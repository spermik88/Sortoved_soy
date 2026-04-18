import * as Network from 'expo-network';

export async function isInternetReachable() {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export function subscribeToNetwork(
  callback: (isConnected: boolean) => void,
) {
  return Network.addNetworkStateListener((state) => {
    callback(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
}
