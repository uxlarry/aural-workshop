import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
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
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  AudioSetupDialog,
  AudioSetupDialogResult,
  AudioTheme,
} from './audio-setup-dialog';

const SESSION_STORAGE_KEY = 'bbloop.mixer.session.v1';
const THEME_STORAGE_KEY = 'bbloop.theme.v1';
const SHOW_DIAGNOSTICS_STORAGE_KEY = 'bbloop.show-diagnostics.v1';

@Component({
  selector: 'audio-audio-app-shell',
  imports: [
    CommonModule,
    AudioUi,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './audio-app-shell.html',
  styleUrl: './audio-app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioAppShell implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly overlayContainer = inject(OverlayContainer);
  private readonly dialog = inject(MatDialog);
  private readonly orchestration: AudioOrchestrationFacade =
    createDefaultAudioOrchestration();
  private meterRefreshTimer: ReturnType<typeof setInterval> | null = null;
  readonly theme = signal<AudioTheme>('dark');
  readonly showDiagnostics = signal<boolean>(true);

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
  readonly figmaAssets = {
    logo: '/assets/figma/logo.svg',
    inputIcon: '/assets/figma/icon-input.svg',
    outputIcon: '/assets/figma/icon-output.svg',
    channelIndicator: '/assets/figma/icon-channel.svg',
    inputPanel: '/assets/figma/panel-input.png',
    outputPanel: '/assets/figma/panel-output.png',
  };

  async ngOnInit(): Promise<void> {
    this.theme.set(this.loadStoredTheme());
    this.showDiagnostics.set(this.loadStoredShowDiagnostics());
    this.applyThemeClass(this.theme());

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

    this.orchestration.watchDeviceChanges(() => void this.onDevicesChanged());
  }

  async ngOnDestroy(): Promise<void> {
    this.stopMeterRefreshLoop();
    await this.orchestration.stop();
  }

  private async onDevicesChanged(): Promise<void> {
    const devices = await this.orchestration.listDevices();
    this.inputDevices.set(
      devices.filter((device) => device.kind === 'audioinput'),
    );
    this.outputDevices.set(
      devices.filter((device) => device.kind === 'audiooutput'),
    );

    const currentInputId = this.selectedInputDeviceId();
    const inputStillPresent =
      currentInputId === '' ||
      this.inputDevices().some((device) => device.id === currentInputId);
    if (!inputStillPresent) {
      this.selectedInputDeviceId.set('');
    }

    const currentOutputId = this.selectedOutputDeviceId();
    const outputStillPresent =
      currentOutputId === '' ||
      this.outputDevices().some((device) => device.id === currentOutputId);
    if (!outputStillPresent) {
      this.selectedOutputDeviceId.set('');
      void this.orchestration.resetOutputRouting().then(() => {
        this.outputRoutingStatus.set(
          this.orchestration.getOutputRoutingStatus(),
        );
      });
    }
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
    this.dialog
      .open(AudioSetupDialog, {
        data: {
          outputSelectionSupported:
            this.capabilities().outputSelectionSupported,
          theme: this.theme(),
          showDiagnostics: this.showDiagnostics(),
          onThemeChange: (theme: AudioTheme) => this.updateTheme(theme),
          onShowDiagnosticsChange: (showDiagnostics: boolean) =>
            this.updateShowDiagnostics(showDiagnostics),
        },
      })
      .afterClosed()
      .subscribe((result: AudioSetupDialogResult | undefined) => {
        if (result?.theme) {
          this.updateTheme(result.theme);
        }

        if (typeof result?.showDiagnostics === 'boolean') {
          this.updateShowDiagnostics(result.showDiagnostics);
        }
      });
  }

  private updateTheme(theme: AudioTheme): void {
    if (theme === this.theme()) {
      return;
    }

    this.theme.set(theme);
    this.applyThemeClass(theme);
    this.persistTheme(theme);
  }

  private updateShowDiagnostics(showDiagnostics: boolean): void {
    if (showDiagnostics === this.showDiagnostics()) {
      return;
    }

    this.showDiagnostics.set(showDiagnostics);
    this.persistShowDiagnostics(showDiagnostics);
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

  private loadStoredTheme(): AudioTheme {
    if (typeof localStorage === 'undefined') {
      return 'dark';
    }

    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }

      return 'dark';
    } catch {
      return 'dark';
    }
  }

  private persistTheme(theme: AudioTheme): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore persistence failures; theme still applies for this session.
    }
  }

  private loadStoredShowDiagnostics(): boolean {
    if (typeof localStorage === 'undefined') {
      return true;
    }

    try {
      const storedValue = localStorage.getItem(SHOW_DIAGNOSTICS_STORAGE_KEY);
      if (storedValue === null) {
        return true;
      }

      return storedValue === 'true';
    } catch {
      return true;
    }
  }

  private persistShowDiagnostics(showDiagnostics: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        SHOW_DIAGNOSTICS_STORAGE_KEY,
        String(showDiagnostics),
      );
    } catch {
      // Ignore persistence failures; visibility still applies for this session.
    }
  }

  private applyThemeClass(theme: AudioTheme): void {
    const body = this.document.body;
    const overlayContainer = this.overlayContainer.getContainerElement();

    body.classList.toggle('theme-light', theme === 'light');
    body.classList.toggle('theme-dark', theme === 'dark');
    overlayContainer.classList.toggle('theme-light', theme === 'light');
    overlayContainer.classList.toggle('theme-dark', theme === 'dark');
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

  visibleInputDevices(): AudioDeviceInfo[] {
    return this.limitVisibleDevices(
      this.inputDevices(),
      this.selectedInputDeviceId(),
    );
  }

  visibleOutputDevices(): AudioDeviceInfo[] {
    return this.limitVisibleDevices(
      this.outputDevices(),
      this.selectedOutputDeviceId(),
    );
  }

  private limitVisibleDevices(
    devices: AudioDeviceInfo[],
    selectedId: string,
  ): AudioDeviceInfo[] {
    const maxVisible = 4;
    if (devices.length <= maxVisible) {
      return devices;
    }

    const visible = devices.slice(0, maxVisible);
    if (!selectedId || visible.some((device) => device.id === selectedId)) {
      return visible;
    }

    const selectedDevice = devices.find((device) => device.id === selectedId);
    if (!selectedDevice) {
      return visible;
    }

    return [...visible.slice(0, maxVisible - 1), selectedDevice];
  }
}
