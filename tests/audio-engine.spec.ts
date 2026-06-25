import { createDefaultMixerEffect } from '../../model/src';
import { resolveActiveEffects, resolveChainEffects } from '../src';

describe('audio-engine effects chain planning', () => {
  it('preserves effect order when all effects are active', () => {
    const effects = [
      createDefaultMixerEffect('highpass', 'fx-1'),
      createDefaultMixerEffect('compressor', 'fx-2'),
      createDefaultMixerEffect('distortion', 'fx-3'),
    ];

    const activeEffects = resolveActiveEffects(effects);
    expect(activeEffects.map((effect) => effect.id)).toEqual([
      'fx-1',
      'fx-2',
      'fx-3',
    ]);
  });

  it('excludes bypassed effects while keeping active ordering stable', () => {
    const first = createDefaultMixerEffect('highpass', 'fx-1');
    const bypassed = createDefaultMixerEffect('lowpass', 'fx-2');
    bypassed.bypassed = true;
    const third = createDefaultMixerEffect('compressor', 'fx-3');

    const activeEffects = resolveActiveEffects([first, bypassed, third]);
    expect(activeEffects.map((effect) => effect.id)).toEqual(['fx-1', 'fx-3']);
  });

  it('returns no effects when chain is disabled', () => {
    const effects = [
      createDefaultMixerEffect('highpass', 'fx-1'),
      createDefaultMixerEffect('compressor', 'fx-2'),
    ];

    const resolved = resolveChainEffects(effects, false);
    expect(resolved).toEqual([]);
  });
});
