import {
  AudioHealthSnapshot,
  AudioParameterChange,
  MixerChannel,
  MixerSession,
  assertValidMixerSession,
  clampGainDb,
  clampPan,
  normalizeMixerSession,
} from '@org/audio-model';

export interface AudioEngine {
  initialize(): Promise<void>;
  applySession(session: MixerSession): Promise<void>;
  applyParameterChange(change: AudioParameterChange): void;
  getHealthSnapshot(): AudioHealthSnapshot;
  dispose(): Promise<void>;
}

export class NoopAudioEngine implements AudioEngine {
  private session: MixerSession = { channels: [] };
  private initialized = false;
  private readonly health: AudioHealthSnapshot = {
    dropoutCount: 0,
    estimatedLatencyMs: 0,
  };

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async applySession(session: MixerSession): Promise<void> {
    assertValidMixerSession(session);
    this.session = normalizeMixerSession(session);
  }

  applyParameterChange(change: AudioParameterChange): void {
    if (!this.initialized || this.session.channels.length === 0) {
      return;
    }

    let didApplyChange = false;
    this.session = {
      ...this.session,
      channels: this.session.channels.map((channel) => {
        if (channel.id !== change.channelId) {
          return channel;
        }

        didApplyChange = true;
        return this.applyChannelParameter(channel, change);
      }),
    };

    if (!didApplyChange) {
      return;
    }
  }

  getHealthSnapshot(): AudioHealthSnapshot {
    return { ...this.health };
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    this.session = { channels: [] };
  }

  private applyChannelParameter(
    channel: MixerChannel,
    change: AudioParameterChange,
  ): MixerChannel {
    if (change.parameter === 'gainDb' || change.parameter === 'pan') {
      const numericValue = Number(change.value);
      return {
        ...channel,
        [change.parameter]:
          change.parameter === 'gainDb'
            ? clampGainDb(numericValue)
            : clampPan(numericValue),
      };
    }

    return {
      ...channel,
      [change.parameter]: Boolean(change.value),
    };
  }
}
