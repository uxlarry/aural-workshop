import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/chimes/chimes').then((m) => m.Chimes),
    title: 'Chimes',
  },
];
