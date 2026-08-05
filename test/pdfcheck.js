// Geometric validation of the generated PDF: are the drawing coordinates
// inside the page, and is the plan the right way up?
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
const txt = buf.toString('latin1');

const pages = [...txt.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [+m[1], +m[2]]);
const streams = [...txt.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(m => m[1]);

console.log(`${pages.length} pages, ${streams.length} content streams`);

streams.forEach((s, i) => {
  const [pw, ph] = pages[i] || pages[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let pts = 0, outside = 0;
  const note = [];

  const eat = (x, y) => {
    pts++;
    if(!isFinite(x) || !isFinite(y)){ note.push(`non-finite ${x},${y}`); return; }
    minX = Math.min(minX,x); maxX = Math.max(maxX,x);
    minY = Math.min(minY,y); maxY = Math.max(maxY,y);
    // A small tolerance: line widths legitimately straddle the edge.
    if(x < -2 || y < -2 || x > pw+2 || y > ph+2) outside++;
  };

  let skippedBg = false;
  for(const line of s.split('\n')){
    let m;
    // The first rect is the full-page white background; it would swamp the box.
    if(!skippedBg && /^0 0 [\d.]+ [\d.]+ re$/.test(line)){ skippedBg = true; continue; }
    if((m = /^([-\d.]+) ([-\d.]+) (m|l)$/.exec(line))) eat(+m[1], +m[2]);
    else if((m = /^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re$/.exec(line))){
      eat(+m[1], +m[2]);
      eat(+m[1] + +m[3], +m[2] + +m[4]);
    }
    else if((m = /^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) c$/.exec(line))){
      eat(+m[1], +m[2]); eat(+m[3], +m[4]); eat(+m[5], +m[6]);
    }
    else if((m = /^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) Tm$/.exec(line))){
      eat(+m[5], +m[6]);
    }
    else if(/^[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ (rg|RG)$/.test(line)) note.push('bad colour arity');
  }

  console.log(`\nPage ${i+1}  (${pw} x ${ph} pt)`);
  console.log(`  ${pts} coordinates, ${outside} outside the page`);
  console.log(`  content box: x ${minX.toFixed(1)}..${maxX.toFixed(1)}, y ${minY.toFixed(1)}..${maxY.toFixed(1)}`);
  console.log(`  margins: left ${minX.toFixed(1)}, right ${(pw-maxX).toFixed(1)}, bottom ${minY.toFixed(1)}, top ${(ph-maxY).toFixed(1)}`);
  if(note.length) console.log('  notes: ' + note.slice(0,3).join('; '));
  console.log(`  ${outside === 0 ? 'OK — all drawing is on the page' : 'PROBLEM — ' + outside + ' points off-page'}`);
});

// Sanity check the plan's orientation: the room width label should sit near the
// top of page 1 and the depth label rotated at the left.
const s1 = streams[0];
const texts = [...s1.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) Tm\n(?:[-\d.]+ [-\d.]+ Td\n)?\((.*?)\) Tj/g)]
  .map(m => ({a:+m[1], b:+m[2], x:+m[5], y:+m[6], s:m[7]}));
const rotated = texts.filter(t => Math.abs(t.b) > 0.5);
console.log(`\nPage 1 text: ${texts.length} strings, ${rotated.length} rotated`);
console.log('  samples: ' + texts.slice(0,6).map(t => `"${t.s}"@${t.x.toFixed(0)},${t.y.toFixed(0)}`).join(' '));
const titleY = texts.find(t => /plan|Scale|Room/i.test(t.s));
console.log('  rotated samples: ' + rotated.slice(0,4).map(t => `"${t.s}"`).join(' '));
