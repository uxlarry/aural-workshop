import {
  createDefaultMixerEffect,
  getSessionValidationIssues,
  normalizeMixerSession,
  type MixerSession,
} from '../src';

describe('audio-model session helpers', () => {
  it('normalizes labels and clamps gain/pan', () => {
    const session: MixerSession = {
      channels: [
        {
          id: 'ch-1',
          type: 'input',
          label: '  ',
          gainDb: 99,
          pan: -5,
          muted: false,
          solo: false,
        },
      ],
    };

    const normalized = normalizeMixerSession(session);

    expect(normalized.channels[0]).toMatchObject({
      label: 'Channel',
      gainDb: 12,
      pan: -1,
    });
  });

  it('reports empty sessions and duplicate channel ids', () => {
    const emptyIssues = getSessionValidationIssues({ channels: [] });
    expect(emptyIssues.map((issue) => issue.code)).toContain('empty-session');

    const duplicateIssues = getSessionValidationIssues({
      channels: [
        {
          id: 'ch-1',
          type: 'input',
          label: 'Input A',
          gainDb: 0,
          pan: 0,
          muted: false,
          solo: false,
        },
        {
          id: 'ch-1',
          type: 'output',
          label: 'Main Out',
          gainDb: 0,
          pan: 0,
          muted: false,
          solo: false,
        },
      ],
    });

    expect(
      duplicateIssues.some((issue) => issue.code === 'duplicate-channel-id'),
    ).toBe(true);
  });

  it('normalizes effect defaults and clamps effect parameters', () => {
    const baseEffect = createDefaultMixerEffect('distortion', 'fx-distortion');
    const session: MixerSession = {
      channels: [
        {
          id: 'virtual-amp',
          type: 'internal',
          label: 'Virtual Amp',
          gainDb: 0,
          pan: 0,
          muted: false,
          solo: false,
          effects: [
            {
              ...baseEffect,
              label: ' ',
              parameters: {
                amount: 5,
              },
            },
          ],
        },
      ],
    };

    const normalized = normalizeMixerSession(session);
    expect(normalized.channels[0].effects?.[0]).toMatchObject({
      id: 'fx-distortion',
      label: 'Distortion',
      bypassed: false,
      parameters: {
        amount: 1,
      },
    });
  });

  it('normalizes compressor effect values within supported limits', () => {
    const compressor = createDefaultMixerEffect('compressor', 'fx-compressor');
    const session: MixerSession = {
      channels: [
        {
          id: 'virtual-amp',
          type: 'internal',
          label: 'Virtual Amp',
          gainDb: 0,
          pan: 0,
          muted: false,
          solo: false,
          effects: [
            {
              ...compressor,
              parameters: {
                thresholdDb: -200,
                ratio: 100,
              },
            },
          ],
        },
      ],
    };

    const normalized = normalizeMixerSession(session);
    expect(normalized.channels[0].effects?.[0].parameters).toMatchObject({
      thresholdDb: -90,
      ratio: 20,
    });
  });

  it('defaults effectsEnabled and clamps effect mix', () => {
    const highpass = createDefaultMixerEffect('highpass', 'fx-hp');
    const session: MixerSession = {
      channels: [
        {
          id: 'virtual-amp',
          type: 'internal',
          label: 'Virtual Amp',
          gainDb: 0,
          pan: 0,
          muted: false,
          solo: false,
          effects: [
            {
              ...highpass,
              mix: 10,
            },
          ],
        },
      ],
    };

    const normalized = normalizeMixerSession(session);
    expect(normalized.channels[0].effectsEnabled).toBe(true);
    expect(normalized.channels[0].effects?.[0].mix).toBe(1);
  });
});
