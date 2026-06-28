import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioParameterChange, MixerChannel } from '@org/audio-model';
import {
  AddEffectRequest,
  ChannelStrip,
  EffectReorderRequest,
  EffectSelection,
} from '../channel-strip';
export type {
  AddEffectRequest,
  EffectReorderRequest,
  EffectSelection,
} from '../channel-strip';

@Component({
  selector: 'audio-audio-ui',
  imports: [CommonModule, ChannelStrip],
  templateUrl: './audio-ui.html',
  styleUrl: './audio-ui.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioUi {
  readonly channels = input.required<MixerChannel[]>();
  readonly parameterChange = output<AudioParameterChange>();
  readonly effectSelected = output<EffectSelection>();
  readonly addEffectRequested = output<AddEffectRequest>();
  readonly effectReordered = output<EffectReorderRequest>();
}
