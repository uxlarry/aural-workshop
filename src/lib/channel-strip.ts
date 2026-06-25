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
  MixerEffectType,
} from '@org/audio-model';
import { MatIconModule } from '@angular/material/icon';

export interface EffectSelection {
  channelId: AudioChannelId;
  effectId: string;
}

@Component({
  selector: 'audio-channel-strip',
  imports: [CommonModule, MatIconModule],
  templateUrl: './channel-strip.html',
  styleUrl: './channel-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelStrip {
  private readonly gainTrackHeightPx = 565;
  private readonly gainTrackTopInsetPx = 20;
  private readonly gainTrackBottomInsetPx = 14;
  private readonly gainKnobHeightPx = 34.5;
  readonly channel = input.required<MixerChannel>();
  readonly parameterChange = output<AudioParameterChange>();
  readonly effectSelected = output<EffectSelection>();

  clipPathId(prefix: 'solo-clip' | 'mute-clip'): string {
    return `${prefix}-${this.channel().id}`;
  }

  private activeGainDrag: {
    pointerId: number;
    trackElement: HTMLElement;
  } | null = null;
  private activePanDrag: {
    pointerId: number;
    trackElement: HTMLElement;
  } | null = null;

  onGainChange(gainDb: number): void {
    this.parameterChange.emit({
      channelId: this.channel().id,
      parameter: 'gainDb',
      value: Math.max(-60, Math.min(12, gainDb)),
    });
  }

  onPanChange(pan: number): void {
    this.parameterChange.emit({
      channelId: this.channel().id,
      parameter: 'pan',
      value: Math.max(-1, Math.min(1, pan)),
    });
  }

  onMutedChange(muted: boolean): void {
    this.parameterChange.emit({
      channelId: this.channel().id,
      parameter: 'muted',
      value: muted,
    });
  }

  onSoloChange(solo: boolean): void {
    this.parameterChange.emit({
      channelId: this.channel().id,
      parameter: 'solo',
      value: solo,
    });
  }

  toggleMuted(): void {
    this.onMutedChange(!this.channel().muted);
  }

  toggleSolo(): void {
    this.onSoloChange(!this.channel().solo);
  }

  selectEffect(effectId: string): void {
    this.effectSelected.emit({ channelId: this.channel().id, effectId });
  }

  effectIcon(effectType: MixerEffectType): string {
    if (effectType === 'highpass') {
      return 'filter_alt';
    }

    if (effectType === 'lowpass') {
      return 'filter_list';
    }

    if (effectType === 'compressor') {
      return 'compress';
    }

    return 'graphic_eq';
  }

  meterFillPct(peakDb: number | undefined): number {
    const db = peakDb ?? -100;
    if (db <= -60) return 0;
    if (db >= 0) return 100;
    return ((db + 60) / 60) * 100;
  }

  panControlLeftPct(pan: number): number {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    const indicatorLeftPct = 4.5;
    const indicatorWidthPct = 95.1;
    const controlWidthPct = 24.5;
    const centerProgress = (clampedPan + 1) / 2;
    const centerPct = indicatorLeftPct + centerProgress * indicatorWidthPct;

    return centerPct - controlWidthPct / 2;
  }

  onPanDragStart(event: PointerEvent): void {
    const trackElement = event.currentTarget as HTMLElement | null;
    if (!trackElement) {
      return;
    }

    trackElement.setPointerCapture(event.pointerId);
    this.activePanDrag = {
      pointerId: event.pointerId,
      trackElement,
    };

    this.updatePanFromPointer(event);
    event.preventDefault();
  }

  onPanDragMove(event: PointerEvent): void {
    if (
      !this.activePanDrag ||
      event.pointerId !== this.activePanDrag.pointerId
    ) {
      return;
    }

    this.updatePanFromPointer(event);
  }

  onPanDragEnd(event: PointerEvent): void {
    if (
      !this.activePanDrag ||
      event.pointerId !== this.activePanDrag.pointerId
    ) {
      return;
    }

    if (this.activePanDrag.trackElement.hasPointerCapture(event.pointerId)) {
      this.activePanDrag.trackElement.releasePointerCapture(event.pointerId);
    }

    this.activePanDrag = null;
  }

  onGainDragStart(event: PointerEvent): void {
    const trackElement = event.currentTarget as HTMLElement | null;
    if (!trackElement) {
      return;
    }

    trackElement.setPointerCapture(event.pointerId);
    this.activeGainDrag = {
      pointerId: event.pointerId,
      trackElement,
    };

    this.updateGainFromPointer(event);
    event.preventDefault();
  }

  onGainDragMove(event: PointerEvent): void {
    if (
      !this.activeGainDrag ||
      event.pointerId !== this.activeGainDrag.pointerId
    ) {
      return;
    }

    this.updateGainFromPointer(event);
  }

  onGainDragEnd(event: PointerEvent): void {
    if (
      !this.activeGainDrag ||
      event.pointerId !== this.activeGainDrag.pointerId
    ) {
      return;
    }

    if (this.activeGainDrag.trackElement.hasPointerCapture(event.pointerId)) {
      this.activeGainDrag.trackElement.releasePointerCapture(event.pointerId);
    }

    this.activeGainDrag = null;
  }

  gainControlTopPx(gainDb: number): number {
    const clampedGain = Math.max(-60, Math.min(12, gainDb));
    const progress = (12 - clampedGain) / 72;

    const trackHeight = this.gainTrackHeightPx;
    const travel =
      trackHeight -
      this.gainKnobHeightPx -
      this.gainTrackTopInsetPx -
      this.gainTrackBottomInsetPx;

    return this.gainTrackTopInsetPx + progress * travel;
  }

  private updatePanFromPointer(event: PointerEvent): void {
    if (!this.activePanDrag) {
      return;
    }

    const rect = this.activePanDrag.trackElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    const pan = progress * 2 - 1;
    this.onPanChange(pan);
  }

  private updateGainFromPointer(event: PointerEvent): void {
    if (!this.activeGainDrag) {
      return;
    }

    const rect = this.activeGainDrag.trackElement.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }

    const draggableHeight =
      rect.height - this.gainTrackTopInsetPx - this.gainTrackBottomInsetPx;
    if (draggableHeight <= 0) {
      return;
    }

    const progress = Math.max(
      0,
      Math.min(
        1,
        (event.clientY - rect.top - this.gainTrackTopInsetPx) / draggableHeight,
      ),
    );
    const gainDb = 12 - progress * 72;
    this.onGainChange(gainDb);
  }
}
