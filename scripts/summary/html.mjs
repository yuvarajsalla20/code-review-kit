// The summary as one self-contained page: readable on a phone, light and dark, version and date on a gray footer.
import { VERDICT_NOTE, countRows, sections } from './tables.mjs';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const table = ({ head, rows, empty }) => (rows.length ? tableHtml(head, rows) : `<p class="note">${esc(empty)}</p>`);
const tableHtml = (head, rows) => `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(head[i])}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const CSS = `:root{--bg:#f7f6fb;--card:#fff;--text:#1d1a2b;--muted:#5b5870;--line:#e2dfee;--accent:#5b34d6;--ok:#17653b;--okbg:#dcf5e6;--warn:#7a4a00;--warnbg:#fff0cf;--bad:#8a1c1c;--badbg:#fde0e0;--foot:#d9d9de;--foottext:#3b3b44}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#14101f;--card:#1e1830;--text:#f0edfa;--muted:#b3aecb;--line:#352d52;--accent:#b79cff;--ok:#8fe3b5;--okbg:#17382a;--warn:#ffd27a;--warnbg:#3d2f10;--bad:#ffb3b3;--badbg:#431a1a;--foot:#3a3a42;--foottext:#d4d4dc}}
:root[data-theme=dark]{--bg:#14101f;--card:#1e1830;--text:#f0edfa;--muted:#b3aecb;--line:#352d52;--accent:#b79cff;--ok:#8fe3b5;--okbg:#17382a;--warn:#ffd27a;--warnbg:#3d2f10;--bad:#ffb3b3;--badbg:#431a1a;--foot:#3a3a42;--foottext:#d4d4dc}
*{box-sizing:border-box}body{margin:0;background-color:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 40px}h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.2rem;margin:32px 0 10px;color:var(--accent)}h3{font-size:1rem;margin:20px 0 8px}
.meta{color:var(--muted);margin:0 0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.verdict{display:inline-block;font-weight:700;font-size:1.2rem;padding:6px 14px;border-radius:999px}.v-ready{background:var(--okbg);color:var(--ok)}.v-after{background:var(--warnbg);color:var(--warn)}.v-not{background:var(--badbg);color:var(--bad)}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.counts span{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:4px 10px;font-size:.9rem}
.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600;white-space:nowrap}tr:last-child td{border-bottom:0}
.note{color:var(--muted);font-size:.9rem}ul{padding-left:20px}@media (max-width:640px){thead{display:none}tr{display:block;padding:8px 0;border-bottom:1px solid var(--line)}tr:last-child{border-bottom:0}td{display:flex;gap:10px;border-bottom:0;padding:4px 12px}td::before{content:attr(data-label);flex:0 0 92px;color:var(--muted);font-weight:600}td:empty::after{content:'';display:block;height:1.4em;flex:1;border-bottom:1px dashed var(--line)}}
footer{background-color:var(--foot);color:var(--foottext);text-align:center;padding:14px 16px;font-size:.85rem}`;

export function toHtml(m) {
  const s = sections(m);
  const section = (title, body) => `<h2>${esc(title)}</h2>${body}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review summary: ${esc(m.project)}</title><style>${CSS}</style></head><body><main>
<h1>Review summary: ${esc(m.project)}</h1><p class="meta">Kit ${esc(m.kitVersion)} &middot; Checks run: ${esc(m.checked.join(', ') || 'none')}</p><p class="meta">Agent verification: ${esc(m.verification)}</p>
<div class="card"><span class="verdict v-${m.verdictKey}">${esc(m.verdict)}</span> <p>${esc(m.verdictMeaning)}</p><div class="counts">${countRows(m).map(([label, n]) => `<span>${esc(label)}: ${n}</span>`).join('')}</div><p class="note">${esc(VERDICT_NOTE)}</p></div>
${section(s.fixFirst.title, table(s.fixFirst))}
${section(s.decisions.title, `<p class="note">${esc(s.decisions.note)}</p>${table(s.decisions)}`)}
${section('By area', s.areas.map((a) => `<h3>${esc(a.title)}</h3>${table(a)}`).join(''))}
${[s.accepted, s.stale].filter((x) => x.rows.length).map((x) => section(x.title, `<p class="note">${esc(x.note)}</p>${table(x)}`)).join('')}
${section(s.terms.title, table(s.terms))}
${section('What we could not check', `<ul>${m.couldNot.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`)}
</main><footer>${esc(m.footer)}</footer></body></html>`;
}
