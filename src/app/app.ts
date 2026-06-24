import { Component } from '@angular/core';
import { AudioAppShell } from '@org/audio-app-shell';

@Component({
  imports: [AudioAppShell],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = 'bbloop';
}
