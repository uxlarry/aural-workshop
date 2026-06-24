import {
  AudioDeviceInfo,
  AudioHealthSnapshot,
  AudioParameterChange,
  DeviceCapabilities,
  MixerSession,
  assertValidMixerSession,
  normalizeMixerSession,
} from '@org/audio-model';
import { AudioEngine, BrowserAudioEngine } from '@org/audio-engine';
import {
  AudioDeviceAdapter,
  BrowserAudioDeviceAdapter,
} from '@org/audio-device';
import { OutputRoutingStatus } from '@org/audio-engine';
export type { OutputRoutingStatus } from '@org/audio-engine';

export interface OrchestrationPolicy {
  parameterDebounceMs: number;
}

const DEFAULT_ORCHESTRATION_POLICY: OrchestrationPolicy = {
  parameterDebounceMs: 16,
};

export interface AudioOrchestrationFacade {
  start(session: MixerSession): Promise<void>;
  changeParameter(change: AudioParameterChange): void;
  saveSession(): MixerSession | null;
  restoreSession(session: MixerSession): Promise<void>;
  readHealth(): AudioHealthSnapshot;
  getCapabilities(): Promise<DeviceCapabilities>;
  listDevices(): Promise<AudioDeviceInfo[]>;
  setInputDevice(deviceId: string): Promise<void>;
  setOutputDevice(deviceId: string): Promise<void>;
  getOutputRoutingStatus(): OutputRoutingStatus;
  stop(): Promise<void>;
}

export class DefaultAudioOrchestrationFacade implements AudioOrchestrationFacade {
  private started = false;
  private currentSession: MixerSession | null = null;
  private parameterFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pendingParameterChanges = new Map<
    string,
    AudioParameterChange
  >();

  constructor(
    private readonly engine: AudioEngine,
    private readonly deviceAdapter: AudioDeviceAdapter,
    private readonly policy: OrchestrationPolicy = DEFAULT_ORCHESTRATION_POLICY,
  ) {}

  async start(session: MixerSession): Promise<void> {
    const normalizedSession = this.prepareSession(session);

    if (!this.started) {
      await this.engine.initialize();
      this.started = true;
    }

    await this.engine.applySession(normalizedSession);
    this.currentSession = normalizedSession;
  }

  changeParameter(change: AudioParameterChange): void {
    const key = this.getChangeKey(change);
    this.pendingParameterChanges.set(key, change);
    this.scheduleParameterFlush();
  }

  saveSession(): MixerSession | null {
    this.flushPendingParameterChanges();

    const engineSession = this.engine.getSessionSnapshot();
    if (engineSession) {
      this.currentSession = engineSession;
    }

    if (!this.currentSession) {
      return null;
    }

    return {
      ...this.currentSession,
      channels: this.currentSession.channels.map((channel) => ({ ...channel })),
    };
  }

  async restoreSession(session: MixerSession): Promise<void> {
    await this.start(session);
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
    if (this.currentSession) {
      await this.engine.applySession(this.currentSession);
    }
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    await this.deviceAdapter.setOutputDevice(deviceId);
    await this.engine.setOutputDevice(deviceId);
  }

  getOutputRoutingStatus(): OutputRoutingStatus {
    return this.engine.getOutputRoutingStatus();
  }

  async stop(): Promise<void> {
    this.flushPendingParameterChanges();
    if (this.parameterFlushTimer) {
      clearTimeout(this.parameterFlushTimer);
      this.parameterFlushTimer = null;
    }
    await this.engine.dispose();
    this.started = false;
    this.currentSession = null;
  }

  flushPendingParameterChanges(): void {
    if (this.pendingParameterChanges.size === 0) {
      return;
    }

    for (const pendingChange of this.pendingParameterChanges.values()) {
      this.engine.applyParameterChange(pendingChange);
      this.currentSession = this.applyChangeToSession(
        this.currentSession,
        pendingChange,
      );
    }

    this.pendingParameterChanges.clear();
  }

  private prepareSession(session: MixerSession): MixerSession {
    assertValidMixerSession(session);
    return normalizeMixerSession(session);
  }

  private scheduleParameterFlush(): void {
    if (this.parameterFlushTimer) {
      clearTimeout(this.parameterFlushTimer);
    }

    this.parameterFlushTimer = setTimeout(() => {
      this.parameterFlushTimer = null;
      this.flushPendingParameterChanges();
    }, this.policy.parameterDebounceMs);
  }

  private getChangeKey(change: AudioParameterChange): string {
    return `${change.channelId}:${change.parameter}`;
  }

  private applyChangeToSession(
    session: MixerSession | null,
    change: AudioParameterChange,
  ): MixerSession | null {
    if (!session) {
      return null;
    }

    return {
      ...session,
      channels: session.channels.map((channel) => {
        if (channel.id !== change.channelId) {
          return channel;
        }

        if (change.parameter === 'gainDb' || change.parameter === 'pan') {
          return { ...channel, [change.parameter]: Number(change.value) };
        }

        return { ...channel, [change.parameter]: Boolean(change.value) };
      }),
    };
  }
}

export function createDefaultAudioOrchestration(): AudioOrchestrationFacade {
  return new DefaultAudioOrchestrationFacade(
    new BrowserAudioEngine(),
    new BrowserAudioDeviceAdapter(),
  );
}
