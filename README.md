# Aural Workshop

Aural Workshop is an Open Source project for music and audio experiments and tools. This Nx monorepo highlights the applications and includes multiple Angular applications and reusable audio-focused packages.

## Workspace Overview

### Applications

- `aural-workshop-site`: Main site app
- `chimes`: Chime-focused app
- `loop`: Loop-focused app

### Packages

- `audio-app-shell`
- `audio-device`
- `audio-engine`
- `audio-model`
- `audio-orchestration`
- `audio-ui`

## Requirements

- Node.js 24+
- npm 11+

## Install

```bash
npm install
```

## Development

Serve an application:

```bash
npm exec nx run aural-workshop-site:serve
npm exec nx run chimes:serve
npm exec nx run loop:serve
```

Default dev URL is usually `http://localhost:4200`.

## Build

Build a specific app:

```bash
npm exec nx run aural-workshop-site:build
npm exec nx run chimes:build
npm exec nx run loop:build
```

Build all projects:

```bash
npm exec nx run-many -t build
```

## Test and Lint

Run tests for projects that define test targets:

```bash
npm exec nx run-many -t test
```

Run Vitest targets where configured:

```bash
npm exec nx run-many -t vite:test
```

Run lint across the workspace:

```bash
npm exec nx run-many -t lint
```

## Packaging and Suite Commands

The `aural-workshop-site` app includes additional orchestration targets:

```bash
npm exec nx run aural-workshop-site:package-suite
npm exec nx run aural-workshop-site:serve-suite
```

## Useful Nx Commands

List projects:

```bash
npm exec nx show projects
```

Run only tasks affected by current changes:

```bash
npm exec nx affected -t build,test,lint
```

## License

This monorepo and all projects in it are licensed under the MIT License. See `LICENSE` for details.
