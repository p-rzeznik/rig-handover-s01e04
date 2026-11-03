// Plan morning-digest § 1. The contract every part of the digest builds against.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  // null when the log has no owner; views show it as "—".
  owner: string | null;
  // Log lines for this job.
  runs: number;
  // Log lines for this job with status "retry".
  retries: number;
  lastStatus: RunStatus;
  // Error of the last line that has one; null when no line of this job has one.
  lastError: string | null;
  // `at` of the first and last line, with the offset kept as in the log.
  firstAt: string;
  lastAt: string;
};

export type Night = {
  // Sorted by job.
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Signature of `readNight`, implemented in src/digest/reader.ts. Reads runs/<night>.jsonl. Returns null when the file does not exist (the route answers 404);
// an empty file gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
