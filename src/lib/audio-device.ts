import { AudioDeviceInfo, DeviceCapabilities } from '@org/audio-model';

export interface AudioDeviceAdapter {
  getCapabilities(): Promise<DeviceCapabilities>;
  listDevices(): Promise<AudioDeviceInfo[]>;
  setInputDevice(deviceId: string): Promise<void>;
  setOutputDevice(deviceId: string): Promise<void>;
}

export class BrowserAudioDeviceAdapter implements AudioDeviceAdapter {
  private selectedInputDeviceId: string | null = null;
  private selectedOutputDeviceId: string | null = null;

  async getCapabilities(): Promise<DeviceCapabilities> {
    const outputSelectionSupported =
      typeof HTMLMediaElement !== 'undefined' &&
      typeof (HTMLMediaElement.prototype as { setSinkId?: unknown })
        .setSinkId === 'function';

    return { outputSelectionSupported };
  }

  async listDevices(): Promise<AudioDeviceInfo[]> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
      .filter(
        (device) =>
          device.kind === 'audioinput' || device.kind === 'audiooutput',
      )
      .map((device) => ({
        id: device.deviceId,
        label: device.label || `Unknown ${device.kind}`,
        kind: device.kind,
      }));
  }

  async setInputDevice(deviceId: string): Promise<void> {
    this.selectedInputDeviceId = deviceId;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    this.selectedOutputDeviceId = deviceId;
  }

  getSelectedDeviceIds(): {
    inputDeviceId: string | null;
    outputDeviceId: string | null;
  } {
    return {
      inputDeviceId: this.selectedInputDeviceId,
      outputDeviceId: this.selectedOutputDeviceId,
    };
  }
}
