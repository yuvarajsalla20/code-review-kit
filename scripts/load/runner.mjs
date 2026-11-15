// Runs inside the Firestore emulator (started by firestore-load.mjs). Reads the plan from plan.json next to it and prints one JSON line per test.
// Uses the same write pattern most local-first apps use: a transaction that reads the stored copy and writes only when its own copy is newer.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, setDoc, setLogLevel, writeBatch } from 'firebase/firestore';

setLogLevel('silent');
const plan = JSON.parse(readFileSync(new URL('./plan.json', import.meta.url), 'utf8'));
const env = await initializeTestEnvironment({ projectId: plan.projectId, firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: plan.port } });
const say = (kind, name, ok, detail = '') => console.log(JSON.stringify({ kind, name, ok, detail }));
const ownerPath = (uid) => plan.owner.replace('{uid}', uid);
const itemsPath = (uid) => plan.items.replace('{uid}', uid);
const stamp = (offset = 0) => new Date(Date.now() + offset).toISOString();
/** "repeat:x:2001" becomes 2,001 x's, so a config can ask for an oversized field without pasting it. */
const expand = (v) => (typeof v === 'string' && /^repeat:.:\d+$/.test(v) ? v.split(':')[1].repeat(Number(v.split(':')[2])) : Array.isArray(v) ? v.map(expand) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x)])) : v);
const item = (id, patch = {}) => expand({ ...plan.item, ...(plan.idField ? { [plan.idField]: id } : {}), ...(plan.newerField ? { [plan.newerField]: stamp() } : {}), ...patch });
const refused = (p) => p.then(() => false, () => true);
const allowed = (p) => p.then(() => true, () => false);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0; };
const timed = async (fn) => { const t = performance.now(); await fn(); return performance.now() - t; };
const putOwner = (db, uid) => setDoc(doc(db, ownerPath(uid)), expand(plan.profile), { merge: true });
const newest = (db, ref, data) => runTransaction(db, async (tx) => {
  const there = (await tx.get(ref)).data();
  if (plan.newerField && there && there[plan.newerField] >= data[plan.newerField]) return false;
  tx.set(ref, data);
  return true;
});

// 1. Rules
{
  const a = env.authenticatedContext('alice').firestore();
  const b = env.authenticatedContext('bob').firestore();
  const anon = env.unauthenticatedContext().firestore();
  if (plan.ownerRequired) say('rules', 'an item is refused before its owner document exists', await refused(setDoc(doc(a, `${itemsPath('alice')}/i1`), item('i1'))));
  await putOwner(a, 'alice');
  say('rules', 'the owner can write their own item', await allowed(setDoc(doc(a, `${itemsPath('alice')}/i1`), item('i1'))));
  say('rules', 'another user cannot read it', await refused(getDoc(doc(b, `${itemsPath('alice')}/i1`))));
  say('rules', 'another user cannot list the items', await refused(getDocs(collection(b, itemsPath('alice')))));
  say('rules', 'another user cannot write an item there', await refused(setDoc(doc(b, `${itemsPath('alice')}/i2`), item('i2'))));
  say('rules', 'another user cannot read the owner document', await refused(getDoc(doc(b, ownerPath('alice')))));
  say('rules', 'signed out, nothing can be read', await refused(getDoc(doc(anon, `${itemsPath('alice')}/i1`))));
  say('rules', 'an unknown field is refused', await refused(setDoc(doc(a, `${itemsPath('alice')}/i3`), item('i3', { reviewKitUnknownField: 1 }))));
  for (const bad of plan.invalid ?? []) say('rules', `refused: ${bad.label}`, await refused(setDoc(doc(a, `${itemsPath('alice')}/bad`), item('bad', bad.patch))));
  if (plan.ownerRequired) {
    await deleteDoc(doc(a, ownerPath('alice')));
    say('rules', 'after the owner document is erased, a signed-in phone cannot write items', await refused(setDoc(doc(a, `${itemsPath('alice')}/i4`), item('i4'))));
  }
}

// 2. Many users at once
{
  await env.clearFirestore();
  const lat = [];
  let errors = 0;
  const t0 = performance.now();
  await Promise.all(Array.from({ length: plan.users }, async (_, u) => {
    const db = env.authenticatedContext(`u${u}`).firestore();
    try {
      lat.push(await timed(() => putOwner(db, `u${u}`)));
      for (let i = 0; i < plan.perUser; i++) {
        const data = item(`i${i}`);
        lat.push(await timed(() => newest(db, doc(db, `${itemsPath(`u${u}`)}/i${i}`), data)));
      }
    } catch {
      errors++;
    }
  }));
  const secs = (performance.now() - t0) / 1000;
  const writes = plan.users * (plan.perUser + 1);
  say('load', `${plan.users} users saving ${plan.perUser} items each at once`, errors === 0, `${writes} writes in ${secs.toFixed(1)} s (${Math.round(writes / secs)}/s), p50 ${pct(lat, 50).toFixed(0)} ms, p95 ${pct(lat, 95).toFixed(0)} ms, p99 ${pct(lat, 99).toFixed(0)} ms, ${errors} users failed`);
}

// 3. One account on two phones, racing edits
if (plan.newerField) {
  const p1 = env.authenticatedContext('dual').firestore();
  const p2 = env.authenticatedContext('dual').firestore();
  await putOwner(p1, 'dual');
  let fails = 0;
  const N = 100;
  await Promise.all([p1, p2].map((db, k) => Promise.all(Array.from({ length: N }, async (_, i) => {
    const data = item(`s${i % 10}`, { [plan.newerField]: stamp(i), [plan.labelField]: `p${k}-${i}` });
    try { await newest(db, doc(db, `${itemsPath('dual')}/s${i % 10}`), data); } catch { fails++; }
  }))));
  const docs = (await getDocs(collection(p1, itemsPath('dual')))).docs.map((d) => d.data());
  const ok = fails === 0 && docs.length === 10 && docs.every((d) => Number(String(d[plan.labelField]).split('-')[1]) >= N - 10);
  say('load', 'same account on two phones, 200 racing edits to 10 items: the newest edit wins', ok, `${docs.length} items kept, ${fails} failed writes`);
}

// 4. A heavy account: first load on a new phone, then erase while another phone keeps adding
{
  const db = env.authenticatedContext('heavy').firestore();
  const fill = async () => {
    await putOwner(db, 'heavy');
    for (let i = 0; i < plan.heavy; i += 450) {
      const batch = writeBatch(db);
      for (let j = i; j < Math.min(plan.heavy, i + 450); j++) batch.set(doc(db, `${itemsPath('heavy')}/h${j}`), item(`h${j}`));
      await batch.commit();
    }
  };
  await fill();
  const reader = env.authenticatedContext('heavy').firestore();
  let bytes = 0;
  const ms = await timed(() => new Promise((done) => {
    const stop = onSnapshot(collection(reader, itemsPath('heavy')), (snap) => {
      if (snap.metadata.fromCache) return;
      bytes = JSON.stringify(snap.docs.map((d) => d.data())).length;
      stop();
      done();
    });
  }));
  say('load', `an account with ${plan.heavy} items, first load on a new phone`, ms < 10_000, `${ms.toFixed(0)} ms, about ${Math.round(bytes / 1024)} KB, ${plan.heavy} document reads billed`);

  const erase = async (ownerFirst) => {
    await fill();
    const other = env.authenticatedContext('heavy').firestore();
    let adding = true;
    let added = 0;
    let n = 0;
    const adder = (async () => { while (adding) { const k = n++; try { await setDoc(doc(other, `${itemsPath('heavy')}/late${k}`), item(`late${k}`)); added++; } catch { /* refused */ } } })();
    let rounds = 0;
    let error = '';
    try {
      if (ownerFirst) await deleteDoc(doc(db, ownerPath('heavy')));
      for (;; rounds++) {
        const refs = (await getDocs(collection(db, itemsPath('heavy')))).docs.map((d) => d.ref);
        if (!refs.length) break;
        if (rounds === 3) throw new Error('items were still being added after 3 rounds');
        for (let i = 0; i < refs.length; i += 450) {
          const batch = writeBatch(db);
          refs.slice(i, i + 450).forEach((r) => batch.delete(r));
          await batch.commit();
        }
      }
      if (!ownerFirst) await deleteDoc(doc(db, ownerPath('heavy')));
    } catch (e) {
      error = e.message;
    }
    adding = false;
    await adder;
    const left = (await getDocs(collection(db, itemsPath('heavy')))).size;
    say('load', `erase the account (${ownerFirst ? 'owner document first' : 'items first, owner document last'}) while another phone keeps adding`, !error && left === 0, `${rounds} rounds, the other phone added ${added}, ${left} left${error ? `, ${error}` : ''}`);
  };
  // With eraseOrder, only the app's own order is tested. Without it, both, so the report shows which one is safe.
  if (plan.eraseOrder !== 'ownerFirst') await erase(false);
  if (plan.ownerRequired && plan.eraseOrder !== 'itemsFirst') await erase(true);
}
await env.cleanup();
