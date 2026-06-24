import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AudioChannelId,
  AudioParameterChange,
  MixerChannel,
} from '@org/audio-model';

@Component({
  selector: 'audio-audio-ui',
  imports: [CommonModule],
  templateUrl: './audio-ui.html',
  styleUrl: './audio-ui.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioUi {
  readonly channels = input.required<MixerChannel[]>();
  readonly parameterChange = output<AudioParameterChange>();

  onGainChange(channelId: AudioChannelId, gainDb: number): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'gainDb',
      value: gainDb,
    });
  }

  onPanChange(channelId: AudioChannelId, pan: number): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'pan',
      value: pan,
    });
  }

  onMutedChange(channelId: AudioChannelId, muted: boolean): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'muted',
      value: muted,
    });
  }

  onSoloChange(channelId: AudioChannelId, solo: boolean): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'solo',
      value: solo,
    });
  }
}
