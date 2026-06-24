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
import { getSelectedAudioDeviceIds } from '@org/audio-device';

export interface AudioEngine {
  initialize(): Promise<void>;
  applySession(session: MixerSession): Promise<void>;
  applyParameterChange(change: AudioParameterChange): void;
  getHealthSnapshot(): AudioHealthSnapshot;
  dispose(): Promise<void>;
}

function gainDbToLinear(gainDb: number): number {
  return Math.pow(10, clampGainDb(gainDb) / 20);
}

interface ChannelNodes {
  gain: GainNode;
  pan: StereoPannerNode;
}

export class BrowserAudioEngine implements AudioEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private session: MixerSession = { channels: [] };
  private initialized = false;
  private readonly channelNodes = new Map<string, ChannelNodes>();
  private readonly health: AudioHealthSnapshot = {
    dropoutCount: 0,
    estimatedLatencyMs: undefined,
  };

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      return;
    }

    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    this.health.estimatedLatencyMs =
      typeof this.audioContext.baseLatency === 'number'
        ? this.audioContext.baseLatency * 1_000
        : undefined;
  }

  async applySession(session: MixerSession): Promise<void> {
    assertValidMixerSession(session);
    this.session = normalizeMixerSession(session);

    if (!this.initialized) {
      return;
    }

    if (!this.audioContext) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      return;
    }

    try {
      await this.rebuildGraph();
    } catch {
      // Keep app responsive even when media permissions or device state fail.
      this.health.dropoutCount += 1;
    }
  }

  applyParameterChange(change: AudioParameterChange): void {
    if (!this.initialized || this.session.channels.length === 0) {
      return;
    }

    this.session = {
      ...this.session,
      channels: this.session.channels.map((channel) => {
        if (channel.id !== change.channelId) {
          return channel;
        }

        return this.applyChannelParameter(channel, change);
      }),
    };

    const changedChannel = this.session.channels.find(
      (channel) => channel.id === change.channelId,
    );

    if (!changedChannel) {
      return;
    }

    const nodes = this.channelNodes.get(changedChannel.id);
    if (!nodes || !this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    nodes.pan.pan.setTargetAtTime(changedChannel.pan, now, 0.01);
    nodes.gain.gain.setTargetAtTime(
      this.computeEffectiveLinearGain(changedChannel),
      now,
      0.01,
    );
  }

  getHealthSnapshot(): AudioHealthSnapshot {
    return { ...this.health };
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    this.session = { channels: [] };
    this.channelNodes.clear();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  private async rebuildGraph(): Promise<void> {
    const context = this.audioContext;
    if (!context) {
      return;
    }

    const { inputDeviceId } = getSelectedAudioDeviceIds();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: inputDeviceId
        ? { deviceId: { exact: inputDeviceId } }
        : { echoCancellation: false, noiseSuppression: false },
    });

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
    }
    this.mediaStream = stream;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    this.sourceNode = context.createMediaStreamSource(stream);

    this.channelNodes.clear();

    const inputChannel = this.findChannelByType('input');
    const internalChannel = this.findChannelByType('internal');
    const outputChannel = this.findChannelByType('output');

    if (!inputChannel || !internalChannel || !outputChannel) {
      return;
    }

    const inputNodes = this.createChannelNodes(inputChannel);
    const internalNodes = this.createChannelNodes(internalChannel);
    const outputNodes = this.createChannelNodes(outputChannel);

    this.sourceNode.connect(inputNodes.gain);
    inputNodes.gain.connect(inputNodes.pan);
    inputNodes.pan.connect(internalNodes.gain);
    internalNodes.gain.connect(internalNodes.pan);
    internalNodes.pan.connect(outputNodes.gain);
    outputNodes.gain.connect(outputNodes.pan);
    outputNodes.pan.connect(context.destination);
  }

  private createChannelNodes(channel: MixerChannel): ChannelNodes {
    const context = this.audioContext;
    if (!context) {
      throw new Error('Audio context not initialized.');
    }

    const gain = context.createGain();
    const pan = context.createStereoPanner();
    gain.gain.value = this.computeEffectiveLinearGain(channel);
    pan.pan.value = channel.pan;

    const nodes = { gain, pan };
    this.channelNodes.set(channel.id, nodes);
    return nodes;
  }

  private findChannelByType(type: MixerChannel['type']): MixerChannel | null {
    return (
      this.session.channels.find((channel) => channel.type === type) ?? null
    );
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

  private computeEffectiveLinearGain(channel: MixerChannel): number {
    const hasSolo = this.session.channels.some((candidate) => candidate.solo);
    const soloSuppressed = hasSolo && !channel.solo;
    const muted = channel.muted || soloSuppressed;
    if (muted) {
      return 0;
    }

    return gainDbToLinear(channel.gainDb);
  }
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
