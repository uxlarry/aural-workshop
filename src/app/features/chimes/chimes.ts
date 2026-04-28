import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ChimesService } from './chimes.service';

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 7;

// C2–B7 chromatic scale (72 notes, indices 0–71)
const CHROMATIC_SHARPS = [
  'C2',
  'C#2',
  'D2',
  'D#2',
  'E2',
  'F2',
  'F#2',
  'G2',
  'G#2',
  'A2',
  'A#2',
  'B2',
  'C3',
  'C#3',
  'D3',
  'D#3',
  'E3',
  'F3',
  'F#3',
  'G3',
  'G#3',
  'A3',
  'A#3',
  'B3',
  'C4',
  'C#4',
  'D4',
  'D#4',
  'E4',
  'F4',
  'F#4',
  'G4',
  'G#4',
  'A4',
  'A#4',
  'B4',
  'C5',
  'C#5',
  'D5',
  'D#5',
  'E5',
  'F5',
  'F#5',
  'G5',
  'G#5',
  'A5',
  'A#5',
  'B5',
  'C6',
  'C#6',
  'D6',
  'D#6',
  'E6',
  'F6',
  'F#6',
  'G6',
  'G#6',
  'A6',
  'A#6',
  'B6',
  'C7',
  'C#7',
  'D7',
  'D#7',
  'E7',
  'F7',
  'F#7',
  'G7',
  'G#7',
  'A7',
  'A#7',
  'B7',
] as const;

const CHROMATIC_FLATS = [
  'C2',
  'Db2',
  'D2',
  'Eb2',
  'E2',
  'F2',
  'Gb2',
  'G2',
  'Ab2',
  'A2',
  'Bb2',
  'B2',
  'C3',
  'Db3',
  'D3',
  'Eb3',
  'E3',
  'F3',
  'Gb3',
  'G3',
  'Ab3',
  'A3',
  'Bb3',
  'B3',
  'C4',
  'Db4',
  'D4',
  'Eb4',
  'E4',
  'F4',
  'Gb4',
  'G4',
  'Ab4',
  'A4',
  'Bb4',
  'B4',
  'C5',
  'Db5',
  'D5',
  'Eb5',
  'E5',
  'F5',
  'Gb5',
  'G5',
  'Ab5',
  'A5',
  'Bb5',
  'B5',
  'C6',
  'Db6',
  'D6',
  'Eb6',
  'E6',
  'F6',
  'Gb6',
  'G6',
  'Ab6',
  'A6',
  'Bb6',
  'B6',
  'C7',
  'Db7',
  'D7',
  'Eb7',
  'E7',
  'F7',
  'Gb7',
  'G7',
  'Ab7',
  'A7',
  'Bb7',
  'B7',
] as const;

interface ChordPreset {
  name: string;
  // Semitone intervals from the root (C of octaveMin). Applied relative to the visible range.
  intervals: readonly number[];
}

const CHORD_PRESETS: ChordPreset[] = [
  { name: 'Maj 7th', intervals: [0, 4, 7, 11, 12, 16, 19, 23, 24, 28, 31] },
  { name: 'Maj 9th', intervals: [0, 2, 4, 7, 11, 12, 14, 16, 19, 23, 24] },
  { name: 'Min 9th', intervals: [0, 3, 7, 10, 14, 12, 15, 19, 22, 26, 27] },
  { name: 'Pentatonic', intervals: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] },
  {
    name: 'Stacked 4ths',
    intervals: [0, 5, 10, 15, 20, 25, 6, 11, 16, 21, 26],
  },
  { name: 'Stacked 5ths', intervals: [0, 7, 14, 21, 4, 11, 18, 25, 8, 15, 22] },
  { name: 'Akebono', intervals: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20, 24] },
  { name: 'Mongolian', intervals: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24] },
  { name: 'Lydian Pent.', intervals: [0, 4, 6, 7, 11, 12, 16, 18, 19, 23, 24] },
];

const CHIME_PRESETS = [5, 6, 7, 8, 9, 10, 11] as const;
type ChimePreset = (typeof CHIME_PRESETS)[number];

@Component({
  imports: [],
  selector: 'app-chimes',
  templateUrl: './chimes.html',
  styleUrl: './chimes.scss',
})
export class Chimes implements OnDestroy {
  private readonly chimesService = inject(ChimesService);

  readonly presets = CHIME_PRESETS;

  readonly chimeCount = signal<ChimePreset>(5);
  readonly speed = signal<number>(50);
  readonly isPlaying = signal<boolean>(false);
  readonly useFlats = signal<boolean>(false);
  readonly octaveMin = signal<number>(4);
  readonly octaveMax = signal<number>(5);
  // Default E4 = index 28 in the full C2–B7 array
  readonly pitchIndices = signal<number[]>(Array(11).fill(28));
  readonly activeChimes = signal<Set<number>>(new Set());

  readonly visibleRange = computed(() => ({
    lo: (this.octaveMin() - MIN_OCTAVE) * 12,
    hi: (this.octaveMax() - MIN_OCTAVE + 1) * 12 - 1,
  }));

  readonly octaveTrackStyle = computed(() => {
    const span = MAX_OCTAVE - MIN_OCTAVE;
    const lo = ((this.octaveMin() - MIN_OCTAVE) / span) * 100;
    const hi = ((this.octaveMax() - MIN_OCTAVE) / span) * 100;
    return `linear-gradient(to right, #e6e0e9 0%, #e6e0e9 ${lo}%, #6750a4 ${lo}%, #6750a4 ${hi}%, #e6e0e9 ${hi}%, #e6e0e9 100%)`;
  });

  private static readonly CHIME_MAX_HEIGHT = 170;
  private static readonly CHIME_MIN_HEIGHT = Math.round(170 * 0.35); // ~60px

  readonly chimes = computed(() => {
    const count = this.chimeCount();
    const indices = this.pitchIndices();
    const noteSet = this.useFlats() ? CHROMATIC_FLATS : CHROMATIC_SHARPS;
    const { lo, hi } = this.visibleRange();
    const range = hi - lo || 1;
    const maxH = Chimes.CHIME_MAX_HEIGHT;
    const minH = Chimes.CHIME_MIN_HEIGHT;
    return Array.from({ length: count }, (_, i) => {
      const pitchIndex = indices[i] ?? lo;
      const t = (pitchIndex - lo) / range; // 0 = deepest, 1 = highest
      const barHeight = Math.round(maxH - t * (maxH - minH));
      return {
        id: i,
        note: noteSet[pitchIndex],
        pitchIndex,
        barHeight,
      };
    });
  });

  readonly minOctave = MIN_OCTAVE;
  readonly maxOctave = MAX_OCTAVE;
  readonly chordPresets = CHORD_PRESETS;
  readonly activeChord = signal<string | null>(null);

  private playbackTimeout: ReturnType<typeof setTimeout> | null = null;

  selectPreset(count: ChimePreset): void {
    this.chimeCount.set(count);
    if (this.isPlaying()) {
      this.stopPlayback();
      this.startPlayback();
    }
  }

  updatePitch(index: number, value: number): void {
    this.activeChord.set(null);
    this.pitchIndices.update((indices) => {
      const updated = [...indices];
      updated[index] = value;
      return updated;
    });
  }

  applyChordPreset(preset: ChordPreset): void {
    const { lo, hi } = this.visibleRange();
    const indices = Array.from({ length: 11 }, (_, i) =>
      Math.min(lo + (preset.intervals[i] ?? 0), hi),
    );
    this.pitchIndices.set(indices);
    this.activeChord.set(preset.name);
  }

  setOctaveMin(value: number): void {
    const clamped = Math.min(Math.max(value, MIN_OCTAVE), this.octaveMax());
    this.octaveMin.set(clamped);
    const lo = (clamped - MIN_OCTAVE) * 12;
    this.pitchIndices.update((indices) => indices.map((i) => Math.max(i, lo)));
  }

  setOctaveMax(value: number): void {
    const clamped = Math.max(Math.min(value, MAX_OCTAVE), this.octaveMin());
    this.octaveMax.set(clamped);
    const hi = (clamped - MIN_OCTAVE + 1) * 12 - 1;
    this.pitchIndices.update((indices) => indices.map((i) => Math.min(i, hi)));
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  playNote(note: string, chimeId?: number): void {
    this.chimesService.playNote(note);
    if (chimeId !== undefined) {
      this.flashChime(chimeId);
    }
  }

  private flashChime(id: number): void {
    this.activeChimes.update((s) => new Set(s).add(id));
    setTimeout(() => {
      this.activeChimes.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 100);
  }

  private startPlayback(): void {
    this.isPlaying.set(true);
    const scheduleNext = () => {
      const chimes = this.chimes();
      const randomChime = chimes[Math.floor(Math.random() * chimes.length)];
      this.chimesService.playNote(randomChime.note);
      this.flashChime(randomChime.id);
      const minMs = 80;
      const maxMs = 2500;
      const speedFactor = this.speed() / 100;
      const delay = maxMs - (maxMs - minMs) * speedFactor + Math.random() * 200;
      this.playbackTimeout = setTimeout(scheduleNext, delay);
    };
    scheduleNext();
  }

  private stopPlayback(): void {
    this.isPlaying.set(false);
    if (this.playbackTimeout !== null) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPlayback();
  }
}
