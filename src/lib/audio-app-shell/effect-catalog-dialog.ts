import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MixerEffectType } from '@org/audio-model';

export interface EffectCatalogItem {
  type: MixerEffectType;
  label: string;
  icon: string;
  active: boolean;
}

export interface EffectCatalogDialogData {
  channelLabel: string;
  effects: EffectCatalogItem[];
  onSetEffectTypeActive?: (
    effectType: MixerEffectType,
    active: boolean,
  ) => void;
}

@Component({
  selector: 'audio-effect-catalog-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Add Effects</h2>

    <mat-dialog-content>
      <p class="catalog-meta">{{ data.channelLabel }} effect catalog</p>

      <div
        class="effect-catalog-grid"
        role="list"
        aria-label="Available effects"
      >
        <button
          *ngFor="let effect of effects()"
          class="effect-catalog-button"
          [class.effect-catalog-button--active]="isActive(effect.type)"
          type="button"
          matTooltip="{{ effect.label }}"
          aria-label="{{ effect.label }}"
          (click)="toggle(effect.type)"
        >
          <mat-icon>{{ effect.icon }}</mat-icon>
        </button>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .catalog-meta {
      margin: 0 0 12px;
      color: var(
        --mat-sys-on-surface-variant,
        var(--color-text-muted, #8f8f8f)
      );
      font-size: 0.85rem;
    }

    .effect-catalog-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .effect-catalog-button {
      width: 48px;
      height: 48px;
      border: 1px solid var(--mat-sys-outline-variant, var(--color-outline));
      border-radius: var(--radius-corner, 16px);
      background: var(--mat-sys-surface, transparent);
      color: var(--mat-sys-on-surface, inherit);
      display: grid;
      place-items: center;
      cursor: pointer;
    }

    .effect-catalog-button:hover {
      background: var(
        --mat-sys-surface-container-low,
        var(--color-overlay-subtle)
      );
    }

    .effect-catalog-button--active {
      border-color: var(--mat-sys-primary, #3b82f6);
      box-shadow: inset 0 0 0 1px var(--mat-sys-primary, #3b82f6);
    }

    .effect-catalog-button .mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectCatalogDialog {
  readonly data = inject<EffectCatalogDialogData>(MAT_DIALOG_DATA);
  readonly effects = signal<EffectCatalogItem[]>(this.data.effects);

  isActive(effectType: MixerEffectType): boolean {
    return this.effects().some(
      (effect) => effect.type === effectType && effect.active,
    );
  }

  toggle(effectType: MixerEffectType): void {
    const nextActive = !this.isActive(effectType);
    this.effects.update((effects) =>
      effects.map((effect) =>
        effect.type === effectType ? { ...effect, active: nextActive } : effect,
      ),
    );
    this.data.onSetEffectTypeActive?.(effectType, nextActive);
  }
}
