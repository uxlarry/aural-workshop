import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(scriptPath, '../../..');
const deployRoot = resolve(workspaceRoot, 'dist/deploy');
const defaultPort = 4300;

const parseCliPort = () => {
  const portArg = process.argv.find((arg) => arg.startsWith('--port='));

  if (!portArg) {
    return undefined;
  }

  const value = portArg.split('=')[1];
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const cliPort = parseCliPort();
const envPort = Number.parseInt(process.env.PORT ?? '', 10);
const port = cliPort ?? (Number.isNaN(envPort) ? defaultPort : envPort);

if (!existsSync(deployRoot)) {
  console.error(
    `Missing ${deployRoot}. Run \"nx run aural-workshop-site:package-suite\" first.`,
  );
  process.exit(1);
}

const app = express();

app.use(express.static(deployRoot, { index: false }));

app.get(/^\/apps\/chimes(?:\/.*)?$/, (_req, res) => {
  res.sendFile(resolve(deployRoot, 'apps/chimes/index.html'));
});

app.get(/^\/apps\/loop(?:\/.*)?$/, (_req, res) => {
  res.sendFile(resolve(deployRoot, 'apps/loop/index.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(resolve(deployRoot, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Suite server running on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the existing process or use a different port, e.g. PORT=4301 nx run aural-workshop-site:serve-suite or nx run aural-workshop-site:serve-suite -- --port=4301`,
    );
    process.exit(1);
  }

  console.error('Failed to start suite server:', error);
  process.exit(1);
});
