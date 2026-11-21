// The block check.mjs prints for each script-based check: PASS, FAIL (gated) or REVIEW (you decide).

/** Accepted entries that cover nothing now. */
export function printStale(result) {
  for (const e of result.stale ?? []) console.log(`STALE  accepted entry matches nothing now: ${e.check} in ${e.file} (remove it from review.accepted.json)`);
}

/** How much the area read, so a check that looked at nothing cannot pass unseen. */
const readLine = (result) => {
  const parts = [['files', 'files'], ['agents', 'agents'], ['skills', 'skills'], ['tests', 'test files']].filter(([k]) => typeof result[k] === 'number').map(([k, label]) => `${result[k]} ${label}`);
  return parts.length ? `Read ${parts.join(', ')}.` : '';
};

export function printSection(title, checks, result, fail, hint) {
  console.log(`\n== ${title} ==`);
  const read = readLine(result);
  if (read) console.log(read);
  for (const check of checks) {
    const rows = result.findings.filter((f) => f.check === check);
    const gated = result.gate.includes(check);
    const accepted = (result.accepted ?? []).filter((f) => f.check === check).length;
    console.log(`${rows.length ? (gated ? 'FAIL' : 'REVIEW') : 'PASS'}  ${check}${rows.length ? ` (${rows.length})` : ''}${accepted ? ` (${accepted} accepted)` : ''}`);
    if (gated) for (const f of rows) fail(`${title.toLowerCase()}:${check}`, `${f.where}  ${f.what}`);
  }
  for (const note of result.notes ?? []) console.log(`NOTE  ${note}`);
  printStale(result);
  if (result.findings.some((f) => !f.gate)) console.log(hint);
}
