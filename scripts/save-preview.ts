// Saves /digest/<night> as one self-contained HTML file (ADR 0001, plan.md § 3).
//   pnpm preview [night] [output-path]
// The banner shows LANE_MARKER from the environment (`.env` is loaded by tsx, as in `pnpm start`).
// Unset or empty marker: the banner reads "no marker set" (plan.md § 4).
// The marker value is never printed. A preview is only written to a gitignored path or to a
// path outside the repo, never into tracked files (ADR 0003).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { lane } from '../src/lane.js';

function fail(message: string): never {
  console.error(`preview: ${message}`);
  process.exit(1);
}

const night = process.argv[2] ?? '2026-10-28';
if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) fail(`night must look like 2026-10-28, got "${night}"`);
const out = resolve(process.argv[3] ?? `var/preview/digest-${night}.html`);

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const rel = relative(repo, out);
const insideRepo = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
if (insideRepo) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', rel], { cwd: repo, stdio: 'ignore' });
  } catch {
    fail(`${rel} is not gitignored; previews never go into tracked paths (ADR 0003)`);
  }
}

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) fail(`GET /digest/${night} returned ${res.status}, expected 200`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved ${out} (lane ${lane().id}, marker ${lane().marker ? 'set' : 'not set'})`);
