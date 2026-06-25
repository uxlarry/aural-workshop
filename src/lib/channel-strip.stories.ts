import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { ChannelStrip } from './channel-strip';

const meta: Meta<ChannelStrip> = {
  component: ChannelStrip,
  title: 'Audio UI/Channel Strip',
  args: {
    channel: {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: -3,
      pan: 0,
      muted: false,
      solo: false,
      effectsEnabled: true,
      meter: {
        peakDb: -9,
        clipping: false,
      },
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
    parameterChange: fn(),
    effectSelected: fn(),
  },
};

export default meta;
type Story = StoryObj<ChannelStrip>;

export const Internal: Story = {};

export const Input: Story = {
  args: {
    channel: {
      id: 'input',
      type: 'input',
      label: 'Input',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
      meter: {
        peakDb: -14,
        clipping: false,
      },
      effects: [],
    },
  },
};

export const InternalNoEffects: Story = {
  args: {
    channel: {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: -6,
      pan: 0.2,
      muted: false,
      solo: false,
      effectsEnabled: true,
      meter: {
        peakDb: -18,
        clipping: false,
      },
      effects: [],
    },
  },
};

export const Clipping: Story = {
  args: {
    channel: {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: 8,
      pan: -0.35,
      muted: false,
      solo: false,
      effectsEnabled: true,
      meter: {
        peakDb: 0,
        clipping: true,
      },
      effects: [
        {
          id: 'fx-1',
          type: 'distortion',
          label: 'Distortion',
          bypassed: false,
          mix: 0.8,
          parameters: {
            amount: 0.7,
          },
        },
      ],
    },
  },
};

export const Muted: Story = {
  args: {
    channel: {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: -10,
      pan: 0,
      muted: true,
      solo: false,
      effectsEnabled: false,
      meter: {
        peakDb: -100,
        clipping: false,
      },
      effects: [
        {
          id: 'fx-1',
          type: 'compressor',
          label: 'Compressor',
          bypassed: true,
          mix: 0.5,
          parameters: {
            thresholdDb: -20,
            ratio: 3,
          },
        },
      ],
    },
  },
};
