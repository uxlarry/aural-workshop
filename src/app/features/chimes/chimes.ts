import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ChimesService } from './chimes.service';

const CHROMATIC_SHARPS = [
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
] as const;

const CHROMATIC_FLATS = [
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
] as const;

const NOTE_COUNT = CHROMATIC_SHARPS.length;

const CHIME_PRESETS = [5, 7, 9, 11] as const;
type ChimePreset = (typeof CHIME_PRESETS)[number];

const PRESET_IMAGES: Record<ChimePreset, string> = {
  5: 'https://www.figma.com/api/mcp/asset/8ceb679f-e366-4f23-9282-c4219e9dfcc8',
  7: 'https://www.figma.com/api/mcp/asset/76580773-a28c-4938-b72f-36766abbf18f',
  9: 'https://www.figma.com/api/mcp/asset/29c93cb3-2735-4891-8631-ff0695916a3f',
  11: 'https://www.figma.com/api/mcp/asset/ac471b75-0b8a-4ffe-b561-fb65b7b0a687',
};

const LOGOMARK =
  'https://www.figma.com/api/mcp/asset/dd36351c-82cd-404f-976b-b96910de2846';

@Component({
  imports: [],
  selector: 'app-chimes',
  templateUrl: './chimes.html',
  styleUrl: './chimes.scss',
})
export class Chimes implements OnDestroy {
  private readonly chimesService = inject(ChimesService);

  readonly presets = CHIME_PRESETS;
  readonly presetImages = PRESET_IMAGES;
  readonly logomark = LOGOMARK;

  readonly chimeCount = signal<ChimePreset>(5);
  readonly speed = signal<number>(50);
  readonly isPlaying = signal<boolean>(false);
  readonly useFlats = signal<boolean>(false);
  readonly pitchIndices = signal<number[]>(Array(11).fill(4));
  readonly activeChimes = signal<Set<number>>(new Set());

  readonly chimes = computed(() => {
    const count = this.chimeCount();
    const indices = this.pitchIndices();
    const noteSet = this.useFlats() ? CHROMATIC_FLATS : CHROMATIC_SHARPS;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      note: noteSet[indices[i] ?? 4],
      pitchIndex: indices[i] ?? 4,
    }));
  });

  readonly noteCount = NOTE_COUNT;

  private playbackTimeout: ReturnType<typeof setTimeout> | null = null;

  selectPreset(count: ChimePreset): void {
    this.chimeCount.set(count);
    if (this.isPlaying()) {
      this.stopPlayback();
      this.startPlayback();
    }
  }

  updatePitch(index: number, value: number): void {
    this.pitchIndices.update((indices) => {
      const updated = [...indices];
      updated[index] = value;
      return updated;
    });
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
