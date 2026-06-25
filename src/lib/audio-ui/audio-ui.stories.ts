import type { Meta, StoryObj } from '@storybook/angular';
import { AudioUi } from './audio-ui';
import { fn } from 'storybook/test';

const meta: Meta<AudioUi> = {
  component: AudioUi,
  title: 'Audio UI/Mixer',
  args: {
    channels: [
      {
        id: 'input',
        type: 'input',
        label: 'Input',
        gainDb: 0,
        pan: -0.2,
        muted: false,
        solo: false,
        meter: {
          peakDb: -12,
          clipping: false,
        },
        effects: [],
      },
      {
        id: 'virtual-amp',
        type: 'internal',
        label: 'Virtual Amp',
        gainDb: -2,
        pan: 0,
        muted: false,
        solo: true,
        meter: {
          peakDb: -6,
          clipping: false,
        },
        effectsEnabled: true,
        effects: [
          {
            id: 'fx-1',
            type: 'highpass',
            label: 'High-Pass',
            bypassed: false,
            mix: 1,
            parameters: {
              frequencyHz: 120,
              q: 0.707,
            },
          },
          {
            id: 'fx-2',
            type: 'compressor',
            label: 'Compressor',
            bypassed: false,
            mix: 0.7,
            parameters: {
              thresholdDb: -24,
              ratio: 4,
            },
          },
        ],
      },
      {
        id: 'output',
        type: 'output',
        label: 'Output',
        gainDb: 0,
        pan: 0.15,
        muted: false,
        solo: false,
        meter: {
          peakDb: -8,
          clipping: false,
        },
        effects: [],
      },
    ],
    parameterChange: fn(),
    effectSelected: fn(),
  },
};
export default meta;

type Story = StoryObj<AudioUi>;

export const Primary: Story = {};
