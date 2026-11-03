import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function mark(row: DigestRow): string | null {
  const marks: string[] = [];
  if (row.retries >= 3) marks.push('⚠ retries');
  if (row.lastStatus === 'fail') marks.push('⚠ fail');
  return marks.length > 0 ? marks.join(' ') : null;
}

export function DigestPage({ night, digest }: { night: string; digest: Night }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          ⚠ {digest.badLines} {digest.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const flag = mark(row);
              return (
                <tr class={flag ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{flag ? `${row.lastStatus} ${flag}` : row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoDigest({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no digest for {night}</p>
    </>
  );
}
