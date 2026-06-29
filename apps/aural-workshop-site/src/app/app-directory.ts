export type AppDirectoryEntry = {
  title: string;
  description: string;
  route: string;
};

export const APP_DIRECTORY: AppDirectoryEntry[] = [
  {
    title: 'Chimes',
    description: 'Interactive harmonic chime patterns and tonal exploration.',
    route: '/apps/chimes/',
  },
  {
    title: 'Loop',
    description: 'Browser-based live audio mixer and loop environment.',
    route: '/apps/loop/',
  },
];
