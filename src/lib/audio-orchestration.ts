import {
  AudioDeviceInfo,
  AudioHealthSnapshot,
  AudioParameterChange,
  DeviceCapabilities,
  MixerSession,
} from '@org/audio-model';
import {
  AudioEngine,
  NoopAudioEngine,
} from '@org/audio-engine';
import {
  AudioDeviceAdapter,
  BrowserAudioDeviceAdapter,
} from '@org/audio-device';

export interface AudioOrchestrationFacade {
  start(session: MixerSession): Promise<void>;
  changeParameter(change: AudioParameterChange): void;
  readHealth(): AudioHealthSnapshot;
  getCapabilities(): Promise<DeviceCapabilities>;
  listDevices(): Promise<AudioDeviceInfo[]>;
  setInputDevice(deviceId: string): Promise<void>;
  setOutputDevice(deviceId: string): Promise<void>;
  stop(): Promise<void>;
}

export class DefaultAudioOrchestrationFacade implements AudioOrchestrationFacade {
  constructor(
    private readonly engine: AudioEngine,
    private readonly deviceAdapter: AudioDeviceAdapter
  ) {}

  async start(session: MixerSession): Promise<void> {
    await this.engine.initialize();
    await this.engine.applySession(session);
  }

  changeParameter(change: AudioParameterChange): void {
    this.engine.applyParameterChange(change);
  }

  readHealth(): AudioHealthSnapshot {
    return this.engine.getHealthSnapshot();
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return this.deviceAdapter.getCapabilities();
  }

  async listDevices(): Promise<AudioDeviceInfo[]> {
    return this.deviceAdapter.listDevices();
  }

  async setInputDevice(deviceId: string): Promise<void> {
    await this.deviceAdapter.setInputDevice(deviceId);
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    await this.deviceAdapter.setOutputDevice(deviceId);
  }

  async stop(): Promise<void> {
    await this.engine.dispose();
  }
}

export function createDefaultAudioOrchestration(): AudioOrchestrationFacade {
  return new DefaultAudioOrchestrationFacade(
    new NoopAudioEngine(),
    new BrowserAudioDeviceAdapter()
  );
}
