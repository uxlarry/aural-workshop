export type AppDirectoryEntry = {
  title: string;
  description: string;
  route: string;
  logoSrc: string;
  logoAlt: string;
};

export const APP_DIRECTORY: AppDirectoryEntry[] = [
  {
    title: 'Chimes',
    description: 'Interactive harmonic chime patterns and tonal exploration.',
    route: '/apps/chimes/',
    logoSrc: 'assets/app-logos/chimes-logomark.png',
    logoAlt: 'Chimes logo',
  },
  {
    title: 'Loop',
    description: 'Browser-based live audio mixer and loop environment.',
    route: '/apps/loop/',
    logoSrc: 'assets/app-logos/loop.svg',
    logoAlt: 'Loop logo',
  },
];
