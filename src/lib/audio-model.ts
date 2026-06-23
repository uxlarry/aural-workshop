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
