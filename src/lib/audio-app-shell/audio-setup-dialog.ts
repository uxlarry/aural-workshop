import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

export type AudioTheme = 'dark' | 'light';

export interface AudioSetupDialogResult {
  theme?: AudioTheme;
  showDiagnostics?: boolean;
}

export interface AudioSetupDialogData {
  outputSelectionSupported: boolean;
  theme: AudioTheme;
  showDiagnostics: boolean;
  onThemeChange?: (theme: AudioTheme) => void;
  onShowDiagnosticsChange?: (showDiagnostics: boolean) => void;
}

@Component({
  selector: 'audio-audio-setup-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>Audio Setup</h2>
    <mat-dialog-content>
      <p>
        Configure your input and output devices before starting live monitoring.
      </p>
      @if (!data.outputSelectionSupported) {
        <p>
          Output device selection is not available in this browser. bbloop will
          use the default system output.
        </p>
      }

      <div class="settings-toggles">
        <mat-slide-toggle
          class="theme-toggle"
          [checked]="selectedTheme() === 'dark'"
          (change)="onDarkThemeToggle($event.checked)"
        >
          Dark theme
        </mat-slide-toggle>

        <mat-slide-toggle
          class="theme-toggle"
          [checked]="selectedShowDiagnostics()"
          (change)="onShowDiagnosticsToggle($event.checked)"
        >
          Show diagnostics
        </mat-slide-toggle>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-raised-button
        color="primary"
        [mat-dialog-close]="{
          theme: selectedTheme(),
          showDiagnostics: selectedShowDiagnostics(),
        }"
      >
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .settings-toggles {
      margin: 16px 0 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .theme-toggle {
      display: flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioSetupDialog {
  readonly data = inject<AudioSetupDialogData>(MAT_DIALOG_DATA);
  readonly selectedTheme = signal<AudioTheme>(this.data.theme);
  readonly selectedShowDiagnostics = signal<boolean>(this.data.showDiagnostics);

  onDarkThemeToggle(checked: boolean): void {
    const theme: AudioTheme = checked ? 'dark' : 'light';
    this.selectedTheme.set(theme);
    this.data.onThemeChange?.(theme);
  }

  onShowDiagnosticsToggle(checked: boolean): void {
    this.selectedShowDiagnostics.set(checked);
    this.data.onShowDiagnosticsChange?.(checked);
  }
}
