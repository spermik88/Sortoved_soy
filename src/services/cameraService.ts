import * as ImagePicker from 'expo-image-picker';

export type CameraCaptureResult =
  | { kind: 'success'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'permission_denied' };

export interface CameraService {
  capturePhoto(): Promise<CameraCaptureResult>;
}

class ExpoCameraService implements CameraService {
  async capturePhoto(): Promise<CameraCaptureResult> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      return { kind: 'permission_denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.back,
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return { kind: 'cancelled' };
    }

    return { kind: 'success', uri: result.assets[0].uri };
  }
}

export const cameraService: CameraService = new ExpoCameraService();
