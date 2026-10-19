#!/usr/bin/env node
/**
 * The publish half of the changesets release, behind a guard.
 *
 * `changesets/action` runs its `publish` input as an executable command, not
 * through a shell: it splits the string into argv and spawns the first word
 * (`@actions/exec`). A shell `if` therefore cannot live in the workflow file —
 * the action would try to execute a program called `if`. This script is the
 * guard in a language the runner can execute: it publishes only when an npm
 * token is configured, says so when it is not, and exits 0 either way, so a
 * missing secret keeps the version PR flowing instead of failing the branch.
 *
 * The token is read from `NODE_AUTH_TOKEN` first — the variable `setup-node`
 * writes into `.npmrc`, and the only one `changeset publish` sees — and from
 * `NPM_TOKEN` after it, so a repository may use either name. The workflow feeds
 * both from the same secret.
 */
import { spawn } from 'node:child_process';

const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN;

if (!token) {
  console.log('NPM_TOKEN is not set: nothing was published');
  process.exit(0);
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(pnpm, ['run', 'release'], { stdio: 'inherit', env: process.env });

child.on('error', (error) => {
  console.error(`Could not start "${pnpm} run release": ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    // The action sees a killed process; mirror the signal instead of claiming
    // success. `process.exit` would report 0 otherwise.
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
