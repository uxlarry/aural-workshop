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
  MixerEffect,
  MixerEffectParameterName,
  MixerEffectType,
  MixerChannel,
  MixerSession,
  createDefaultMixerEffect,
} from '@org/audio-model';
import { AudioUi, EffectSelection } from '@org/audio-ui';
import {
  AudioOrchestrationFacade,
  OutputRoutingStatus,
  createDefaultAudioOrchestration,
} from '@org/audio-orchestration';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  AudioSetupDialog,
  AudioSetupDialogResult,
  AudioTheme,
} from './audio-setup-dialog';
import {
  EffectParameterUiMeta,
  EffectSettingsDialog,
} from './effect-settings-dialog';

const SESSION_STORAGE_KEY = 'bbloop.mixer.session.v1';
const THEME_STORAGE_KEY = 'bbloop.theme.v1';
const SHOW_DIAGNOSTICS_STORAGE_KEY = 'bbloop.show-diagnostics.v1';
const EFFECT_PRESETS_STORAGE_KEY = 'bbloop.effects.presets.v1';

interface EffectChainPreset {
  name: string;
  effects: MixerEffect[];
}

interface EffectPresetImportShape {
  presets: EffectChainPreset[];
}

const EFFECT_TYPE_LABELS: Record<MixerEffectType, string> = {
  highpass: 'High-Pass Filter',
  lowpass: 'Low-Pass Filter',
  distortion: 'Distortion',
  compressor: 'Compressor',
};

const EFFECT_PARAMETERS: Record<MixerEffectType, EffectParameterUiMeta[]> = {
  highpass: [
    {
      parameter: 'frequencyHz',
      label: 'Frequency',
      min: 40,
      max: 18000,
      step: 1,
    },
    {
      parameter: 'q',
      label: 'Q',
      min: 0.1,
      max: 20,
      step: 0.1,
    },
  ],
  lowpass: [
    {
      parameter: 'frequencyHz',
      label: 'Frequency',
      min: 40,
      max: 18000,
      step: 1,
    },
    {
      parameter: 'q',
      label: 'Q',
      min: 0.1,
      max: 20,
      step: 0.1,
    },
  ],
  distortion: [
    {
      parameter: 'amount',
      label: 'Amount',
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  compressor: [
    {
      parameter: 'thresholdDb',
      label: 'Threshold (dB)',
      min: -90,
      max: 0,
      step: 1,
    },
    {
      parameter: 'ratio',
      label: 'Ratio',
      min: 1,
      max: 20,
      step: 0.1,
    },
  ],
};

@Component({
  selector: 'audio-audio-app-shell',
  imports: [
    CommonModule,
    AudioUi,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
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
  private effectChainSyncTimer: ReturnType<typeof setTimeout> | null = null;
  readonly theme = signal<AudioTheme>('dark');
  readonly showDiagnostics = signal<boolean>(true);
  readonly effectPresetName = signal<string>('');
  readonly effectPresets = signal<EffectChainPreset[]>([]);

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
    channelIndicator: '/assets/figma/icon-channel.svg',
  };
  readonly availableEffectTypes: MixerEffectType[] = [
    'highpass',
    'lowpass',
    'distortion',
    'compressor',
  ];

  async ngOnInit(): Promise<void> {
    this.theme.set(this.loadStoredTheme());
    this.showDiagnostics.set(this.loadStoredShowDiagnostics());
    this.applyThemeClass(this.theme());

    const initialSession = this.loadStoredSession() ?? this.currentSession();
    this.channels.set(initialSession.channels);
    this.effectPresets.set(this.loadStoredEffectPresets());

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
    this.syncSelectedInputDevice();
    this.outputDevices.set(
      devices.filter((device) => device.kind === 'audiooutput'),
    );
    this.syncSelectedOutputDevice();
    this.outputRoutingStatus.set(
      this.withOutputDeviceLabel(this.orchestration.getOutputRoutingStatus()),
    );

    this.orchestration.watchDeviceChanges(() => void this.onDevicesChanged());
  }

  async ngOnDestroy(): Promise<void> {
    if (this.effectChainSyncTimer) {
      clearTimeout(this.effectChainSyncTimer);
      this.effectChainSyncTimer = null;
    }
    this.stopMeterRefreshLoop();
    await this.orchestration.stop();
  }

  private async onDevicesChanged(): Promise<void> {
    const devices = await this.orchestration.listDevices();
    this.inputDevices.set(
      devices.filter((device) => device.kind === 'audioinput'),
    );
    this.syncSelectedInputDevice();
    this.outputDevices.set(
      devices.filter((device) => device.kind === 'audiooutput'),
    );
    this.syncSelectedOutputDevice();

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

  effectTypeLabel(effectType: MixerEffectType): string {
    return EFFECT_TYPE_LABELS[effectType];
  }

  effectUiParameters(effectType: MixerEffectType): EffectParameterUiMeta[] {
    return EFFECT_PARAMETERS[effectType];
  }

  onEffectSelected(selection: EffectSelection): void {
    this.openEffectSettings(selection.channelId, selection.effectId);
  }

  openEffectSettings(channelId: string, effectId: string): void {
    const targetChannel = this.channels().find(
      (channel) => channel.id === channelId,
    );
    if (!targetChannel) {
      return;
    }

    const effect = (targetChannel.effects ?? []).find(
      (item) => item.id === effectId,
    );
    if (!effect) {
      return;
    }

    this.dialog.open(EffectSettingsDialog, {
      data: {
        effect,
        effectTypeLabel: this.effectTypeLabel(effect.type),
        parameterMeta: this.effectUiParameters(effect.type),
        onBypassedChange: (bypassed: boolean) =>
          this.setEffectBypassed(effect.id, bypassed),
        onMixChange: (mix: number) => this.setEffectMix(effect.id, mix),
        onParameterChange: (
          parameter: MixerEffectParameterName,
          value: number,
        ) => this.setEffectParameter(effect.id, parameter, value),
      },
      width: '420px',
      autoFocus: false,
    });
  }

  hasVirtualAmpEffects(): boolean {
    const virtualAmp = this.findVirtualAmpChannel();
    return Boolean(virtualAmp && (virtualAmp.effects?.length ?? 0) > 0);
  }

  effectsChainEnabled(): boolean {
    const virtualAmp = this.findVirtualAmpChannel();
    return virtualAmp?.effectsEnabled !== false;
  }

  getVirtualAmpEffects(): MixerEffect[] {
    return this.findVirtualAmpChannel()?.effects ?? [];
  }

  addEffect(effectType: MixerEffectType): void {
    this.updateVirtualAmpEffects((effects) => {
      const newEffect = createDefaultMixerEffect(effectType);
      return [...effects, newEffect];
    });
  }

  setEffectsChainEnabled(enabled: boolean): void {
    let didUpdate = false;

    this.channels.update((channels) =>
      channels.map((channel) => {
        if (channel.type !== 'internal') {
          return channel;
        }

        didUpdate = true;
        return {
          ...channel,
          effectsEnabled: enabled,
        };
      }),
    );

    if (!didUpdate) {
      return;
    }

    this.persistSession();
    this.scheduleEffectChainSync();
  }

  removeEffect(effectId: string): void {
    this.updateVirtualAmpEffects((effects) =>
      effects.filter((effect) => effect.id !== effectId),
    );
  }

  moveEffect(effectId: string, direction: -1 | 1): void {
    this.updateVirtualAmpEffects((effects) => {
      const currentIndex = effects.findIndex(
        (effect) => effect.id === effectId,
      );
      if (currentIndex < 0) {
        return effects;
      }

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= effects.length) {
        return effects;
      }

      const reordered = [...effects];
      const [effect] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, effect);
      return reordered;
    });
  }

  setEffectBypassed(effectId: string, bypassed: boolean): void {
    this.updateVirtualAmpEffects((effects) =>
      effects.map((effect) =>
        effect.id === effectId ? { ...effect, bypassed } : effect,
      ),
    );
  }

  setEffectParameter(
    effectId: string,
    parameter: MixerEffectParameterName,
    value: number,
  ): void {
    this.updateVirtualAmpEffects((effects) =>
      effects.map((effect) => {
        if (effect.id !== effectId) {
          return effect;
        }

        return {
          ...effect,
          parameters: {
            ...effect.parameters,
            [parameter]: value,
          },
        };
      }),
    );
  }

  setEffectMix(effectId: string, mix: number): void {
    this.updateVirtualAmpEffects((effects) =>
      effects.map((effect) =>
        effect.id === effectId
          ? { ...effect, mix: Math.max(0, Math.min(1, mix)) }
          : effect,
      ),
    );
  }

  effectParameterValue(
    effect: MixerEffect,
    parameter: MixerEffectParameterName,
    fallback: number,
  ): number {
    const value = effect.parameters[parameter];
    return typeof value === 'number' ? value : fallback;
  }

  onEffectPresetNameInput(name: string): void {
    this.effectPresetName.set(name);
  }

  saveEffectPreset(): void {
    const presetName = this.effectPresetName().trim();
    if (!presetName) {
      return;
    }

    const currentEffects = this.cloneEffects(this.getVirtualAmpEffects());
    const existing = this.effectPresets();
    const existingIndex = existing.findIndex(
      (preset) => preset.name.toLowerCase() === presetName.toLowerCase(),
    );

    const nextPresets = [...existing];
    const nextPreset: EffectChainPreset = {
      name: presetName,
      effects: currentEffects,
    };

    if (existingIndex >= 0) {
      nextPresets[existingIndex] = nextPreset;
    } else {
      nextPresets.push(nextPreset);
    }

    this.effectPresets.set(nextPresets);
    this.persistEffectPresets();
  }

  loadEffectPreset(presetName: string): void {
    const preset = this.effectPresets().find(
      (item) => item.name === presetName,
    );
    if (!preset) {
      return;
    }

    this.updateVirtualAmpEffects(() => this.cloneEffects(preset.effects));
    this.effectPresetName.set(preset.name);
  }

  deleteEffectPreset(presetName: string): void {
    const nextPresets = this.effectPresets().filter(
      (preset) => preset.name !== presetName,
    );
    this.effectPresets.set(nextPresets);
    this.persistEffectPresets();
  }

  exportEffectPresets(): void {
    if (typeof document === 'undefined' || this.effectPresets().length === 0) {
      return;
    }

    const payload: EffectPresetImportShape = {
      presets: this.effectPresets().map((preset) => ({
        name: preset.name,
        effects: this.cloneEffects(preset.effects),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const objectUrl = URL.createObjectURL(blob);

    try {
      const anchor = this.document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      anchor.href = objectUrl;
      anchor.download = `bbloop-effect-presets-${stamp}.json`;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async onPresetFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0);
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EffectPresetImportShape;
      const presets = Array.isArray(parsed?.presets) ? parsed.presets : [];

      const normalizedPresets = presets
        .filter(
          (preset) =>
            preset &&
            typeof preset.name === 'string' &&
            Array.isArray(preset.effects),
        )
        .map((preset) => ({
          name: preset.name.trim(),
          effects: this.cloneEffects(preset.effects),
        }))
        .filter((preset) => preset.name.length > 0);

      this.effectPresets.set(normalizedPresets);
      this.persistEffectPresets();
    } catch {
      // Ignore malformed files and keep existing presets untouched.
    } finally {
      if (input) {
        input.value = '';
      }
    }
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

  private findVirtualAmpChannel(): MixerChannel | undefined {
    return this.channels().find((channel) => channel.type === 'internal');
  }

  private updateVirtualAmpEffects(
    updater: (effects: MixerEffect[]) => MixerEffect[],
  ): void {
    let didUpdate = false;

    this.channels.update((channels) =>
      channels.map((channel) => {
        if (channel.type !== 'internal') {
          return channel;
        }

        didUpdate = true;
        const currentEffects = channel.effects ?? [];
        return {
          ...channel,
          effects: updater(currentEffects),
        };
      }),
    );

    if (!didUpdate) {
      return;
    }

    this.persistSession();
    this.scheduleEffectChainSync();
  }

  private cloneEffects(effects: MixerEffect[]): MixerEffect[] {
    return effects.map((effect) => ({
      ...effect,
      parameters: {
        ...effect.parameters,
      },
    }));
  }

  private scheduleEffectChainSync(): void {
    if (this.effectChainSyncTimer) {
      clearTimeout(this.effectChainSyncTimer);
    }

    this.effectChainSyncTimer = setTimeout(() => {
      this.effectChainSyncTimer = null;
      void this.orchestration.restoreSession(this.currentSession());
    }, 100);
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

  private loadStoredEffectPresets(): EffectChainPreset[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const serialized = localStorage.getItem(EFFECT_PRESETS_STORAGE_KEY);
      if (!serialized) {
        return [];
      }

      const parsed = JSON.parse(serialized) as EffectChainPreset[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (preset) =>
            preset &&
            typeof preset.name === 'string' &&
            Array.isArray(preset.effects),
        )
        .map((preset) => ({
          name: preset.name,
          effects: this.cloneEffects(preset.effects),
        }));
    } catch {
      return [];
    }
  }

  private persistEffectPresets(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        EFFECT_PRESETS_STORAGE_KEY,
        JSON.stringify(this.effectPresets()),
      );
    } catch {
      // Ignore persistence failures; presets remain available in-memory.
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

  private syncSelectedInputDevice(): void {
    const devices = this.inputDevices();
    if (devices.length === 0) {
      this.selectedInputDeviceId.set('');
      return;
    }

    const currentSelectionId = this.selectedInputDeviceId();
    if (devices.some((device) => device.id === currentSelectionId)) {
      return;
    }

    const defaultDevice =
      devices.find((device) => device.id === 'default') ?? devices[0];
    this.selectedInputDeviceId.set(defaultDevice.id);
  }

  private syncSelectedOutputDevice(): void {
    const devices = this.outputDevices();
    if (devices.length === 0) {
      this.selectedOutputDeviceId.set('');
      return;
    }

    const currentSelectionId = this.selectedOutputDeviceId();
    if (devices.some((device) => device.id === currentSelectionId)) {
      return;
    }

    const defaultDevice =
      devices.find((device) => device.id === 'default') ?? devices[0];
    this.selectedOutputDeviceId.set(defaultDevice.id);
  }
}
