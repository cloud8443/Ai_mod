#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npm', ['run', 'build:electron']);
run('node', ['--test', 'tests/**/*.test.js']);
