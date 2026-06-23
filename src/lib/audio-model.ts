export type AudioChannelId = string;

export type AudioChannelType = 'input' | 'internal' | 'output';

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

export function normalizeMixerChannel(channel: MixerChannel): MixerChannel {
  return {
    ...channel,
    label: channel.label.trim() || 'Channel',
    gainDb: clampGainDb(channel.gainDb),
    pan: clampPan(channel.pan),
    muted: Boolean(channel.muted),
    solo: Boolean(channel.solo),
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
