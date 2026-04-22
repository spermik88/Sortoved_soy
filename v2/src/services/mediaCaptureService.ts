import { cameraService, CameraCaptureResult } from '../../../src/services/cameraService';

export interface MediaCaptureService {
  capturePhoto(): Promise<CameraCaptureResult>;
}

export const mediaCaptureService: MediaCaptureService = {
  capturePhoto() {
    return cameraService.capturePhoto();
  },
};
