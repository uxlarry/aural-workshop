import {
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

    expect(duplicateIssues.some((issue) => issue.code === 'duplicate-channel-id')).toBe(true);
  });
});
