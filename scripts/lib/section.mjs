// The block check.mjs prints for each script-based check: PASS, FAIL (gated) or REVIEW (you decide).
export function printSection(title, checks, result, fail, hint) {
  console.log(`\n== ${title} ==`);
  for (const check of checks) {
    const rows = result.findings.filter((f) => f.check === check);
    const gated = result.gate.includes(check);
    console.log(`${rows.length ? (gated ? 'FAIL' : 'REVIEW') : 'PASS'}  ${check}${rows.length ? ` (${rows.length})` : ''}`);
    if (gated) for (const f of rows) fail(`${title.toLowerCase()}:${check}`, `${f.where}  ${f.what}`);
  }
  if (result.findings.some((f) => !f.gate)) console.log(hint);
}
