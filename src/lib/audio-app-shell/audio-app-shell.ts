import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AudioDeviceInfo,
  AudioParameterChange,
  DeviceCapabilities,
  MixerChannel,
  MixerSession,
} from '@org/audio-model';
import { AudioUi } from '@org/audio-ui';
import {
  AudioOrchestrationFacade,
  createDefaultAudioOrchestration,
} from '@org/audio-orchestration';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AudioSetupDialog } from './audio-setup-dialog';

@Component({
  selector: 'audio-audio-app-shell',
  imports: [
    CommonModule,
    AudioUi,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
  ],
  templateUrl: './audio-app-shell.html',
  styleUrl: './audio-app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioAppShell implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly orchestration: AudioOrchestrationFacade =
    createDefaultAudioOrchestration();

  readonly channels = signal<MixerChannel[]>([
    {
      id: 'input',
      type: 'input',
      label: 'Input',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
    },
    {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
    },
    {
      id: 'output',
      type: 'output',
      label: 'Output',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
    },
  ]);

  readonly capabilities = signal<DeviceCapabilities>({
    outputSelectionSupported: false,
  });
  readonly inputDevices = signal<AudioDeviceInfo[]>([]);
  readonly outputDevices = signal<AudioDeviceInfo[]>([]);
  readonly selectedInputDeviceId = signal<string>('');
  readonly selectedOutputDeviceId = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.orchestration.start(this.currentSession());

    const capabilities = await this.orchestration.getCapabilities();
    this.capabilities.set(capabilities);

    const devices = await this.orchestration.listDevices();
    this.inputDevices.set(
      devices.filter((device) => device.kind === 'audioinput'),
    );
    this.outputDevices.set(
      devices.filter((device) => device.kind === 'audiooutput'),
    );
  }

  async ngOnDestroy(): Promise<void> {
    await this.orchestration.stop();
  }

  onParameterChange(change: AudioParameterChange): void {
    this.orchestration.changeParameter(change);

    this.channels.update((channels) =>
      channels.map((channel) =>
        channel.id === change.channelId
          ? {
              ...channel,
              [change.parameter]:
                change.parameter === 'gainDb' || change.parameter === 'pan'
                  ? Number(change.value)
                  : Boolean(change.value),
            }
          : channel,
      ),
    );
  }

  async onInputDeviceChange(deviceId: string): Promise<void> {
    this.selectedInputDeviceId.set(deviceId);
    await this.orchestration.setInputDevice(deviceId);
  }

  async onOutputDeviceChange(deviceId: string): Promise<void> {
    this.selectedOutputDeviceId.set(deviceId);
    await this.orchestration.setOutputDevice(deviceId);
  }

  openSetupDialog(): void {
    this.dialog.open(AudioSetupDialog, {
      data: {
        outputSelectionSupported: this.capabilities().outputSelectionSupported,
      },
    });
  }

  private currentSession(): MixerSession {
    return {
      channels: this.channels(),
    };
  }
}
