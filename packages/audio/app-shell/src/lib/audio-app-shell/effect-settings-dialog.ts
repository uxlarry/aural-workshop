import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import {
  MixerEffect,
  MixerEffectParameterName,
  MixerEffectType,
} from '@org/audio-model';

export interface EffectParameterUiMeta {
  parameter: MixerEffectParameterName;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface EffectSettingsDialogData {
  effect: MixerEffect;
  effectTypeLabel: string;
  parameterMeta: EffectParameterUiMeta[];
  onBypassedChange?: (bypassed: boolean) => void;
  onMixChange?: (mix: number) => void;
  onParameterChange?: (
    parameter: MixerEffectParameterName,
    value: number,
  ) => void;
}

@Component({
  selector: 'audio-effect-settings-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.effectTypeLabel }} Settings</h2>

    <mat-dialog-content>
      <p class="effect-meta">
        {{ data.effect.label }}
      </p>

      <div class="field-group">
        <label>
          <span>Bypass: {{ bypassed() ? 'On' : 'Off' }}</span>
          <input
            type="checkbox"
            [checked]="bypassed()"
            (change)="onBypassChange($any($event.target).checked)"
          />
        </label>
      </div>

      <div class="field-group">
        <label>
          <span>Mix: {{ mix() | number: '1.2-2' }}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            [value]="mix()"
            (input)="onMixInput(+$any($event.target).value)"
          />
        </label>
      </div>

      <div class="field-group" *ngFor="let meta of data.parameterMeta">
        <label>
          <span>
            {{ meta.label }}:
            {{ parameterValue(meta.parameter, meta.min) | number: '1.0-2' }}
          </span>
          <input
            type="range"
            [min]="meta.min"
            [max]="meta.max"
            [step]="meta.step"
            [value]="parameterValue(meta.parameter, meta.min)"
            (input)="
              onParameterInput(meta.parameter, +$any($event.target).value)
            "
          />
        </label>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .effect-meta {
      margin: 0 0 12px;
      color: var(--color-text-muted, #8f8f8f);
      font-size: 0.85rem;
    }

    .field-group {
      margin: 0 0 10px;
    }

    .field-group label {
      display: grid;
      gap: 6px;
      font-size: 0.85rem;
    }

    .field-group input[type='range'] {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectSettingsDialog {
  readonly data = inject<EffectSettingsDialogData>(MAT_DIALOG_DATA);
  readonly bypassed = signal<boolean>(Boolean(this.data.effect.bypassed));
  readonly mix = signal<number>(
    typeof this.data.effect.mix === 'number' ? this.data.effect.mix : 1,
  );
  private readonly parameterValues = signal<
    Partial<Record<MixerEffectParameterName, number>>
  >({
    ...this.data.effect.parameters,
  });

  onBypassChange(bypassed: boolean): void {
    this.bypassed.set(bypassed);
    this.data.onBypassedChange?.(bypassed);
  }

  onMixInput(mix: number): void {
    const clamped = Math.max(0, Math.min(1, mix));
    this.mix.set(clamped);
    this.data.onMixChange?.(clamped);
  }

  onParameterInput(parameter: MixerEffectParameterName, value: number): void {
    this.parameterValues.update((current) => ({
      ...current,
      [parameter]: value,
    }));
    this.data.onParameterChange?.(parameter, value);
  }

  parameterValue(
    parameter: MixerEffectParameterName,
    fallback: number,
  ): number {
    const value = this.parameterValues()[parameter];
    return typeof value === 'number' ? value : fallback;
  }
}
