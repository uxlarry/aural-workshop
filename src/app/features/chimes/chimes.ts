import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChimesService } from './chimes.service';

@Component({
  imports: [RouterModule],
  selector: 'app-chimes',
  templateUrl: './chimes.html',
  styleUrl: './chimes.scss',
})
export class Chimes {
  private readonly chimesService = inject(ChimesService);

  playNote(note: string): Promise<void> {
    return this.chimesService.playNote(note);
  }
}
