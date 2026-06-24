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
  private activeGainDrag:
    | {
        channelId: AudioChannelId;
        pointerId: number;
        trackElement: HTMLElement;
      }
    | null = null;
  private activePanDrag:
    | {
        channelId: AudioChannelId;
        pointerId: number;
        trackElement: HTMLElement;
      }
    | null = null;
  readonly figmaAssets = {
    mixerLevel: '/assets/figma/mixer-level.svg',
    gainIndicator: '/assets/figma/mixer-gain-indicator.svg',
    panIndicator: '/assets/figma/mixer-pan-indicator.svg',
    panControl: '/assets/figma/mixer-pan-control.svg',
    muteButton: '/assets/figma/mixer-mute.svg',
    soloButton: '/assets/figma/mixer-solo.svg',
  };

  onGainChange(channelId: AudioChannelId, gainDb: number): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'gainDb',
      value: Math.max(-60, Math.min(12, gainDb)),
    });
  }

  onPanChange(channelId: AudioChannelId, pan: number): void {
    this.parameterChange.emit({
      channelId,
      parameter: 'pan',
      value: Math.max(-1, Math.min(1, pan)),
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

  toggleMuted(channelId: AudioChannelId, muted: boolean): void {
    this.onMutedChange(channelId, !muted);
  }

  toggleSolo(channelId: AudioChannelId, solo: boolean): void {
    this.onSoloChange(channelId, !solo);
  }

  /** Maps peakDb (-60 to 0) to a 0–100 fill percentage for the level meter. */
  meterFillPct(peakDb: number | undefined): number {
    const db = peakDb ?? -100;
    if (db <= -60) return 0;
    if (db >= 0) return 100;
    return ((db + 60) / 60) * 100;
  }

  /**
   * Maps pan (-1..1) to the pan knob left position, constrained to the
   * full pan indicator width so the knob center aligns with indicator bounds.
   */
  panControlLeftPct(pan: number): number {
    const clampedPan = Math.max(-1, Math.min(1, pan));

    const indicatorLeftPct = 4.5;
    const indicatorWidthPct = 95.1;
    const controlWidthPct = 24.5;

    // Use full indicator width for center travel: left edge -> right edge.
    const centerProgress = (clampedPan + 1) / 2;
    const centerPct = indicatorLeftPct + centerProgress * indicatorWidthPct;

    return centerPct - controlWidthPct / 2;
  }

  onPanDragStart(event: PointerEvent, channelId: AudioChannelId): void {
    const trackElement = event.currentTarget as HTMLElement | null;
    if (!trackElement) {
      return;
    }

    trackElement.setPointerCapture(event.pointerId);
    this.activePanDrag = {
      channelId,
      pointerId: event.pointerId,
      trackElement,
    };

    this.updatePanFromPointer(event);
    event.preventDefault();
  }

  onPanDragMove(event: PointerEvent): void {
    if (!this.activePanDrag || event.pointerId !== this.activePanDrag.pointerId) {
      return;
    }

    this.updatePanFromPointer(event);
  }

  onPanDragEnd(event: PointerEvent): void {
    if (!this.activePanDrag || event.pointerId !== this.activePanDrag.pointerId) {
      return;
    }

    if (this.activePanDrag.trackElement.hasPointerCapture(event.pointerId)) {
      this.activePanDrag.trackElement.releasePointerCapture(event.pointerId);
    }

    this.activePanDrag = null;
  }

  onGainDragStart(event: PointerEvent, channelId: AudioChannelId): void {
    const trackElement = event.currentTarget as HTMLElement | null;
    if (!trackElement) {
      return;
    }

    trackElement.setPointerCapture(event.pointerId);
    this.activeGainDrag = {
      channelId,
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

  private updatePanFromPointer(event: PointerEvent): void {
    if (!this.activePanDrag) {
      return;
    }

    const rect = this.activePanDrag.trackElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const pan = progress * 2 - 1;
    this.onPanChange(this.activePanDrag.channelId, pan);
  }

  /** Maps gain (-60..12) to the knob's top offset inside the gain drag track. */
  gainControlTopPx(gainDb: number): number {
    const clampedGain = Math.max(-60, Math.min(12, gainDb));
    const progress = (12 - clampedGain) / 72;

    const trackHeight = 565;
    const knobHeight = 34.5;
    const travel = trackHeight - knobHeight;

    return progress * travel;
  }

  private updateGainFromPointer(event: PointerEvent): void {
    if (!this.activeGainDrag) {
      return;
    }

    const rect = this.activeGainDrag.trackElement.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }

    const progress = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const gainDb = 12 - progress * 72;
    this.onGainChange(this.activeGainDrag.channelId, gainDb);
  }
}
