export type AudioChannelId = string;

export type AudioChannelType = 'input' | 'internal' | 'output';

export type MixerEffectType =
  | 'highpass'
  | 'lowpass'
  | 'distortion'
  | 'compressor';

export type MixerEffectParameterName =
  | 'frequencyHz'
  | 'q'
  | 'amount'
  | 'thresholdDb'
  | 'ratio';

export interface MixerEffect {
  id: string;
  type: MixerEffectType;
  label: string;
  bypassed: boolean;
  mix: number;
  parameters: Partial<Record<MixerEffectParameterName, number>>;
}

export interface AudioLevelState {
  peakDb: number;
  rmsDb?: number;
  clipping: boolean;
}

export interface MixerChannel {
  id: AudioChannelId;
  type: AudioChannelType;
  label: string;
  gainDb: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effectsEnabled?: boolean;
  effects?: MixerEffect[];
  meter?: AudioLevelState;
}

export interface MixerSession {
  sampleRate?: number;
  channels: MixerChannel[];
}

export type AudioParameterName = 'gainDb' | 'pan' | 'muted' | 'solo';

export interface AudioParameterChange {
  channelId: AudioChannelId;
  parameter: AudioParameterName;
  value: number | boolean;
}

export interface AudioDeviceInfo {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface DeviceCapabilities {
  outputSelectionSupported: boolean;
}

export interface AudioHealthSnapshot {
  dropoutCount: number;
  estimatedLatencyMs?: number;
}

export const AUDIO_LIMITS = {
  minGainDb: -60,
  maxGainDb: 12,
  minPan: -1,
  maxPan: 1,
} as const;

export const EFFECT_PARAMETER_LIMITS = {
  frequencyHz: {
    min: 40,
    max: 18_000,
    defaultValue: 650,
  },
  q: {
    min: 0.1,
    max: 20,
    defaultValue: 0.707,
  },
  amount: {
    min: 0,
    max: 1,
    defaultValue: 0.3,
  },
  thresholdDb: {
    min: -90,
    max: 0,
    defaultValue: -24,
  },
  ratio: {
    min: 1,
    max: 20,
    defaultValue: 4,
  },
} as const;

export const EFFECT_MIX_LIMITS = {
  min: 0,
  max: 1,
  defaultValue: 1,
} as const;

export interface SessionValidationIssue {
  code: 'duplicate-channel-id' | 'invalid-channel' | 'empty-session';
  message: string;
  channelId?: AudioChannelId;
}

export function clampGainDb(gainDb: number): number {
  if (!Number.isFinite(gainDb)) {
    return 0;
  }

  return Math.min(
    AUDIO_LIMITS.maxGainDb,
    Math.max(AUDIO_LIMITS.minGainDb, gainDb),
  );
}

export function clampPan(pan: number): number {
  if (!Number.isFinite(pan)) {
    return 0;
  }

  return Math.min(AUDIO_LIMITS.maxPan, Math.max(AUDIO_LIMITS.minPan, pan));
}

export function clampEffectMix(mix: number | undefined): number {
  if (typeof mix !== 'number' || !Number.isFinite(mix)) {
    return EFFECT_MIX_LIMITS.defaultValue;
  }

  return Math.min(EFFECT_MIX_LIMITS.max, Math.max(EFFECT_MIX_LIMITS.min, mix));
}

function clampEffectParameter(
  parameter: MixerEffectParameterName,
  value: number | undefined,
): number {
  const limits = EFFECT_PARAMETER_LIMITS[parameter];
  const candidate =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : limits.defaultValue;

  return Math.min(limits.max, Math.max(limits.min, candidate));
}

const DEFAULT_EFFECT_PARAMETERS: Record<
  MixerEffectType,
  Partial<Record<MixerEffectParameterName, number>>
> = {
  highpass: {
    frequencyHz: 120,
    q: 0.707,
  },
  lowpass: {
    frequencyHz: 6_500,
    q: 0.707,
  },
  distortion: {
    amount: 0.35,
  },
  compressor: {
    thresholdDb: -24,
    ratio: 4,
  },
};

export function createDefaultMixerEffect(
  type: MixerEffectType,
  id = `${type}-${Math.random().toString(36).slice(2, 8)}`,
): MixerEffect {
  const label =
    type === 'highpass'
      ? 'High-Pass'
      : type === 'lowpass'
        ? 'Low-Pass'
        : type === 'distortion'
          ? 'Distortion'
          : 'Compressor';

  return {
    id,
    type,
    label,
    bypassed: false,
    mix: 1,
    parameters: { ...DEFAULT_EFFECT_PARAMETERS[type] },
  };
}

export function normalizeMixerEffect(effect: MixerEffect): MixerEffect {
  const defaults = DEFAULT_EFFECT_PARAMETERS[effect.type];
  const mergedParameters = {
    ...defaults,
    ...effect.parameters,
  };

  return {
    ...effect,
    id: effect.id.trim() || createDefaultMixerEffect(effect.type).id,
    label: effect.label.trim() || createDefaultMixerEffect(effect.type).label,
    bypassed: Boolean(effect.bypassed),
    mix: clampEffectMix(effect.mix),
    parameters: {
      frequencyHz: mergedParameters.frequencyHz
        ? clampEffectParameter('frequencyHz', mergedParameters.frequencyHz)
        : undefined,
      q:
        typeof mergedParameters.q === 'number'
          ? clampEffectParameter('q', mergedParameters.q)
          : undefined,
      amount:
        typeof mergedParameters.amount === 'number'
          ? clampEffectParameter('amount', mergedParameters.amount)
          : undefined,
      thresholdDb:
        typeof mergedParameters.thresholdDb === 'number'
          ? clampEffectParameter('thresholdDb', mergedParameters.thresholdDb)
          : undefined,
      ratio:
        typeof mergedParameters.ratio === 'number'
          ? clampEffectParameter('ratio', mergedParameters.ratio)
          : undefined,
    },
  };
}

export function normalizeMixerChannel(channel: MixerChannel): MixerChannel {
  return {
    ...channel,
    label: channel.label.trim() || 'Channel',
    gainDb: clampGainDb(channel.gainDb),
    pan: clampPan(channel.pan),
    muted: Boolean(channel.muted),
    solo: Boolean(channel.solo),
    effectsEnabled: channel.effectsEnabled !== false,
    effects: Array.isArray(channel.effects)
      ? channel.effects.map((effect) => normalizeMixerEffect(effect))
      : [],
  };
}

export function normalizeMixerSession(session: MixerSession): MixerSession {
  return {
    sampleRate: session.sampleRate,
    channels: session.channels.map((channel) => normalizeMixerChannel(channel)),
  };
}

export function getSessionValidationIssues(
  session: MixerSession,
): SessionValidationIssue[] {
  const issues: SessionValidationIssue[] = [];

  if (session.channels.length === 0) {
    issues.push({
      code: 'empty-session',
      message: 'Mixer session must include at least one channel.',
    });
  }

  const seenIds = new Set<AudioChannelId>();
  for (const channel of session.channels) {
    if (!channel.id.trim()) {
      issues.push({
        code: 'invalid-channel',
        message: 'Channel id must be non-empty.',
      });
    }

    if (seenIds.has(channel.id)) {
      issues.push({
        code: 'duplicate-channel-id',
        message: `Channel id "${channel.id}" is duplicated.`,
        channelId: channel.id,
      });
    }
    seenIds.add(channel.id);
  }

  return issues;
}

export function assertValidMixerSession(session: MixerSession): void {
  const issues = getSessionValidationIssues(session);
  if (issues.length === 0) {
    return;
  }

  const summary = issues.map((issue) => issue.message).join(' ');
  throw new Error(`Invalid mixer session. ${summary}`);
}
