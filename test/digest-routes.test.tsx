import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixtures are written to a temp runs dir. runs/ is read-only and never touched here.
const NIGHTS = {
  normal: '2026-11-01',
  missing: '2026-11-02',
  empty: '2026-11-03',
  badLine: '2026-11-04',
  order: '2026-11-05',
};

const jsonl = (...rows: object[]) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

let runsDir: string;
let app: ReturnType<typeof createApp>;

// Job names in the page's table, in the order the page shows them.
function jobsInPage(html: string): string[] {
  const body = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
  return [...body.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(
    join(runsDir, `${NIGHTS.normal}.jsonl`),
    jsonl(
      { at: '2026-11-01T23:00:02+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' },
      { at: '2026-11-01T23:10:00+01:00', job: 'notes/backup', status: 'retry', owner: 'rook', error: 'quota' },
      { at: '2026-11-01T23:20:00+01:00', job: 'notes/backup', status: 'fail', owner: 'rook', error: 'quota exceeded' },
    ),
  );
  writeFileSync(join(runsDir, `${NIGHTS.empty}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${NIGHTS.badLine}.jsonl`),
    jsonl({ at: '2026-11-04T23:00:02+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }) +
      '{"at":"2026-11-04T23:0\n',
  );
  writeFileSync(
    join(runsDir, `${NIGHTS.order}.jsonl`),
    jsonl(
      { at: '2026-11-05T01:00:00+01:00', job: 'zeta/run', status: 'ok', owner: 'rook' },
      { at: '2026-11-05T01:05:00+01:00', job: 'alpha/job', status: 'ok', owner: null },
      { at: '2026-11-05T01:10:00+01:00', job: 'mid/job', status: 'retry', owner: 'lane-07' },
      { at: '2026-11-05T01:15:00+01:00', job: 'lane/sync', status: 'fail', owner: 'rook', error: 'timeout' },
      { at: '2026-11-05T01:20:00+01:00', job: 'alpha/job', status: 'ok', owner: null },
    ),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest routes', () => {
  describe('normal night', () => {
    it('answers 200 on the page and the JSON', async () => {
      expect((await app.request(`/digest/${NIGHTS.normal}`)).status).toBe(200);
      expect((await app.request(`/api/digest/${NIGHTS.normal}`)).status).toBe(200);
    });

    it('gives the rows and counts in the JSON', async () => {
      const res = await app.request(`/api/digest/${NIGHTS.normal}`);
      const body = await res.json();
      expect(body.night).toBe(NIGHTS.normal);
      expect(body.badLines).toBe(0);
      expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['lane/sync', 'notes/backup']);
      expect(body.rows[1]).toMatchObject({
        owner: 'rook',
        runs: 2,
        retries: 1,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
      });
    });

    it('shows the jobs on the page', async () => {
      const html = await (await app.request(`/digest/${NIGHTS.normal}`)).text();
      expect(html).toContain('digest · 2026-11-01');
      expect(jobsInPage(html)).toEqual(['lane/sync', 'notes/backup']);
    });
  });

  describe('night with no file', () => {
    it('answers 404 on the page', async () => {
      const res = await app.request(`/digest/${NIGHTS.missing}`);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain(`no digest for ${NIGHTS.missing}`);
    });

    it('answers 404 on the JSON', async () => {
      const res = await app.request(`/api/digest/${NIGHTS.missing}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: `no digest for ${NIGHTS.missing}` });
    });
  });

  describe('empty night', () => {
    it('renders "nothing ran" on the page', async () => {
      const res = await app.request(`/digest/${NIGHTS.empty}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('nothing ran');
      expect(jobsInPage(html)).toEqual([]);
    });

    it('gives no rows in the JSON', async () => {
      const res = await app.request(`/api/digest/${NIGHTS.empty}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ night: NIGHTS.empty, rows: [], badLines: 0 });
    });
  });

  describe('night with a bad line', () => {
    it('counts the bad line in the JSON and keeps the good rows', async () => {
      const res = await app.request(`/api/digest/${NIGHTS.badLine}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.badLines).toBe(1);
      expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['lane/sync']);
    });

    it('mentions the bad line on the page and still lists the rows', async () => {
      const res = await app.request(`/digest/${NIGHTS.badLine}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('1 line could not be read');
      expect(jobsInPage(html)).toEqual(['lane/sync']);
    });
  });

  describe('page and JSON agree', () => {
    it('list the same jobs in the same order for a night with several jobs', async () => {
      const html = await (await app.request(`/digest/${NIGHTS.order}`)).text();
      const body = await (await app.request(`/api/digest/${NIGHTS.order}`)).json();
      const pageJobs = jobsInPage(html);
      const jsonJobs = body.rows.map((r: { job: string }) => r.job);
      expect(pageJobs).toEqual(['alpha/job', 'lane/sync', 'mid/job', 'zeta/run']);
      expect(pageJobs).toEqual(jsonJobs);
    });
  });
});
