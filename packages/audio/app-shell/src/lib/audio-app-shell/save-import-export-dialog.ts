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

export interface SaveImportExportDialogData {
  onExport?: () => void;
  onImportTriggered?: () => void;
  hasPresets?: boolean;
}

@Component({
  selector: 'audio-save-import-export-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-icon">folder</mat-icon>
      Save, Import & Export
    </h2>
    <mat-dialog-content>
      <p>Manage your effect presets and session data.</p>

      <div class="dialog-actions">
        <button
          mat-raised-button
          color="primary"
          [disabled]="!data.hasPresets"
          (click)="onExport()"
          class="action-button"
        >
          <mat-icon>download</mat-icon>
          <span>Export Presets</span>
        </button>
        <p class="action-description">
          Save your effect presets to a JSON file for backup or sharing.
        </p>
      </div>

      <div class="dialog-actions">
        <button
          mat-raised-button
          color="primary"
          (click)="onImport()"
          class="action-button"
        >
          <mat-icon>upload</mat-icon>
          <span>Import Presets</span>
        </button>
        <p class="action-description">
          Load effect presets from a previously saved JSON file.
        </p>
      </div>

      <div class="dialog-actions">
        <button
          mat-raised-button
          (click)="onSaveSession()"
          class="action-button"
        >
          <mat-icon>save</mat-icon>
          <span>Save Session</span>
        </button>
        <p class="action-description">Save your current mixer configuration.</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button [mat-dialog-close]>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }

    .dialog-icon {
      font-size: 24px;
      height: 24px;
      width: 24px;
    }

    mat-dialog-content {
      padding: 16px 24px;
    }

    p {
      margin: 0 0 16px 0;
      font-size: 14px;
    }

    .dialog-actions {
      margin-bottom: 20px;

      &:last-of-type {
        margin-bottom: 0;
      }
    }

    .action-button {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      justify-content: center;

      mat-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
      }
    }

    .action-description {
      margin: 8px 0 0 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    mat-dialog-actions {
      padding: 16px 24px;
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveImportExportDialog {
  readonly data = inject<SaveImportExportDialogData>(MAT_DIALOG_DATA);

  onExport(): void {
    this.data.onExport?.();
  }

  onImport(): void {
    this.data.onImportTriggered?.();
  }

  onSaveSession(): void {
    // TODO: Implement session save functionality
    console.log('Save session');
  }
}
