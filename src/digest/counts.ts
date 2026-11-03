import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './reader.js';
import type { RunStatus } from './types.js';

// Log lines per status in one night. Plan morning-digest § 2c.
export type StatusCounts = Record<RunStatus, number>;

// Counts lines, not jobs (rows only keep the last status). Lines that do not parse are skipped.
// Returns null when the night cannot be read, so the board shows "—".
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line !== null) counts[line.status] += 1;
  }
  return counts;
}
