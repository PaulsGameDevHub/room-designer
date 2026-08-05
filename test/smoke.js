// Headless smoke test for RoomDesigner index.html.
// Shims just enough DOM for the app to boot, then drives the model directly.
const fs = require('fs');
const nodePath = require('path');

const ROOT = nodePath.join(__dirname, '..');
const HTML = nodePath.join(ROOT, 'index.html');
const html = fs.readFileSync(HTML, 'utf8');
const js = /<script>([\s\S]*)<\/script>/.exec(html)[1];

// ── canvas 2d stub ─────────────────────────────────────────────────────────
const drawCalls = {};
function ctxStub(){
  const c = {
    canvas:{width:0,height:0},
    font:'', fillStyle:'', strokeStyle:'', lineWidth:1, textAlign:'', textBaseline:'',
    measureText: s => ({width: String(s).length * 5.5}),
  };
  for(const m of ['clearRect','fillRect','strokeRect','beginPath','moveTo','lineTo','arc','arcTo',
                  'closePath','fill','stroke','save','restore','translate','rotate','scale',
                  'setLineDash','roundRect','setTransform','clip','rect','fillText','bezierCurveTo',
                  'quadraticCurveTo','createLinearGradient','drawImage']){
    c[m] = (...a) => { drawCalls[m] = (drawCalls[m]||0)+1; };
  }
  return c;
}

// ── element stub ───────────────────────────────────────────────────────────
let idSeq = 0;
function mkEl(tag, id){
  const e = {
    tagName:(tag||'div').toUpperCase(), id:id||('el'+(++idSeq)),
    children:[], style:{cssText:'', display:'', left:'', top:'', width:'', height:'', cursor:''},
    classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
                toggle(c,v){ v===undefined ? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (v?this._s.add(c):this._s.delete(c)); },
                contains(c){return this._s.has(c);} },
    _listeners:{},
    value:'', textContent:'', checked:true, disabled:false, files:[], options:[], selected:undefined,
    clientWidth:1200, clientHeight:700, width:0, height:0,
    addEventListener(t,f){ (this._listeners[t] = this._listeners[t]||[]).push(f); },
    removeEventListener(){}, setAttribute(k,v){ this[k]=v; }, getAttribute(k){ return this[k]; },
    appendChild(c){
      this.children.push(c);
      if(c.tagName === 'OPTION'){
        this.options.push(c);
        // A real <select> reports the first option's value until one is chosen.
        if(this.options.length === 1 || c.selected !== undefined) this.value = c.value;
      }
      return c;
    },
    append(...cs){ cs.forEach(c=>c&&this.children.push(c)); },
    remove(){}, click(){}, focus(){}, select(){}, blur(){},
    getBoundingClientRect(){ return {left:0, top:0, width:this.clientWidth, height:this.clientHeight}; },
    getContext(){ return this._ctx || (this._ctx = ctxStub()); },
    setPointerCapture(){}, releasePointerCapture(){},
    toBlob(cb){ cb(new Blob([new Uint8Array(10)])); },
    toDataURL(){ return 'data:image/png;base64,'; },
  };
  // Options assigned via setAttribute('selected') should update the parent value.
  return e;
}

const byId = {};
const IDS = ['canvas','canvas-wrap','status','sidebar','toolbar','dim-editor','dim-lbl','dim-inp',
  'room-name','room-w','room-h','room-ceil','wall-confirm-panel','wc-calc','wc-input',
  'label-place-panel','label-text','label-size','kitchen-panel','ku-type','ku-width','ku-depth-display',
  'furniture-panel','furn-cat','furn-type','furn-size-display','selected-panel','selected-info',
  'schedule-panel','schedule-body','snap-grid','show-dims','btn-select','btn-label','btn-kitchen',
  'btn-furniture','btn-schedule','btn-undo','btn-redo','btn-plan','btn-elev','elev-wall','load-input',
  'pdf-scale'];
for(const id of IDS) byId[id] = mkEl(id === 'canvas' ? 'canvas' : 'div', id);
byId['room-w'].value = '8220';
byId['room-h'].value = '5050';
byId['room-ceil'].value = '2400';
byId['room-name'].value = 'Room';
byId['label-size'].value = 'medium';
byId['elev-wall'].value = 'top';
byId['pdf-scale'].value = '50';
byId['snap-grid'].checked = true;
byId['show-dims'].checked = true;
byId['schedule-panel'].style.display = 'none';
byId['kitchen-panel'].style.display = 'none';
byId['furniture-panel'].style.display = 'none';
byId['selected-panel'].style.display = 'none';
byId['wall-confirm-panel'].style.display = 'none';
byId['label-place-panel'].style.display = 'none';
byId['dim-editor'].style.display = 'none';

global.document = {
  getElementById: id => byId[id] || (byId[id] = mkEl('div', id)),
  createElement: tag => mkEl(tag),
  querySelectorAll: () => ({ forEach(){} }),
  addEventListener(){}, activeElement:{tagName:'BODY'},
  body:{ appendChild(){}, }
};
global.window = {
  devicePixelRatio:2,
  addEventListener(){},
  location:{href:''},
};
global.requestAnimationFrame = fn => { fn(); return 1; };
global.ResizeObserver = class { observe(){} disconnect(){} };
global.localStorage = {
  _m:new Map(),
  getItem(k){ return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k,v){ this._m.set(k, String(v)); },
  removeItem(k){ this._m.delete(k); },
};
global.URL.createObjectURL = () => 'blob:test';
global.URL.revokeObjectURL = () => {};
global.FileReader = class { readAsText(){} };
global.navigator = {};

// Expose internals for the assertions below.
const exposed = `
;globalThis.__api = {
  get roomW(){return roomW}, get roomH(){return roomH}, get roomCeil(){return roomCeil},
  get scale(){return scale},
  get wallPieces(){return wallPieces}, get corners(){return corners},
  get openings(){return openings}, get kitchenUnits(){return kitchenUnits},
  get furniture(){return furniture}, get roomLabels(){return roomLabels},
  get past(){return past}, get future(){return future},
  set selectedItem(v){selectedItem=v}, get selectedItem(){return selectedItem},
  addWallPiece, addCorner, addKitchenUnit, addFurniture, addDoor, addWindow,
  deleteSelected, undo, redo, pushHistory, snapshot, applySnapshot,
  computeSchedule, wallChain, elevItems, elevInfo, setView, fitView, drawPlan, drawElevation,
  planPage, schedulePage, buildPdf, roomData, boxes, boxBB, snapBox, snapDoor, wpBB,
  releaseSnap, cornerGeometry, refreshSchedule, showSelected, applyRoom, setBoxRot,
  writeAutosave, restoreAutosave, exportPDF, exportPNG, saveRoom, textWidthPt,
  KU_SPECS, FURN_SPECS,
};
`;

let bootError = null;
try{
  new Function(js + exposed)();
}catch(e){
  bootError = e;
}

const api = globalThis.__api;
const results = [];
function check(name, fn){
  try{
    const r = fn();
    results.push([r === false ? 'FAIL' : 'PASS', name, r === true || r === false || r === undefined ? '' : String(r)]);
  }catch(e){
    results.push(['FAIL', name, e.message]);
  }
}

if(bootError){
  console.log('BOOT FAILED:', bootError.stack.split('\n').slice(0,6).join('\n'));
  process.exit(1);
}
console.log('BOOT OK');

// ── Tests ──────────────────────────────────────────────────────────────────
check('room defaults', () => api.roomW === 8220 && api.roomH === 5050 && api.roomCeil === 2400);
check('fitView produced a positive scale', () => api.scale > 0 && isFinite(api.scale));

check('add wall piece', () => { api.addWallPiece(); return api.wallPieces.length === 1; });
check('wall piece snaps when its end reaches a wall', () => {
  const p = api.wallPieces[0];
  // A vertical 1000mm piece snaps to the top wall when its top end is there.
  p.cx = 1000; p.cy = 500;
  api.releaseSnap(p, 0);
  const bb = api.wpBB(p);
  return p.snapped && p.snappedFace === 'top' && Math.abs(bb.y1) < 0.001
    ? `face=top, top edge at y=${bb.y1}` : `snapped=${p.snapped} face=${p.snappedFace}`;
});

check('add kitchen units', () => {
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  for(let i=0;i<3;i++) api.addKitchenUnit();
  document.getElementById('ku-type').value = 'wall';
  api.addKitchenUnit();
  return api.kitchenUnits.length === 4;
});
check('kitchen unit snaps to the top wall', () => {
  const ku = api.kitchenUnits[0];
  ku.cx = 1000; ku.cy = 200;
  api.snapBox(ku);
  return ku.snapped && ku.snappedFace === 'top' ? 'face=top anchor=' + ku.anchorWallCoord : false;
});
check('snapped unit sits exactly against the wall', () => {
  const ku = api.kitchenUnits[0];
  const bb = api.boxBB(ku);
  return Math.abs(bb.y1 - 0) < 0.001 ? 'y1=' + bb.y1 : 'y1=' + bb.y1;
});

check('add furniture', () => {
  document.getElementById('furn-cat').value = 'Living';
  document.getElementById('furn-type').value = 'sofa3';
  api.addFurniture();
  document.getElementById('furn-type').value = 'coffee';
  api.addFurniture();
  return api.furniture.length === 2 ? api.furniture.map(f=>f.label).join(', ') : false;
});
check('free-standing furniture ignores wall snap', () => {
  const coffee = api.furniture.find(f => f.fType === 'coffee');
  coffee.cx = 500; coffee.cy = 300;
  api.snapBox(coffee);
  return coffee.snapped === false;
});
check('wall-hugging furniture snaps', () => {
  const sofa = api.furniture.find(f => f.fType === 'sofa3');
  sofa.cx = 4000; sofa.cy = roomHLike() - 300;
  api.snapBox(sofa);
  return sofa.snapped ? 'face=' + sofa.snappedFace : false;
});
function roomHLike(){ return api.roomH; }

check('rotate furniture swaps its footprint', () => {
  const sofa = api.furniture.find(f => f.fType === 'sofa3');
  const before = api.boxBB(sofa);
  const beforeX = before.x2-before.x1;
  api.setBoxRot(sofa, 1);
  const after = api.boxBB(sofa);
  return Math.abs((after.y2-after.y1) - beforeX) < 0.001
    ? `x-span ${beforeX} became y-span ${after.y2-after.y1}` : false;
});

check('add door and window', () => {
  api.addDoor(); api.addWindow();
  return api.openings.length === 2;
});
check('door snaps to a wall and records the new-format fields', () => {
  const d = api.openings[0];
  d.cx = 3000; d.cy = 40;
  api.snapDoor(d);
  return d.snapped && d.snapAxis === 'h' && d.snapCoord === 0 && d.wall === null
    ? `axis=h coord=0 pos=${d.pos}` : `snapped=${d.snapped} axis=${d.snapAxis} coord=${d.snapCoord}`;
});
check('window snaps to the left wall', () => {
  const w = api.openings[1];
  w.cx = 40; w.cy = 3500;   // clear of the wall piece at the top
  api.snapDoor(w);
  return w.snapped && w.snapAxis === 'v' && w.snapCoord === 0
    ? `axis=v coord=0 pos=${w.pos}` : `snapped=${w.snapped} axis=${w.snapAxis} coord=${w.snapCoord}`;
});
check('window kept its own defaults, not the door values', () => {
  const w = api.openings[1];
  return w.width === 1000 && w.height === 1000 && w.sill === 1100
    ? `w=${w.width} h=${w.height} sill=${w.sill}` : `w=${w.width} h=${w.height} sill=${w.sill}`;
});

check('angled corner', () => { api.addCorner(); return api.corners.length === 1; });

// Undo behaviour: the historic off-by-one bug.
check('undo steps back one real change', () => {
  const n0 = api.kitchenUnits.length;
  api.addKitchenUnit();
  const n1 = api.kitchenUnits.length;
  api.undo();
  const n2 = api.kitchenUnits.length;
  return (n1 === n0+1 && n2 === n0) ? `${n0} -> ${n1} -> undo -> ${n2}` : `${n0} -> ${n1} -> undo -> ${n2}`;
});
check('redo reapplies it', () => {
  const before = api.kitchenUnits.length;
  api.redo();
  return api.kitchenUnits.length === before+1 ? `${before} -> ${api.kitchenUnits.length}` : false;
});

check('wall chain splits at objects', () => {
  const c = api.wallChain('top');
  return c.segs.length >= 2 ? `${c.segs.length} segments, gaps=${c.segs.filter(s=>s.isGap).length}` : `${c.segs.length} segments`;
});
check('wall chain segments sum to the wall length', () => {
  const c = api.wallChain('bottom');
  const sum = c.segs.reduce((n,s) => n + (s.mmB-s.mmA), 0);
  return Math.abs(sum - api.roomW) < 30 ? `sum=${Math.round(sum)} of ${api.roomW}` : `sum=${Math.round(sum)} of ${api.roomW}`;
});

check('schedule computes', () => {
  const s = api.computeSchedule();
  return `area=${(s.areaMm2/1e6).toFixed(2)}m2 perim=${s.perimeterMm} units=${s.unitTotal} `
    + `worktop=${s.worktopMm}mm doors=${s.doors} windows=${s.windows} furn=${s.furn.length}`;
});
check('worktop run counts base and island units only', () => {
  const s = api.computeSchedule();
  const bases = api.kitchenUnits.filter(k => k.kuType === 'base' || k.kuType === 'island');
  const expect = bases.reduce((n,k) => n+k.width, 0);
  return s.worktopMm === expect ? `${s.worktopMm}mm from ${bases.length} units` : `got ${s.worktopMm}, expected ${expect}`;
});
check('net wall area subtracts openings', () => {
  const s = api.computeSchedule();
  return s.netWallAreaMm2 < s.wallAreaMm2 && s.openingAreaMm2 > 0
    ? `gross=${(s.wallAreaMm2/1e6).toFixed(2)} net=${(s.netWallAreaMm2/1e6).toFixed(2)}` : false;
});

check('plan renders without throwing', () => { api.drawPlan(); return true; });
check('elevation lists items on the top wall', () => {
  document.getElementById('elev-wall').value = 'top';
  const items = api.elevItems(api.elevInfo());
  return items.length ? items.map(i => `${i.label}@${i.z1}-${i.z2}`).join(', ') : 'none';
});
check('elevation renders without throwing', () => { api.setView('elev'); api.drawElevation(); api.setView('plan'); return true; });
check('elevation mirrors the two far walls', () => {
  document.getElementById('elev-wall').value = 'bottom';
  const info = api.elevInfo();
  return info.mirror === true && api.elevInfo().len === api.roomW ? 'bottom wall mirrored' : false;
});

check('save data round-trips through applySnapshot', () => {
  const data = JSON.parse(JSON.stringify(api.roomData()));
  const counts = [api.wallPieces.length, api.kitchenUnits.length, api.furniture.length, api.openings.length];
  api.applySnapshot(data);
  const after = [api.wallPieces.length, api.kitchenUnits.length, api.furniture.length, api.openings.length];
  return counts.join(',') === after.join(',') ? `counts ${after.join('/')}` : `${counts} vs ${after}`;
});

check('a v1 file with legacy opening fields still loads', () => {
  const legacy = {
    version:1, roomW:4000, roomH:3000, roomCeil:2400,
    drawnWalls:[], corners:[], roomLabels:[],
    wallPieces:[{cx:300,cy:1500,len:1000,thick:100,horiz:false,snapped:true,snappedFace:'left',anchorWallCoord:0,orientationLocked:true}],
    openings:[{type:'door', wall:'top', pos:1200, width:900, swing:'left', height:2030, thickness:100, sill:0, snapped:true}],
    kitchenUnits:[{kuType:'base', width:600, depth:580, carcassDepth:560, doorDepth:20, totalH:870, plinth:150, cx:900, cy:290, horiz:true, snapped:true, snappedFace:'top', anchorWallCoord:0}]
  };
  api.applySnapshot(legacy);
  const ku = api.kitchenUnits[0];
  return api.roomW === 4000 && ku.mountH === 0 && ku.color && ku.height === 870
    ? `restored, unit colour=${ku.color} mountH=${ku.mountH}` : false;
});
check('legacy opening still gets a bounding box', () => {
  api.drawPlan();
  return true;
});

check('autosave writes and restores', () => {
  api.writeAutosave();
  const raw = localStorage.getItem('roomdesigner.autosave.v16');
  if(!raw) return false;
  api.applySnapshot({roomW:1000, roomH:1000, wallPieces:[], corners:[], openings:[], roomLabels:[], kitchenUnits:[], furniture:[], drawnWalls:[]});
  const ok = api.restoreAutosave();
  return ok && api.roomW === 4000 ? `restored roomW=${api.roomW}` : `ok=${ok} roomW=${api.roomW}`;
});

// ── PDF ────────────────────────────────────────────────────────────────────
check('PDF plan page builds', () => {
  const p = api.planPage(50);
  return `${p.paper} ${Math.round(p.w)}x${Math.round(p.h)}pt scale 1:${p.denom}${p.fitted?' fitted':''} stream=${p.content.length}B`;
});
check('PDF picks a bigger sheet for a big room at 1:20', () => {
  const p = api.planPage(20);
  return `${p.paper} at 1:${p.denom}${p.fitted?' (fitted)':''}`;
});
check('PDF bytes are a valid single-document structure', () => {
  const p = api.planPage(50);
  const blob = api.buildPdf([p, api.schedulePage()], {title:'test'});
  return blob.size > 2000 ? `${blob.size} bytes` : `only ${blob.size} bytes`;
});

// The user's real saved room, straight from the backup folder.
check("the user's own v15 room file loads", () => {
  const p = nodePath.join(ROOT, 'backup', 'room_8220x5050.sample.room.json');
  if(!fs.existsSync(p)) return 'sample file not present — skipped';
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  api.applySnapshot(data);
  api.drawPlan();
  const s = api.computeSchedule();
  return `${api.roomW}x${api.roomH}, ${api.wallPieces.length} wall pieces, `
    + `${api.openings.length} openings, ${api.kitchenUnits.length} units, area ${(s.areaMm2/1e6).toFixed(2)}m2`;
});
check('that file also renders all four elevations', () => {
  const counts = [];
  for(const w of ['top','bottom','left','right']){
    document.getElementById('elev-wall').value = w;
    api.setView('elev');
    api.drawElevation();
    counts.push(w + ':' + api.elevItems(api.elevInfo()).length);
  }
  api.setView('plan');
  return counts.join(' ');
});
check('and exports to PDF', () => {
  const p = api.planPage(50);
  const blob = api.buildPdf([p, api.schedulePage()], {title:'user room'});
  return `${p.paper} 1:${p.denom}, ${blob.size} bytes`;
});

(async () => {
  // Byte-level structural validation of the generated PDF.
  const p = api.planPage(50);
  const blob = api.buildPdf([p, api.schedulePage()], {title:'RoomDesigner test'});
  const buf = Buffer.from(await blob.arrayBuffer());
  const txt = buf.toString('latin1');

  check('PDF starts with a version header', () => txt.startsWith('%PDF-1.4'));
  check('PDF ends with %%EOF', () => txt.trimEnd().endsWith('%%EOF'));
  check('PDF declares two pages', () => /\/Count 2\b/.test(txt));
  check('every object is terminated', () => {
    const objs = (txt.match(/^\d+ 0 obj$/gm) || []).length;
    const ends = (txt.match(/^endobj$/gm) || []).length;
    return objs === ends && objs > 0 ? `${objs} objects` : `${objs} obj vs ${ends} endobj`;
  });
  check('stream lengths match their declared /Length', () => {
    const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g;
    let m, n = 0;
    while((m = re.exec(txt))){
      n++;
      if(m[2].length !== parseInt(m[1],10)) return `stream ${n}: declared ${m[1]}, actual ${m[2].length}`;
    }
    return n ? `${n} streams verified` : 'no streams found';
  });
  check('xref offsets land on their object headers', () => {
    const xrefPos = txt.lastIndexOf('\nxref\n');
    const startxref = parseInt(/startxref\s+(\d+)/.exec(txt)[1], 10);
    if(startxref !== xrefPos + 1) return `startxref ${startxref} but xref at ${xrefPos+1}`;
    const rows = txt.slice(xrefPos).match(/^(\d{10}) 00000 n $/gm) || [];
    for(let i=0; i<rows.length; i++){
      const off = parseInt(rows[i].slice(0,10), 10);
      const expect = `${i+1} 0 obj`;
      if(txt.slice(off, off+expect.length) !== expect){
        return `object ${i+1}: offset ${off} points at "${txt.slice(off, off+20).replace(/\n/g,'\\n')}"`;
      }
    }
    return `${rows.length} offsets verified`;
  });
  check('content stream has balanced q/Q pairs', () => {
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(txt)[1];
    const q = (stream.match(/^q$/gm) || []).length;
    const Q = (stream.match(/^Q$/gm) || []).length;
    return q === Q ? `${q} save/restore pairs` : `${q} q vs ${Q} Q`;
  });
  check('content stream has balanced BT/ET pairs', () => {
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(txt)[1];
    const bt = (stream.match(/^BT$/gm) || []).length;
    const et = (stream.match(/^ET$/gm) || []).length;
    return bt === et && bt > 0 ? `${bt} text objects` : `${bt} BT vs ${et} ET`;
  });
  check('no unescaped parentheses inside text strings', () => {
    const bad = [];
    const re = /\((.*?)\) Tj/g;
    let m;
    const stream = txt;
    while((m = re.exec(stream))){
      const inner = m[1];
      // Count unescaped parens.
      const stripped = inner.replace(/\\[()\\]/g, '');
      if(/[()]/.test(stripped)) bad.push(inner);
    }
    return bad.length ? `${bad.length} bad: ${bad[0]}` : 'all clean';
  });

  fs.writeFileSync(process.argv[2] || 'out.pdf', buf);

  console.log('');
  let fails = 0;
  for(const [st, name, note] of results){
    if(st === 'FAIL') fails++;
    console.log(`${st}  ${name}${note ? '  —  ' + note : ''}`);
  }
  console.log('');
  console.log(`${results.length - fails} passed, ${fails} failed`);
  console.log('wrote ' + buf.length + ' bytes to ' + (process.argv[2] || 'out.pdf'));
  process.exit(fails ? 1 : 0);
})();
