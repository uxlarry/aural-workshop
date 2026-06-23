import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface AudioSetupDialogData {
  outputSelectionSupported: boolean;
}

@Component({
  selector: 'audio-audio-setup-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
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
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioSetupDialog {
  readonly data = inject<AudioSetupDialogData>(MAT_DIALOG_DATA);
}
