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
  AudioHealthSnapshot,
  AudioDeviceInfo,
  AudioParameterChange,
  DeviceCapabilities,
  MixerChannel,
  MixerSession,
} from '@org/audio-model';
import { AudioUi } from '@org/audio-ui';
import {
  AudioOrchestrationFacade,
  OutputRoutingStatus,
  createDefaultAudioOrchestration,
} from '@org/audio-orchestration';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AudioSetupDialog } from './audio-setup-dialog';

const SESSION_STORAGE_KEY = 'bbloop.mixer.session.v1';

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
  private meterRefreshTimer: ReturnType<typeof setInterval> | null = null;

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
  readonly outputRoutingStatus = signal<OutputRoutingStatus>({
    state: 'default',
    message: 'Using system default output device.',
  });
  readonly audioHealth = signal<AudioHealthSnapshot>({
    dropoutCount: 0,
    estimatedLatencyMs: undefined,
  });

  async ngOnInit(): Promise<void> {
    const initialSession = this.loadStoredSession() ?? this.currentSession();
    this.channels.set(initialSession.channels);

    await this.orchestration.start(initialSession);
    this.outputRoutingStatus.set(this.orchestration.getOutputRoutingStatus());
    this.audioHealth.set(this.orchestration.readHealth());
    this.startMeterRefreshLoop();

    const capabilities = await this.orchestration.getCapabilities();
    this.capabilities.set(capabilities);

    const devices = await this.orchestration.listDevices();
    this.inputDevices.set(
      devices.filter((device) => device.kind === 'audioinput'),
    );
    this.outputDevices.set(
      devices.filter((device) => device.kind === 'audiooutput'),
    );
    this.outputRoutingStatus.set(
      this.withOutputDeviceLabel(this.orchestration.getOutputRoutingStatus()),
    );
  }

  async ngOnDestroy(): Promise<void> {
    this.stopMeterRefreshLoop();
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

    this.persistSession();
  }

  onInputDeviceChange(deviceId: string): void {
    this.selectedInputDeviceId.set(deviceId);
    void this.orchestration.setInputDevice(deviceId);
  }

  onOutputDeviceChange(deviceId: string): void {
    this.selectedOutputDeviceId.set(deviceId);
    void this.applyOutputDeviceSelection(deviceId);
  }

  onResetHealthCounters(): void {
    this.orchestration.resetHealthCounters();
    this.audioHealth.set(this.orchestration.readHealth());
  }

  onResetOutputRouting(): void {
    this.selectedOutputDeviceId.set('');
    void this.orchestration.resetOutputRouting().then(() => {
      this.outputRoutingStatus.set(this.orchestration.getOutputRoutingStatus());
    });
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

  private startMeterRefreshLoop(): void {
    this.stopMeterRefreshLoop();

    this.meterRefreshTimer = setInterval(() => {
      const session = this.orchestration.saveSession();
      if (!session) {
        return;
      }

      this.channels.set(session.channels);
      this.audioHealth.set(this.orchestration.readHealth());
    }, 150);
  }

  private stopMeterRefreshLoop(): void {
    if (!this.meterRefreshTimer) {
      return;
    }

    clearInterval(this.meterRefreshTimer);
    this.meterRefreshTimer = null;
  }

  private persistSession(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const snapshot: MixerSession = {
        channels: this.channels().map(({ meter, ...channel }) => {
          void meter;
          return channel;
        }),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore persistence failures to avoid blocking live audio controls.
    }
  }

  private loadStoredSession(): MixerSession | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const serialized = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!serialized) {
        return null;
      }

      const parsed = JSON.parse(serialized) as MixerSession;
      if (
        !parsed ||
        !Array.isArray(parsed.channels) ||
        parsed.channels.length === 0
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private async applyOutputDeviceSelection(deviceId: string): Promise<void> {
    try {
      await this.orchestration.setOutputDevice(deviceId);
    } finally {
      this.outputRoutingStatus.set(
        this.withOutputDeviceLabel(this.orchestration.getOutputRoutingStatus()),
      );
    }
  }

  private withOutputDeviceLabel(
    status: OutputRoutingStatus,
  ): OutputRoutingStatus {
    if (!status.deviceId) {
      return status;
    }

    const matchedDevice = this.outputDevices().find(
      (device) => device.id === status.deviceId,
    );
    if (!matchedDevice) {
      return status;
    }

    const suffix = ` (${matchedDevice.label})`;
    if (status.message.includes(suffix)) {
      return status;
    }

    return {
      ...status,
      message: `${status.message}${suffix}`,
    };
  }

  outputRoutingStateLabel(): string {
    const state = this.outputRoutingStatus().state;
    if (state === 'applied') {
      return 'Applied';
    }
    if (state === 'failed') {
      return 'Failed';
    }
    if (state === 'unsupported') {
      return 'Unsupported';
    }

    return 'Default';
  }

  healthLatencyLabel(): string {
    const latencyMs = this.audioHealth().estimatedLatencyMs;
    if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) {
      return 'n/a';
    }

    return `${latencyMs.toFixed(1)} ms`;
  }
}
