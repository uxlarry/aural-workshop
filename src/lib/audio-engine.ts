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

type SinkSelectableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export interface OutputRoutingStatus {
  state: 'default' | 'applied' | 'unsupported' | 'failed';
  message: string;
  deviceId?: string;
}

export interface AudioEngine {
  initialize(): Promise<void>;
  applySession(session: MixerSession): Promise<void>;
  applyParameterChange(change: AudioParameterChange): void;
  setOutputDevice(deviceId: string): Promise<void>;
  resetHealthCounters(): void;
  getSessionSnapshot(): MixerSession | null;
  getOutputRoutingStatus(): OutputRoutingStatus;
  getHealthSnapshot(): AudioHealthSnapshot;
  dispose(): Promise<void>;
}

function gainDbToLinear(gainDb: number): number {
  return Math.pow(10, clampGainDb(gainDb) / 20);
}

interface ChannelNodes {
  gain: GainNode;
  pan: StereoPannerNode;
  meter: AnalyserNode;
  meterBuffer: Float32Array<ArrayBuffer>;
}

export class BrowserAudioEngine implements AudioEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private monitorDestination: MediaStreamAudioDestinationNode | null = null;
  private monitorElement: SinkSelectableAudioElement | null = null;
  private selectedOutputDeviceId: string | null = null;
  private outputRoutingStatus: OutputRoutingStatus = {
    state: 'default',
    message: 'Using system default output device.',
  };
  private session: MixerSession = { channels: [] };
  private initialized = false;
  private readonly channelNodes = new Map<string, ChannelNodes>();
  private meterTimer: ReturnType<typeof setInterval> | null = null;
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
      await this.applyOutputSinkSelection();
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

  getSessionSnapshot(): MixerSession | null {
    return this.cloneSession(this.session);
  }

  getOutputRoutingStatus(): OutputRoutingStatus {
    return { ...this.outputRoutingStatus };
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    this.selectedOutputDeviceId = deviceId;
    await this.applyOutputSinkSelection();
  }

  resetHealthCounters(): void {
    this.health.dropoutCount = 0;
  }

  getHealthSnapshot(): AudioHealthSnapshot {
    return { ...this.health };
  }

  async dispose(): Promise<void> {
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }

    this.initialized = false;
    this.session = { channels: [] };
    this.channelNodes.clear();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.monitorElement) {
      this.monitorElement.srcObject = null;
      this.monitorElement = null;
    }

    this.monitorDestination = null;

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

    const { outputDeviceId } = getSelectedAudioDeviceIds();
    this.selectedOutputDeviceId = outputDeviceId;

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

    this.monitorDestination = context.createMediaStreamDestination();
    outputNodes.pan.connect(this.monitorDestination);
    this.ensureMonitorElement();

    this.startMeterPolling();
  }

  private ensureMonitorElement(): void {
    if (typeof document === 'undefined' || this.monitorElement) {
      return;
    }

    const element = document.createElement(
      'audio',
    ) as SinkSelectableAudioElement;
    element.autoplay = true;
    element.muted = true;
    element.setAttribute('playsinline', 'true');
    this.monitorElement = element;
  }

  private async applyOutputSinkSelection(): Promise<void> {
    if (!this.monitorElement || !this.monitorDestination) {
      this.outputRoutingStatus = {
        state: 'default',
        message: 'Using system default output device.',
      };
      return;
    }

    this.monitorElement.srcObject = this.monitorDestination.stream;

    const setSinkId = this.monitorElement.setSinkId;
    if (!setSinkId) {
      this.outputRoutingStatus = {
        state: 'unsupported',
        message: 'Output device selection is not supported in this browser.',
      };
      return;
    }

    if (!this.selectedOutputDeviceId) {
      this.outputRoutingStatus = {
        state: 'default',
        message: 'Using system default output device.',
      };
      return;
    }

    try {
      await setSinkId.call(this.monitorElement, this.selectedOutputDeviceId);
      await this.monitorElement.play();
      this.outputRoutingStatus = {
        state: 'applied',
        message: 'Output device applied successfully.',
        deviceId: this.selectedOutputDeviceId,
      };
    } catch {
      // Browser/device policy may reject sink switches; keep default output.
      this.outputRoutingStatus = {
        state: 'failed',
        message:
          'Could not apply selected output device. Falling back to default output.',
        deviceId: this.selectedOutputDeviceId,
      };
    }
  }

  private createChannelNodes(channel: MixerChannel): ChannelNodes {
    const context = this.audioContext;
    if (!context) {
      throw new Error('Audio context not initialized.');
    }

    const gain = context.createGain();
    const pan = context.createStereoPanner();
    const meter = context.createAnalyser();
    meter.fftSize = 1024;
    meter.smoothingTimeConstant = 0.8;

    gain.gain.value = this.computeEffectiveLinearGain(channel);
    pan.pan.value = channel.pan;
    pan.connect(meter);

    const nodes = {
      gain,
      pan,
      meter,
      meterBuffer: new Float32Array(
        new ArrayBuffer(meter.fftSize * Float32Array.BYTES_PER_ELEMENT),
      ),
    };
    this.channelNodes.set(channel.id, nodes);
    return nodes;
  }

  private startMeterPolling(): void {
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
    }

    this.meterTimer = setInterval(() => {
      if (this.channelNodes.size === 0 || this.session.channels.length === 0) {
        return;
      }

      const meterByChannelId = new Map<
        string,
        { peakDb: number; rmsDb: number; clipping: boolean }
      >();

      for (const [channelId, nodes] of this.channelNodes.entries()) {
        nodes.meter.getFloatTimeDomainData(nodes.meterBuffer);

        let peak = 0;
        let sumSquares = 0;
        for (let i = 0; i < nodes.meterBuffer.length; i += 1) {
          const sample = nodes.meterBuffer[i];
          const abs = Math.abs(sample);
          if (abs > peak) {
            peak = abs;
          }
          sumSquares += sample * sample;
        }

        const rms = Math.sqrt(sumSquares / nodes.meterBuffer.length);
        meterByChannelId.set(channelId, {
          peakDb: this.linearToDb(peak),
          rmsDb: this.linearToDb(rms),
          clipping: peak >= 0.995,
        });
      }

      this.session = {
        ...this.session,
        channels: this.session.channels.map((channel) => ({
          ...channel,
          meter: meterByChannelId.get(channel.id),
        })),
      };
    }, 120);
  }

  private linearToDb(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return -100;
    }

    return 20 * Math.log10(Math.max(value, 0.00001));
  }

  private cloneSession(session: MixerSession): MixerSession {
    return {
      sampleRate: session.sampleRate,
      channels: session.channels.map((channel) => ({
        ...channel,
        meter: channel.meter ? { ...channel.meter } : undefined,
      })),
    };
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

  getSessionSnapshot(): MixerSession | null {
    return {
      sampleRate: this.session.sampleRate,
      channels: this.session.channels.map((channel) => ({
        ...channel,
        meter: channel.meter ? { ...channel.meter } : undefined,
      })),
    };
  }

  getOutputRoutingStatus(): OutputRoutingStatus {
    return {
      state: 'unsupported',
      message: 'Output routing is unavailable in the no-op engine.',
    };
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    void deviceId;
    return;
  }

  resetHealthCounters(): void {
    this.health.dropoutCount = 0;
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
