import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives one row per job, sorted, and counts the truncated line', () => {
    expect(night).not.toBeNull();
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('keeps a row whose owner is null', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.runs).toBe(1);
  });

  it('counts runs and retries and keeps the last error', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const fail = night?.rows.find((r) => r.job === 'notes/backup');
    expect(fail).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps the offset from the log', () => {
    const row = night?.rows.find((r) => r.job === 'lane/sync');
    expect(row?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(row?.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(row?.runs).toBe(8);
    expect(row?.retries).toBe(1);
  });
});

describe('readNight on a temp runs dir', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts lines of the wrong shape and takes the owner of the last line', () => {
    const lines = [
      '{"at":"2026-01-01T23:00:00-05:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '[1,2]',
      '"text"',
      '{"at":"2026-01-01T23:01:00-05:00","job":"a","status":"done","owner":"x"}',
      '{"job":"a","status":"ok"}',
      '{"at":"2026-01-01T23:02:00-05:00","job":"a","status":"ok","owner":null}',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n') + '\n');
    expect(readNight(dir, '2026-01-01')).toEqual({
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 2,
          retries: 0,
          lastStatus: 'ok',
          lastError: 'boom',
          firstAt: '2026-01-01T23:00:00-05:00',
          lastAt: '2026-01-01T23:02:00-05:00',
        },
      ],
      badLines: 4,
    });
  });
});
