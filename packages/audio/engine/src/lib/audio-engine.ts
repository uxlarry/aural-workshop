import {
  AudioHealthSnapshot,
  MixerEffect,
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
  resetOutputRouting(): Promise<void>;
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
  splitter: ChannelSplitterNode;
  meterLeft: AnalyserNode;
  meterRight: AnalyserNode;
  meterBufferLeft: Float32Array<ArrayBuffer>;
  meterBufferRight: Float32Array<ArrayBuffer>;
  merger: ChannelMergerNode;
}

interface EffectNodeChain {
  input: AudioNode;
  output: AudioNode;
}

export function resolveActiveEffects(effects: MixerEffect[]): MixerEffect[] {
  return effects.filter((effect) => !effect.bypassed);
}

export function resolveChainEffects(
  effects: MixerEffect[],
  effectsEnabled: boolean,
): MixerEffect[] {
  if (!effectsEnabled) {
    return [];
  }

  return resolveActiveEffects(effects);
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
    deviceLatencyMs: undefined,
    effectLatencyMs: undefined,
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

    this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    this.audioContext.onstatechange = () => {
      if (
        this.audioContext?.state === 'interrupted' ||
        this.audioContext?.state === 'suspended'
      ) {
        void this.audioContext.resume().catch(() => {
          this.health.dropoutCount += 1;
        });
      }
    };
    await this.audioContext.resume();
    this.updateEstimatedLatency();
  }

  async applySession(session: MixerSession): Promise<void> {
    assertValidMixerSession(session);
    this.session = normalizeMixerSession(session);
    this.updateEstimatedLatency();

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

  async resetOutputRouting(): Promise<void> {
    this.selectedOutputDeviceId = null;
    if (this.monitorElement) {
      this.monitorElement.srcObject = null;
    }
    this.outputRoutingStatus = {
      state: 'default',
      message: 'Using system default output device.',
    };
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

    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        this.health.dropoutCount += 1;
        if (
          this.initialized &&
          this.audioContext &&
          this.session.channels.length > 0
        ) {
          void this.rebuildGraph().catch(() => {
            this.health.dropoutCount += 1;
          });
        }
      });
    }

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
    const internalEffects = this.buildEffectChain(
      internalChannel.effects ?? [],
      internalChannel.effectsEnabled !== false,
      internalNodes.gain,
    );

    this.sourceNode.connect(inputNodes.gain);
    inputNodes.gain.connect(inputNodes.pan);
    inputNodes.merger.connect(internalNodes.gain);
    internalEffects.output.connect(internalNodes.pan);
    internalNodes.merger.connect(outputNodes.gain);
    outputNodes.gain.connect(outputNodes.pan);
    outputNodes.merger.connect(context.destination);

    this.monitorDestination = context.createMediaStreamDestination();
    outputNodes.merger.connect(this.monitorDestination);
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
    const splitter = context.createChannelSplitter(2);
    const meterLeft = context.createAnalyser();
    const meterRight = context.createAnalyser();
    const merger = context.createChannelMerger(2);

    meterLeft.fftSize = 1024;
    meterLeft.smoothingTimeConstant = 0.8;
    meterRight.fftSize = 1024;
    meterRight.smoothingTimeConstant = 0.8;

    gain.gain.value = this.computeEffectiveLinearGain(channel);
    pan.pan.value = channel.pan;

    // Audio routing: pan -> splitter -> analyzers -> merger
    pan.connect(splitter);
    splitter.connect(meterLeft, 0);
    splitter.connect(meterRight, 1);
    meterLeft.connect(merger, 0, 0);
    meterRight.connect(merger, 0, 1);

    const nodes = {
      gain,
      pan,
      splitter,
      meterLeft,
      meterRight,
      meterBufferLeft: new Float32Array(
        new ArrayBuffer(meterLeft.fftSize * Float32Array.BYTES_PER_ELEMENT),
      ),
      meterBufferRight: new Float32Array(
        new ArrayBuffer(meterRight.fftSize * Float32Array.BYTES_PER_ELEMENT),
      ),
      merger,
    };
    this.channelNodes.set(channel.id, nodes);
    return nodes;
  }

  private buildEffectChain(
    effects: MixerEffect[],
    effectsEnabled: boolean,
    sourceNode: AudioNode,
  ): EffectNodeChain {
    const context = this.audioContext;
    if (!context || effects.length === 0) {
      return {
        input: sourceNode,
        output: sourceNode,
      };
    }

    let tail = sourceNode;
    for (const effect of resolveChainEffects(effects, effectsEnabled)) {
      const effectNode = this.createEffectNode(effect, context);
      if (!effectNode) {
        continue;
      }

      tail.connect(effectNode.input);
      tail = effectNode.output;
    }

    return {
      input: sourceNode,
      output: tail,
    };
  }

  private createEffectNode(
    effect: MixerEffect,
    context: AudioContext,
  ): EffectNodeChain | null {
    const effectMix = Math.max(0, Math.min(1, effect.mix));
    const input = context.createGain();
    const dryGain = context.createGain();
    const wetGain = context.createGain();
    dryGain.gain.value = 1 - effectMix;
    wetGain.gain.value = effectMix;
    const output = context.createGain();

    input.connect(dryGain);
    input.connect(wetGain);

    const wireDryWet = (effectInput: AudioNode, effectOutput: AudioNode) => {
      dryGain.connect(output);
      wetGain.connect(effectInput);
      effectOutput.connect(output);

      return {
        input,
        output,
      };
    };

    if (effect.type === 'highpass' || effect.type === 'lowpass') {
      const filter = context.createBiquadFilter();
      filter.type = effect.type;
      const frequencyHz = effect.parameters.frequencyHz ?? 650;
      const q = effect.parameters.q ?? 0.707;
      filter.frequency.value = Math.max(40, Math.min(18_000, frequencyHz));
      filter.Q.value = Math.max(0.1, Math.min(20, q));
      return wireDryWet(filter, filter);
    }

    if (effect.type === 'distortion') {
      const amount = Math.max(0, Math.min(1, effect.parameters.amount ?? 0.35));
      const shaper = context.createWaveShaper();
      shaper.curve = this.createDistortionCurve(amount);
      shaper.oversample = '2x';
      return wireDryWet(shaper, shaper);
    }

    if (effect.type === 'compressor') {
      const compressor = context.createDynamicsCompressor();
      const thresholdDb = effect.parameters.thresholdDb ?? -24;
      const ratio = effect.parameters.ratio ?? 4;
      compressor.threshold.value = Math.max(-90, Math.min(0, thresholdDb));
      compressor.ratio.value = Math.max(1, Math.min(20, ratio));
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;

      return wireDryWet(compressor, compressor);
    }

    return null;
  }

  private createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 1024;
    const curve = new Float32Array(
      new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT),
    );
    const intensity = 5 + amount * 120;

    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] =
        ((Math.PI + intensity) * x) / (Math.PI + intensity * Math.abs(x));
    }

    return curve;
  }

  private updateEstimatedLatency(): void {
    const { deviceLatencyMs, effectLatencyMs, estimatedLatencyMs } =
      this.computeLatencySnapshot();

    this.health.deviceLatencyMs = deviceLatencyMs;
    this.health.effectLatencyMs = effectLatencyMs;
    this.health.estimatedLatencyMs = estimatedLatencyMs;
  }

  private computeLatencySnapshot(): {
    deviceLatencyMs: number | undefined;
    effectLatencyMs: number | undefined;
    estimatedLatencyMs: number | undefined;
  } {
    const context = this.audioContext;

    const contextLatencyMs = context
      ? (typeof context.baseLatency === 'number' ? context.baseLatency : 0) +
        (typeof context.outputLatency === 'number' ? context.outputLatency : 0)
      : 0;

    const effectLatencyMs = this.estimateEffectChainLatencyMs();
    const totalLatencyMs = contextLatencyMs * 1_000 + effectLatencyMs;

    const deviceLatencyValue = contextLatencyMs * 1_000;
    const normalizedDeviceLatencyMs =
      Number.isFinite(deviceLatencyValue) && deviceLatencyValue > 0
        ? deviceLatencyValue
        : undefined;
    const normalizedEffectLatencyMs =
      Number.isFinite(effectLatencyMs) && effectLatencyMs > 0
        ? effectLatencyMs
        : 0;

    if (!Number.isFinite(totalLatencyMs) || totalLatencyMs <= 0) {
      return {
        deviceLatencyMs: normalizedDeviceLatencyMs,
        effectLatencyMs: normalizedEffectLatencyMs,
        estimatedLatencyMs: undefined,
      };
    }

    return {
      deviceLatencyMs: normalizedDeviceLatencyMs,
      effectLatencyMs: normalizedEffectLatencyMs,
      estimatedLatencyMs: totalLatencyMs,
    };
  }

  private estimateEffectChainLatencyMs(): number {
    const internalChannel = this.findChannelByType('internal');
    if (!internalChannel) {
      return 0;
    }

    const chainEffects = resolveChainEffects(
      internalChannel.effects ?? [],
      internalChannel.effectsEnabled !== false,
    );

    let estimatedMs = 0;
    for (const effect of chainEffects) {
      if (effect.type === 'compressor') {
        estimatedMs += 1.2;
      } else if (effect.type === 'distortion') {
        estimatedMs += 0.8;
      } else {
        estimatedMs += 0.2;
      }
    }

    return estimatedMs;
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
        {
          peakDb: number;
          rmsDb: number;
          clipping: boolean;
          leftDb: number;
          rightDb: number;
        }
      >();

      for (const [channelId, nodes] of this.channelNodes.entries()) {
        // Analyze left channel
        nodes.meterLeft.getFloatTimeDomainData(nodes.meterBufferLeft);
        let peakLeft = 0;
        let sumSquaresLeft = 0;
        for (let i = 0; i < nodes.meterBufferLeft.length; i += 1) {
          const sample = nodes.meterBufferLeft[i];
          const abs = Math.abs(sample);
          if (abs > peakLeft) {
            peakLeft = abs;
          }
          sumSquaresLeft += sample * sample;
        }
        const rmsLeft =
          nodes.meterBufferLeft.length > 0
            ? Math.sqrt(sumSquaresLeft / nodes.meterBufferLeft.length)
            : 0;

        // Analyze right channel
        nodes.meterRight.getFloatTimeDomainData(nodes.meterBufferRight);
        let peakRight = 0;
        let sumSquaresRight = 0;
        for (let i = 0; i < nodes.meterBufferRight.length; i += 1) {
          const sample = nodes.meterBufferRight[i];
          const abs = Math.abs(sample);
          if (abs > peakRight) {
            peakRight = abs;
          }
          sumSquaresRight += sample * sample;
        }
        const rmsRight =
          nodes.meterBufferRight.length > 0
            ? Math.sqrt(sumSquaresRight / nodes.meterBufferRight.length)
            : 0;

        // Peak is the maximum of both channels for clipping detection
        const peak = Math.max(peakLeft, peakRight);

        meterByChannelId.set(channelId, {
          peakDb: this.linearToDb(peak),
          rmsDb: this.linearToDb(Math.max(rmsLeft, rmsRight)),
          clipping: peak >= 0.995,
          leftDb: this.linearToDb(peakLeft),
          rightDb: this.linearToDb(peakRight),
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
    deviceLatencyMs: 0,
    effectLatencyMs: 0,
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

  async resetOutputRouting(): Promise<void> {
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
