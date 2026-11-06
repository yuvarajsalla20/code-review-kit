// The block check.mjs prints for each script-based check: PASS, FAIL (gated) or REVIEW (you decide).
export function printSection(title, checks, result, fail, hint) {
  console.log(`\n== ${title} ==`);
  for (const check of checks) {
    const rows = result.findings.filter((f) => f.check === check);
    const gated = result.gate.includes(check);
    const accepted = (result.accepted ?? []).filter((f) => f.check === check).length;
    console.log(`${rows.length ? (gated ? 'FAIL' : 'REVIEW') : 'PASS'}  ${check}${rows.length ? ` (${rows.length})` : ''}${accepted ? ` (${accepted} accepted)` : ''}`);
    if (gated) for (const f of rows) fail(`${title.toLowerCase()}:${check}`, `${f.where}  ${f.what}`);
  }
  for (const e of result.stale ?? []) console.log(`STALE  accepted entry matches nothing now: ${e.check} in ${e.file} (remove it from review.accepted.json)`);
  if (result.findings.some((f) => !f.gate)) console.log(hint);
}
