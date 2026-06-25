import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AudioChannelId,
  AudioParameterChange,
  MixerChannel,
  MixerEffect,
  MixerEffectType,
} from '@org/audio-model';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface EffectSelection {
  channelId: AudioChannelId;
  effectId: string;
}

export interface AddEffectRequest {
  channelId: AudioChannelId;
}

export interface EffectReorderRequest {
  channelId: AudioChannelId;
  effectIds: string[];
}

@Component({
  selector: 'audio-channel-strip',
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './channel-strip.html',
  styleUrl: './channel-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelStrip implements DoCheck {
  private readonly effectDragThresholdPx = 4;
  private readonly gainTrackHeightPx = 565;
  private readonly gainTrackTopInsetPx = 20;
  private readonly gainTrackBottomInsetPx = 14;
  private readonly gainKnobHeightPx = 34.5;
  private readonly effectButtonSizePx = 39;
  private readonly effectColumnGapPx = 8;
  private readonly effectRowGapPx = 2;
  private readonly effectRackColumns = 2;
  readonly channel = input.required<MixerChannel>();
  readonly parameterChange = output<AudioParameterChange>();
  readonly effectSelected = output<EffectSelection>();
  readonly addEffectRequested = output<AddEffectRequest>();
  readonly effectReordered = output<EffectReorderRequest>();
  private dragEffectId: string | null = null;
  private previewEffectIds: string[] | null = null;
  private activeEffectDrag: {
    pointerId: number;
    effectId: string;
    buttonElement: HTMLElement;
    listElement: HTMLElement;
    startClientX: number;
    startClientY: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
    currentLeftPx: number;
    currentTopPx: number;
    moved: boolean;
  } | null = null;
  private effectDragSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextEffectClickId: string | null = null;
  private suppressNextEffectClickTimer: ReturnType<typeof setTimeout> | null =
    null;

  clipPathId(prefix: 'solo-clip' | 'mute-clip'): string {
    return `${prefix}-${this.channel().id}`;
  }

  private activeGainDrag: {
    pointerId: number;
    knobElement: HTMLElement;
  } | null = null;
  private activePanDrag: {
    pointerId: number;
    panControlElement: HTMLElement;
  } | null = null;

  ngDoCheck(): void {
    if (this.activeEffectDrag || !this.previewEffectIds) {
      return;
    }

    const currentOrder = (this.channel().effects ?? []).map(
      (effect) => effect.id,
    );
    if (this.sameEffectOrder(currentOrder, this.previewEffectIds)) {
      this.previewEffectIds = null;
    }
  }

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

  onGainControlDblClick(): void {
    this.onGainChange(0);
  }

  onPanControlDblClick(): void {
    this.onPanChange(0);
  }

  selectEffect(effectId: string): void {
    this.effectSelected.emit({ channelId: this.channel().id, effectId });
  }

  onEffectClick(event: MouseEvent, effectId: string): void {
    if (this.suppressNextEffectClickId === effectId) {
      this.clearSuppressedEffectClick();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.selectEffect(effectId);
  }

  requestAddEffect(): void {
    this.addEffectRequested.emit({ channelId: this.channel().id });
  }

  effectButtons(): MixerEffect[] {
    return this.channel().effects ?? [];
  }

  effectButtonLeftPx(effectId: string): number {
    if (this.activeEffectDrag?.effectId === effectId) {
      return this.activeEffectDrag.currentLeftPx;
    }

    const slotIndex = this.effectSlotIndex(effectId);
    return this.effectSlotLeftPx(slotIndex);
  }

  effectButtonTopPx(effectId: string): number {
    if (this.activeEffectDrag?.effectId === effectId) {
      return this.activeEffectDrag.currentTopPx;
    }

    const slotIndex = this.effectSlotIndex(effectId);
    return this.effectSlotTopPx(slotIndex);
  }

  effectButtonDragging(effectId: string): boolean {
    return this.activeEffectDrag?.effectId === effectId;
  }

  effectPlaceholderVisible(): boolean {
    return Boolean(this.activeEffectDrag && this.previewEffectIds);
  }

  effectPreviewActive(): boolean {
    return Boolean(this.previewEffectIds);
  }

  effectPlaceholderLeftPx(): number {
    const slotIndex = this.effectPlaceholderSlotIndex();
    return this.effectSlotLeftPx(slotIndex);
  }

  effectPlaceholderTopPx(): number {
    const slotIndex = this.effectPlaceholderSlotIndex();
    return this.effectSlotTopPx(slotIndex);
  }

  effectRackListHeightPx(): number {
    const effectCount = this.effectButtons().length;
    const addButtonCentered = effectCount % 2 === 0;
    const effectRows = Math.max(
      1,
      Math.ceil(effectCount / this.effectRackColumns),
    );
    const addButtonRow = addButtonCentered
      ? effectRows + 1
      : Math.ceil((effectCount + 1) / this.effectRackColumns);
    const totalRows = Math.max(effectRows, addButtonRow);

    return (
      totalRows * this.effectButtonSizePx +
      Math.max(0, totalRows - 1) * this.effectRowGapPx
    );
  }

  addButtonLeftPx(): number {
    if (this.effectButtons().length % 2 === 0) {
      return (this.effectGridWidthPx() - this.effectButtonSizePx) / 2;
    }

    return this.effectSlotLeftPx(this.effectButtons().length);
  }

  addButtonTopPx(): number {
    const effectCount = this.effectButtons().length;
    if (effectCount % 2 === 0) {
      return this.effectSlotTopPx(
        Math.ceil(effectCount / this.effectRackColumns) *
          this.effectRackColumns,
      );
    }

    return this.effectSlotTopPx(effectCount);
  }

  onEffectDragStart(event: PointerEvent, effectId: string): void {
    const effectIds = (this.channel().effects ?? []).map((effect) => effect.id);
    if (effectIds.length < 2) {
      return;
    }

    if (this.effectDragSettleTimer) {
      clearTimeout(this.effectDragSettleTimer);
      this.effectDragSettleTimer = null;
    }

    const buttonElement = event.currentTarget as HTMLElement | null;
    const listElement = buttonElement?.closest(
      '.effect-rack__list',
    ) as HTMLElement | null;
    if (!buttonElement || !listElement) {
      return;
    }

    const buttonRect = buttonElement.getBoundingClientRect();
    const listRect = listElement.getBoundingClientRect();
    const initialLeftPx = buttonRect.left - listRect.left;
    const initialTopPx = buttonRect.top - listRect.top;

    this.dragEffectId = effectId;
    this.previewEffectIds = [...effectIds];
    this.activeEffectDrag = {
      pointerId: event.pointerId,
      effectId,
      buttonElement,
      listElement,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerOffsetX: event.clientX - buttonRect.left,
      pointerOffsetY: event.clientY - buttonRect.top,
      currentLeftPx: initialLeftPx,
      currentTopPx: initialTopPx,
      moved: false,
    };

    buttonElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onEffectDragMove(event: PointerEvent): void {
    if (
      !this.activeEffectDrag ||
      event.pointerId !== this.activeEffectDrag.pointerId
    ) {
      return;
    }

    const listRect = this.activeEffectDrag.listElement.getBoundingClientRect();
    const buttonSize = this.effectButtonSizePx;
    const maxLeft = Math.max(0, this.effectGridWidthPx() - buttonSize);
    const maxTop = Math.max(0, this.effectRackListHeightPx() - buttonSize);
    const deltaX = event.clientX - this.activeEffectDrag.startClientX;
    const deltaY = event.clientY - this.activeEffectDrag.startClientY;

    if (
      !this.activeEffectDrag.moved &&
      Math.hypot(deltaX, deltaY) >= this.effectDragThresholdPx
    ) {
      this.activeEffectDrag.moved = true;
    }

    this.activeEffectDrag.currentLeftPx = Math.max(
      0,
      Math.min(
        maxLeft,
        event.clientX - listRect.left - this.activeEffectDrag.pointerOffsetX,
      ),
    );
    this.activeEffectDrag.currentTopPx = Math.max(
      0,
      Math.min(
        maxTop,
        event.clientY - listRect.top - this.activeEffectDrag.pointerOffsetY,
      ),
    );

    const targetSlotIndex = this.effectTargetSlotIndex(
      event.clientX - listRect.left,
      event.clientY - listRect.top,
    );
    const currentOrder =
      this.previewEffectIds ??
      (this.channel().effects ?? []).map((effect) => effect.id);
    const nextOrder = this.reorderedEffectIdsByIndex(
      currentOrder,
      this.activeEffectDrag.effectId,
      targetSlotIndex,
    );

    if (!this.sameEffectOrder(currentOrder, nextOrder)) {
      this.previewEffectIds = nextOrder;
    }
  }

  onEffectDragEnd(event: PointerEvent): void {
    if (
      !this.activeEffectDrag ||
      event.pointerId !== this.activeEffectDrag.pointerId
    ) {
      return;
    }

    const channelId = this.channel().id;
    const currentOrder = (this.channel().effects ?? []).map(
      (effect) => effect.id,
    );
    const previewOrder = this.previewEffectIds;
    const draggedEffectId = this.activeEffectDrag.effectId;
    const finalLeftPx = this.effectSlotLeftPx(
      this.effectSlotIndex(draggedEffectId),
    );
    const finalTopPx = this.effectSlotTopPx(
      this.effectSlotIndex(draggedEffectId),
    );

    this.activeEffectDrag.currentLeftPx = finalLeftPx;
    this.activeEffectDrag.currentTopPx = finalTopPx;

    if (
      this.activeEffectDrag.buttonElement.hasPointerCapture(event.pointerId)
    ) {
      this.activeEffectDrag.buttonElement.releasePointerCapture(
        event.pointerId,
      );
    }

    if (this.activeEffectDrag.moved) {
      this.suppressEffectClick(draggedEffectId);
    }

    this.effectDragSettleTimer = setTimeout(() => {
      this.activeEffectDrag = null;
      this.effectDragSettleTimer = null;
    }, 180);

    if (!previewOrder || this.sameEffectOrder(currentOrder, previewOrder)) {
      this.dragEffectId = null;
      return;
    }

    this.dragEffectId = null;

    this.effectReordered.emit({
      channelId,
      effectIds: previewOrder,
    });
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

  onGainDragStart(event: PointerEvent): void {
    const knobElement = event.currentTarget as HTMLElement | null;
    if (!knobElement) {
      return;
    }

    knobElement.setPointerCapture(event.pointerId);
    this.activeGainDrag = {
      pointerId: event.pointerId,
      knobElement,
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

    if (this.activeGainDrag.knobElement.hasPointerCapture(event.pointerId)) {
      this.activeGainDrag.knobElement.releasePointerCapture(event.pointerId);
    }

    this.activeGainDrag = null;
  }

  onPanDragStart(event: PointerEvent): void {
    const panControlElement = event.currentTarget as HTMLElement | null;
    if (!panControlElement) {
      return;
    }

    panControlElement.setPointerCapture(event.pointerId);
    this.activePanDrag = {
      pointerId: event.pointerId,
      panControlElement,
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

    if (
      this.activePanDrag.panControlElement.hasPointerCapture(event.pointerId)
    ) {
      this.activePanDrag.panControlElement.releasePointerCapture(
        event.pointerId,
      );
    }

    this.activePanDrag = null;
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

  gainGuidelines(): Array<{ db: number; topPx: number }> {
    const guidelines: Array<{ db: number; topPx: number }> = [];
    // Generate guidelines every 10 dB from 12 to -60
    for (let db = 12; db >= -60; db -= 10) {
      guidelines.push({
        db,
        topPx: this.gainControlTopPx(db),
      });
    }
    return guidelines;
  }

  private updateGainFromPointer(event: PointerEvent): void {
    if (!this.activeGainDrag) {
      return;
    }

    const containerRect =
      this.activeGainDrag.knobElement.parentElement?.getBoundingClientRect();
    if (!containerRect || containerRect.height <= 0) {
      return;
    }

    const knobHeight = this.activeGainDrag.knobElement.clientHeight;
    if (knobHeight <= 0) {
      return;
    }

    // Calculate the draggable range: container height minus knob height
    const draggableHeight = containerRect.height - knobHeight;
    if (draggableHeight <= 0) {
      return;
    }

    // Calculate how far the knob has moved from its starting position (center)
    const centerY = containerRect.top + containerRect.height / 2;
    const pointerOffset = event.clientY - centerY;

    // Constrain the movement to the draggable range
    const maxOffset = draggableHeight / 2;
    const constrainedOffset = Math.max(
      -maxOffset,
      Math.min(maxOffset, pointerOffset),
    );

    // Convert the offset to a gain value (-60 to 12 dB, inverted because top = high gain)
    // At center (offset = 0), progress = 0.5, so gainDb = 12 - 0.5 * 72 = -24dB
    const progress = 0.5 + constrainedOffset / draggableHeight;
    const gainDb = 12 - progress * 72;
    this.onGainChange(gainDb);
  }

  panControlLeftPercent(pan: number): number {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    // Knob width is 24.5%, so available movement range is 75.5%
    // Half range is 37.75%, which is how far the knob center can move from 50%
    const halfRange = 37.75;
    return 50 + clampedPan * halfRange;
  }

  private updatePanFromPointer(event: PointerEvent): void {
    if (!this.activePanDrag) {
      return;
    }

    const containerRect =
      this.activePanDrag.panControlElement.parentElement?.getBoundingClientRect();
    if (!containerRect || containerRect.width <= 0) {
      return;
    }

    const knobWidth = this.activePanDrag.panControlElement.clientWidth;
    if (knobWidth <= 0) {
      return;
    }

    // Calculate the draggable range: container width minus knob width
    const draggableWidth = containerRect.width - knobWidth;
    if (draggableWidth <= 0) {
      return;
    }

    // Calculate how far the knob has moved from its starting position (center)
    const centerX = containerRect.left + containerRect.width / 2;
    const pointerOffset = event.clientX - centerX;

    // Constrain the movement to the draggable range
    const maxOffset = draggableWidth / 2;
    const constrainedOffset = Math.max(
      -maxOffset,
      Math.min(maxOffset, pointerOffset),
    );

    // Convert the offset to a pan value (-1 to 1)
    const pan = constrainedOffset / maxOffset;
    this.onPanChange(pan);
  }

  private reorderedEffectIdsByIndex(
    effectIds: string[],
    movedEffectId: string,
    targetIndex: number,
  ): string[] {
    const fromIndex = effectIds.indexOf(movedEffectId);
    if (fromIndex < 0) {
      return effectIds;
    }

    const toIndex = Math.max(0, Math.min(effectIds.length - 1, targetIndex));
    if (fromIndex === toIndex) {
      return effectIds;
    }

    const nextOrder = [...effectIds];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, movedEffectId);
    return nextOrder;
  }

  private effectTargetSlotIndex(
    pointerLeftPx: number,
    pointerTopPx: number,
  ): number {
    const columnWidth = this.effectButtonSizePx + this.effectColumnGapPx;
    const rowHeight = this.effectButtonSizePx + this.effectRowGapPx;
    const columnIndex = Math.max(
      0,
      Math.min(
        this.effectRackColumns - 1,
        Math.floor((pointerLeftPx + this.effectButtonSizePx / 2) / columnWidth),
      ),
    );
    const maxRowIndex = Math.max(
      0,
      Math.ceil(this.effectButtons().length / this.effectRackColumns) - 1,
    );
    const rowIndex = Math.max(
      0,
      Math.min(
        maxRowIndex,
        Math.floor((pointerTopPx + this.effectButtonSizePx / 2) / rowHeight),
      ),
    );

    return Math.min(
      this.effectButtons().length - 1,
      rowIndex * this.effectRackColumns + columnIndex,
    );
  }

  private effectSlotIndex(effectId: string): number {
    const order =
      this.previewEffectIds ?? this.effectButtons().map((effect) => effect.id);
    const slotIndex = order.indexOf(effectId);
    return slotIndex >= 0 ? slotIndex : 0;
  }

  private effectPlaceholderSlotIndex(): number {
    if (!this.dragEffectId) {
      return 0;
    }

    return this.effectSlotIndex(this.dragEffectId);
  }

  private effectSlotLeftPx(slotIndex: number): number {
    const columnIndex = slotIndex % this.effectRackColumns;
    return columnIndex * (this.effectButtonSizePx + this.effectColumnGapPx);
  }

  private effectSlotTopPx(slotIndex: number): number {
    const rowIndex = Math.floor(slotIndex / this.effectRackColumns);
    return rowIndex * (this.effectButtonSizePx + this.effectRowGapPx);
  }

  private effectGridWidthPx(): number {
    return (
      this.effectRackColumns * this.effectButtonSizePx +
      (this.effectRackColumns - 1) * this.effectColumnGapPx
    );
  }

  private suppressEffectClick(effectId: string): void {
    this.clearSuppressedEffectClick();
    this.suppressNextEffectClickId = effectId;
    this.suppressNextEffectClickTimer = setTimeout(() => {
      this.clearSuppressedEffectClick();
    }, 250);
  }

  private clearSuppressedEffectClick(): void {
    this.suppressNextEffectClickId = null;
    if (this.suppressNextEffectClickTimer) {
      clearTimeout(this.suppressNextEffectClickTimer);
      this.suppressNextEffectClickTimer = null;
    }
  }

  private sameEffectOrder(current: string[], next: string[]): boolean {
    return (
      current.length === next.length &&
      current.every((effectId, index) => effectId === next[index])
    );
  }
}
