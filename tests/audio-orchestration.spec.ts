import type {
  AudioHealthSnapshot,
  AudioParameterChange,
  MixerSession,
} from '@org/audio-model';
import type { AudioEngine } from '@org/audio-engine';
import type { AudioDeviceAdapter } from '@org/audio-device';
import { DefaultAudioOrchestrationFacade } from '../src';

class FakeAudioEngine implements AudioEngine {
  initializeCalls = 0;
  disposeCalls = 0;
  sessionApplications: MixerSession[] = [];
  parameterApplications: AudioParameterChange[] = [];

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
  }

  async applySession(session: MixerSession): Promise<void> {
    this.sessionApplications.push(session);
  }

  applyParameterChange(change: AudioParameterChange): void {
    this.parameterApplications.push(change);
  }

  getHealthSnapshot(): AudioHealthSnapshot {
    return { dropoutCount: 0, estimatedLatencyMs: 0 };
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

class FakeDeviceAdapter implements AudioDeviceAdapter {
  async getCapabilities() {
    return { outputSelectionSupported: true };
  }

  async listDevices() {
    return [];
  }

  async setInputDevice(): Promise<void> {
    return;
  }

  async setOutputDevice(): Promise<void> {
    return;
  }
}

const BASE_SESSION: MixerSession = {
  channels: [
    {
      id: 'input-a',
      type: 'input',
      label: 'Input A',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
    },
  ],
};

describe('DefaultAudioOrchestrationFacade', () => {
  it('debounces parameter changes and applies the latest value', async () => {
    vi.useFakeTimers();

    const engine = new FakeAudioEngine();
    const facade = new DefaultAudioOrchestrationFacade(
      engine,
      new FakeDeviceAdapter(),
      { parameterDebounceMs: 25 },
    );

    await facade.start(BASE_SESSION);
    facade.changeParameter({ channelId: 'input-a', parameter: 'gainDb', value: 3 });
    facade.changeParameter({ channelId: 'input-a', parameter: 'gainDb', value: 7 });

    expect(engine.parameterApplications).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30);

    expect(engine.parameterApplications).toHaveLength(1);
    expect(engine.parameterApplications[0]).toMatchObject({
      channelId: 'input-a',
      parameter: 'gainDb',
      value: 7,
    });

    vi.useRealTimers();
  });

  it('saves and restores normalized sessions', async () => {
    const engine = new FakeAudioEngine();
    const facade = new DefaultAudioOrchestrationFacade(
      engine,
      new FakeDeviceAdapter(),
      { parameterDebounceMs: 1 },
    );

    await facade.start({
      channels: [
        {
          id: 'input-a',
          type: 'input',
          label: '  ',
          gainDb: 500,
          pan: -10,
          muted: false,
          solo: false,
        },
      ],
    });

    const savedSession = facade.saveSession();

    expect(savedSession).not.toBeNull();
    expect(savedSession?.channels[0]).toMatchObject({
      label: 'Channel',
      gainDb: 12,
      pan: -1,
    });

    await facade.restoreSession(BASE_SESSION);

    expect(engine.sessionApplications).toHaveLength(2);
  });

  it('flushes pending parameter changes before stop', async () => {
    vi.useFakeTimers();

    const engine = new FakeAudioEngine();
    const facade = new DefaultAudioOrchestrationFacade(
      engine,
      new FakeDeviceAdapter(),
      { parameterDebounceMs: 1_000 },
    );

    await facade.start(BASE_SESSION);
    facade.changeParameter({
      channelId: 'input-a',
      parameter: 'muted',
      value: true,
    });

    await facade.stop();

    expect(engine.parameterApplications).toHaveLength(1);
    expect(engine.disposeCalls).toBe(1);

    vi.useRealTimers();
  });
});
