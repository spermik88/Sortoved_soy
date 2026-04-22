import * as Location from 'expo-location';

export interface LocationSnapshot {
  latitude: number;
  longitude: number;
  mapsUrl: string;
}

export interface LocationService {
  getCurrentLocation(): Promise<LocationSnapshot>;
}

class ExpoLocationService implements LocationService {
  async getCurrentLocation(): Promise<LocationSnapshot> {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Нет доступа к геолокации');
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const latitude = current.coords.latitude;
    const longitude = current.coords.longitude;

    return {
      latitude,
      longitude,
      mapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
    };
  }
}

export const locationService: LocationService = new ExpoLocationService();
