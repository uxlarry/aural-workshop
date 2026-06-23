import {
  AudioHealthSnapshot,
  AudioParameterChange,
  MixerChannel,
  MixerSession,
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
  private readonly health: AudioHealthSnapshot = {
    dropoutCount: 0,
    estimatedLatencyMs: 0,
  };

  async initialize(): Promise<void> {
    // Placeholder for AudioContext and graph initialization.
  }

  async applySession(session: MixerSession): Promise<void> {
    this.session = {
      ...session,
      channels: session.channels.map((channel) => ({ ...channel })),
    };
  }

  applyParameterChange(change: AudioParameterChange): void {
    this.session = {
      ...this.session,
      channels: this.session.channels.map((channel) =>
        channel.id === change.channelId
          ? this.applyChannelParameter(channel, change)
          : channel
      ),
    };
  }

  getHealthSnapshot(): AudioHealthSnapshot {
    return { ...this.health };
  }

  async dispose(): Promise<void> {
    this.session = { channels: [] };
  }

  private applyChannelParameter(
    channel: MixerChannel,
    change: AudioParameterChange
  ): MixerChannel {
    if (change.parameter === 'gainDb' || change.parameter === 'pan') {
      return {
        ...channel,
        [change.parameter]: Number(change.value),
      };
    }

    return {
      ...channel,
      [change.parameter]: Boolean(change.value),
    };
  }
}
