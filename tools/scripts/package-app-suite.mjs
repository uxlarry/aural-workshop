import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const deployRoot = resolve(workspaceRoot, 'dist/deploy');
const nxCli = resolve(workspaceRoot, 'node_modules/nx/dist/bin/nx.js');
const nodeBin = '/usr/local/bin/node';

const builds = [
  'aural-workshop-site:build:development',
  'chimes:build:development',
  'loop:build:development',
];

const runBuild = (target) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync(nodeBin, [nxCli, 'run', target], {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
      },
    });

    if (result.status === 0) {
      return;
    }

    if (attempt < maxAttempts) {
      console.warn(`Retrying ${target} (${attempt + 1}/${maxAttempts})...`);
      continue;
    }

    process.exit(result.status ?? 1);
  }
};

for (const target of builds) {
  runBuild(target);
}

const copyPlan = [
  {
    from: resolve(workspaceRoot, 'dist/apps/aural-workshop-site/browser'),
    to: resolve(deployRoot),
  },
  {
    from: resolve(workspaceRoot, 'dist/apps/chimes/browser'),
    to: resolve(deployRoot, 'apps/chimes'),
  },
  {
    from: resolve(workspaceRoot, 'dist/apps/loop/browser'),
    to: resolve(deployRoot, 'apps/loop'),
  },
];

rmSync(deployRoot, { recursive: true, force: true });
mkdirSync(deployRoot, { recursive: true });

for (const { from, to } of copyPlan) {
  if (!existsSync(from)) {
    throw new Error(
      `Missing build output: ${from}. Run build for all apps before packaging.`
    );
  }

  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}

console.log(`Packaged app suite at ${deployRoot}`);
