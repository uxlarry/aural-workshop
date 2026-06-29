import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { APP_DIRECTORY } from './app-directory';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly appDirectory = APP_DIRECTORY;
  readonly currentYear = new Date().getFullYear();

  private readonly suitePort = '4300';

  appHref(route: string): string {
    if (typeof window === 'undefined') {
      return route;
    }

    // During `nx serve aural-workshop-site` route app links to the suite host.
    if (window.location.port === '4200') {
      return `${window.location.protocol}//${window.location.hostname}:${this.suitePort}${route}`;
    }

    return route;
  }
}
