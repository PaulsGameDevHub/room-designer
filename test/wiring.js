// Checks the HTML and the script agree: inline handlers resolve to real
// functions, and every id the script looks up actually exists in the markup.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = /<script>([\s\S]*)<\/script>/.exec(html)[1];
const markup = html.slice(0, html.indexOf('<script>'));

let fails = 0;
const report = (ok, msg) => { if(!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

// ── ids declared in the markup ─────────────────────────────────────────────
const declared = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
console.log(`${declared.size} ids declared in markup\n`);

// ── ids the script looks up ────────────────────────────────────────────────
const looked = new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
const literalGet = [...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
literalGet.forEach(i => looked.add(i));

const missing = [...looked].filter(i => !declared.has(i));
report(missing.length === 0, missing.length
  ? `script looks up ids that do not exist: ${missing.join(', ')}`
  : `all ${looked.size} ids the script uses exist in the markup`);

const unused = [...declared].filter(i => !looked.has(i) && !new RegExp(`\\b${i}\\b`).test(js));
console.log(`      (${unused.length} declared ids never referenced by the script: ${unused.join(', ') || 'none'})`);

// ── inline handlers must resolve on the GLOBAL object ──────────────────────
// In a classic script, top-level `function` declarations become properties of
// window, but `const`/`let` bindings live in script scope and are invisible to
// inline handlers. Anything an inline handler touches must therefore be a
// function declaration (or a genuine DOM/global name).
const globalFns = new Set([...js.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
const scopedOnly = new Set();
for(const m of js.matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)) scopedOnly.add(m[1]);
// Multi-declarator lines: let a = 1, b = 2, c = 3;
for(const m of js.matchAll(/^(?:const|let)\s+(.+);$/gm)){
  for(const part of m[1].split(/,(?![^(]*\))/)){
    const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
    if(n) scopedOnly.add(n[1]);
  }
}

const BUILTIN = new Set(['this','document','window','console','Math','JSON','getElementById','click',
  'value','alert','parseInt','parseFloat','String','Number','Boolean','Array','Object']);

const handlers = [...markup.matchAll(/\bon[a-z]+="([^"]+)"/g)].map(m => m[1]);
const touched = new Set();
for(const h of handlers){
  for(const m of h.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) touched.add(m[1]);
  // Bare assignments such as foo=this.value also need a reachable binding.
  for(const m of h.matchAll(/(?:^|;)\s*([A-Za-z_$][\w$]*)\s*=[^=]/g)) touched.add(m[1]);
}
const unreachable = [...touched].filter(c => !globalFns.has(c) && !BUILTIN.has(c));
const shadowed = unreachable.filter(c => scopedOnly.has(c));
report(unreachable.length === 0, unreachable.length
  ? `inline handlers reference names not reachable from global scope: ${unreachable.join(', ')}`
    + (shadowed.length ? `  (declared with const/let, so script-scoped only: ${shadowed.join(', ')})` : '')
  : `all ${touched.size} names used by inline handlers are reachable from global scope`);
console.log('      handlers reference: ' + [...touched].sort().join(', '));

// ── the sentinels used while assembling the file must all be gone ──────────
const leftover = [...js.matchAll(/__PART_[A-Z_]+__/g)].map(m => m[0]);
report(leftover.length === 0, leftover.length ? `unfilled section markers: ${leftover.join(', ')}` : 'no leftover section markers');

// ── tag balance ────────────────────────────────────────────────────────────
for(const tag of ['div','select','table','tr','td','th','tbody','thead','style','script','head','body','html']){
  const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  if(open !== close) report(false, `<${tag}> unbalanced: ${open} open, ${close} close`);
}
report(true, 'block tags balanced');

// ── functions defined but never referenced anywhere ────────────────────────
const dead = [...globalFns, ...scopedOnly].filter(n => {
  if(!/^[a-z]/.test(n)) return false;
  const uses = (js.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length;
  const inMarkup = new RegExp(`\\b${n}\\b`).test(markup);
  return uses <= 1 && !inMarkup;
});
console.log(`\n${dead.length} functions/consts defined but never used: ${dead.join(', ') || 'none'}`);

// ── duplicate top-level function declarations (the old gapDims trap) ───────
const seen = new Map();
for(const m of js.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)){
  seen.set(m[1], (seen.get(m[1]) || 0) + 1);
}
const dupes = [...seen].filter(([,n]) => n > 1);
report(dupes.length === 0, dupes.length
  ? `functions declared more than once: ${dupes.map(([n,c]) => n+' x'+c).join(', ')}`
  : 'no function is declared twice');

console.log(`\n${fails === 0 ? 'ALL WIRING CHECKS PASSED' : fails + ' WIRING FAILURES'}`);
process.exit(fails ? 1 : 0);
