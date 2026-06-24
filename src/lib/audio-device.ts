import { AudioDeviceInfo, DeviceCapabilities } from '@org/audio-model';

interface AudioDeviceSelection {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
}

const selectedDeviceIds: AudioDeviceSelection = {
  inputDeviceId: null,
  outputDeviceId: null,
};

export function getSelectedAudioDeviceIds(): AudioDeviceSelection {
  return { ...selectedDeviceIds };
}

export interface AudioDeviceAdapter {
  getCapabilities(): Promise<DeviceCapabilities>;
  listDevices(): Promise<AudioDeviceInfo[]>;
  setInputDevice(deviceId: string): Promise<void>;
  setOutputDevice(deviceId: string): Promise<void>;
  watchDeviceChanges(callback: () => void): void;
  dispose(): void;
}

export class BrowserAudioDeviceAdapter implements AudioDeviceAdapter {
  private selectedInputDeviceId: string | null = null;
  private selectedOutputDeviceId: string | null = null;
  private deviceChangeCallback: (() => void) | null = null;
  private readonly boundOnDeviceChange: () => void;

  constructor() {
    this.boundOnDeviceChange = () => {
      this.deviceChangeCallback?.();
    };
  }

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
    const audioDevices = devices.filter(
      (
        device,
      ): device is MediaDeviceInfo & {
        kind: 'audioinput' | 'audiooutput';
      } => device.kind === 'audioinput' || device.kind === 'audiooutput',
    );

    return audioDevices.map((device) => ({
      id: device.deviceId,
      label: device.label || `Unknown ${device.kind}`,
      kind: device.kind,
    }));
  }

  async setInputDevice(deviceId: string): Promise<void> {
    await this.ensureDeviceExists('audioinput', deviceId);
    this.selectedInputDeviceId = deviceId;
    selectedDeviceIds.inputDeviceId = deviceId;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    await this.ensureDeviceExists('audiooutput', deviceId);
    this.selectedOutputDeviceId = deviceId;
    selectedDeviceIds.outputDeviceId = deviceId;
  }

  watchDeviceChanges(callback: () => void): void {
    this.deviceChangeCallback = callback;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.addEventListener
    ) {
      navigator.mediaDevices.addEventListener(
        'devicechange',
        this.boundOnDeviceChange,
      );
    }
  }

  dispose(): void {
    this.deviceChangeCallback = null;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.removeEventListener
    ) {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        this.boundOnDeviceChange,
      );
    }
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

  private async ensureDeviceExists(
    kind: AudioDeviceInfo['kind'],
    deviceId: string,
  ): Promise<void> {
    const devices = await this.listDevices();
    const matchedDevice = devices.find(
      (device) => device.kind === kind && device.id === deviceId,
    );

    if (!matchedDevice) {
      throw new Error(`Unknown ${kind} device id: ${deviceId}`);
    }
  }
}
