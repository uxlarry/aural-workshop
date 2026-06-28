import { Injectable } from '@angular/core';
import * as Tone from 'tone';

@Injectable({
  providedIn: 'root',
})
export class ChimesService {
  private synth: Tone.PolySynth<Tone.FMSynth> | null = null;

  private getSynth(): Tone.PolySynth<Tone.FMSynth> {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 8,
        modulationIndex: 2,
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 1.5,
          sustain: 0.01,
          release: 2,
        },
        modulation: { type: 'square' },
        modulationEnvelope: {
          attack: 0.002,
          decay: 0.2,
          sustain: 0,
          release: 0.2,
        },
      }).toDestination();
    }
    return this.synth;
  }

  async playNote(note: string): Promise<void> {
    await Tone.start();
    this.getSynth().triggerAttackRelease(note, '0.1');
  }
}
