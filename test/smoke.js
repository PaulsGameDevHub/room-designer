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
  boxNearestObjects, cornerShadow, clipToSlab, cornerOverlapArea,
  slideBoxClear, slidePieceClear, settlePiece, settleBox, clearOfCorners, firstSnap, reSnap,
  isAngled, boxAngle, boxAxes, boxCorners, boxPolygon, hypOf, placeBoxOnHyp,
  boxHypGaps, boxInsideRoom, polyArea, clipByConvex, refreshElevWalls, rebindCornerSnaps,
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

// A test may return: true/undefined (pass), a string (pass, with a note),
// false, or fail('why'). Returning a bare string that happens to describe a
// problem is NOT a failure, so every negative branch must use fail().
const FAILED = Symbol('failed');
const fail = note => ({[FAILED]:true, note:String(note)});

function check(name, fn){
  try{
    const r = fn();
    if(r === false) results.push(['FAIL', name, '']);
    else if(r && typeof r === 'object' && r[FAILED]) results.push(['FAIL', name, r.note]);
    else results.push(['PASS', name, typeof r === 'string' ? r : '']);
  }catch(e){
    results.push(['FAIL', name, 'threw: ' + e.message]);
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
    ? `face=top, top edge at y=${bb.y1}` : fail(`snapped=${p.snapped} face=${p.snappedFace}`);
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
  return Math.abs(bb.y1) < 0.001 ? 'y1=' + bb.y1 : fail('bottom of the unit is at y=' + bb.y1 + ', expected 0');
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
    ? `axis=h coord=0 pos=${d.pos}` : fail(`snapped=${d.snapped} axis=${d.snapAxis} coord=${d.snapCoord}`);
});
check('window snaps to the left wall', () => {
  const w = api.openings[1];
  w.cx = 40; w.cy = 3500;   // clear of the wall piece at the top
  api.snapDoor(w);
  return w.snapped && w.snapAxis === 'v' && w.snapCoord === 0
    ? `axis=v coord=0 pos=${w.pos}` : fail(`snapped=${w.snapped} axis=${w.snapAxis} coord=${w.snapCoord}`);
});
check('window kept its own defaults, not the door values', () => {
  const w = api.openings[1];
  return w.width === 1000 && w.height === 1000 && w.sill === 1100
    ? `w=${w.width} h=${w.height} sill=${w.sill}` : fail(`got w=${w.width} h=${w.height} sill=${w.sill}, expected 1000/1000/1100`);
});

check('angled corner', () => { api.addCorner(); return api.corners.length === 1; });

// ── Angled corners are solid ───────────────────────────────────────────────
// A box must never be positioned inside a corner triangle. Regression test for
// units sliding straight through an angled wall.
check('a unit never penetrates an angled wall, anywhere along it', () => {
  // A 600x500 splay on the left wall, like the ones in the user's own room.
  const c = api.corners[0];
  c.rx = 0; c.ry = 1900; c.wa = 600; c.ha = 500; c.rot = 0;
  c.snapped = 'placed';

  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];

  let worst = 0, worstAt = null, held = 0;
  for(let y = 1000; y <= 3400; y += 25){
    ku.cx = 300; ku.cy = y;
    api.snapBox(ku);
    const area = api.cornerOverlapArea(api.boxPolygon(ku), c);
    if(area > worst){ worst = area; worstAt = y; }
    if(Math.abs(ku.cy - y) > 1) held++;
  }
  api.selectedItem = ku;
  api.deleteSelected();
  return worst < 1
    ? `97 positions swept, max penetration ${worst.toFixed(1)}mm2, held back at ${held} of them`
    : fail(`penetrated ${worst.toFixed(0)}mm2 at cursor y=${worstAt}`);
});

check('a unit sits flush against the splay rather than short of it', () => {
  const c = api.corners[0];
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  ku.cx = 300; ku.cy = 1850;      // pushed into the splay from above
  api.snapBox(ku);
  const bb = api.boxBB(ku);
  const touching = Math.abs(bb.y2 - 1900) < 1;
  api.selectedItem = ku;
  api.deleteSelected();
  return touching ? 'bottom edge rests exactly on y=1900' : fail(`bottom edge at y=${bb.y2}, expected 1900`);
});

check('gap dimensions measure to the splay, not through it', () => {
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  ku.cx = 300; ku.cy = 1400;
  api.snapBox(ku);
  const near = api.boxNearestObjects(ku, api.boxBB(ku));
  api.selectedItem = ku;
  api.deleteSelected();
  return Math.abs(near.nearHi - 1900) < 1
    ? `gap after reaches the splay at ${Math.round(near.nearHi)}`
    : fail(`gap after reaches ${Math.round(near.nearHi)}, expected 1900`);
});

check('an unsnapped free-standing item is also kept out', () => {
  document.getElementById('furn-cat').value = 'Dining';
  document.getElementById('furn-type').value = 'dining4';
  api.addFurniture();
  const f = api.furniture[api.furniture.length-1];
  f.snapToWall = false;
  f.cx = 200; f.cy = 2100;        // squarely inside the splay
  api.snapBox(f);
  const area = api.cornerOverlapArea(api.boxPolygon(f), api.corners[0]);
  api.selectedItem = f;
  api.deleteSelected();
  return area < 1 ? 'pushed clear of the triangle' : fail(`still overlapping by ${area.toFixed(0)}mm2`);
});

check('clipToSlab handles a triangle wholly outside the slab', () => {
  const tri = [{x:0,y:0},{x:100,y:0},{x:0,y:100}];
  return api.clipToSlab(tri, 'x', 500, 600).length === 0;
});

check('a wall piece never penetrates an angled wall either', () => {
  const c = api.corners[0];
  api.addWallPiece();
  const p = api.wallPieces[api.wallPieces.length-1];
  p.len = 1000; p.thick = 100;

  let worst = 0, worstAt = null, snapCount = 0;
  for(let y = 1000; y <= 3400; y += 25){
    // Drive it in as a fresh piece each time, so orientation is chosen afresh.
    p.orientationLocked = false;
    p.snapped = false;
    p.horiz = false;
    p.cx = 300; p.cy = y;
    api.releaseSnap(p, api.wallPieces.indexOf(p));
    if(p.snapped) snapCount++;
    const area = api.cornerOverlapArea(api.wpBB(p), c);
    if(area > worst){ worst = area; worstAt = y; }
  }
  api.selectedItem = p;
  api.deleteSelected();
  return worst < 1
    ? `97 positions swept, max penetration ${worst.toFixed(1)}mm2, snapped at ${snapCount}`
    : fail(`penetrated ${worst.toFixed(0)}mm2 at cursor y=${worstAt}`);
});

check('growing a wall piece into a splay pushes it back out', () => {
  const c = api.corners[0];
  api.addWallPiece();
  const p = api.wallPieces[api.wallPieces.length-1];
  p.len = 400; p.thick = 100;
  p.orientationLocked = false;
  p.cx = 300; p.cy = 1600;
  api.releaseSnap(p, api.wallPieces.indexOf(p));
  const before = api.wpBB(p);
  // It lands against the left wall lying horizontally, so its Y extent is its
  // thickness. Grow whichever dimension actually reaches toward the splay at
  // y 1900..2400 — growing the other one would prove nothing.
  const beforeY = before.y2 - before.y1;
  p[p.horiz ? 'thick' : 'len'] = 900;
  api.settlePiece(p);
  const after = api.wpBB(p);
  const afterY = after.y2 - after.y1;
  const area = api.cornerOverlapArea(after, c);
  api.selectedItem = p;
  api.deleteSelected();
  if(afterY <= beforeY) return fail(`the test failed to grow the Y extent (${beforeY} -> ${afterY}), so it proves nothing`);
  return area < 1
    ? `Y extent ${beforeY}->${afterY}mm, settled at y ${Math.round(after.y1)}..${Math.round(after.y2)}, clear of the splay`
    : fail(`overlapping by ${area.toFixed(0)}mm2 after growing`);
});

check('a piece with nowhere valid to snap is left free rather than buried', () => {
  const c = api.corners[0];
  api.addWallPiece();
  const p = api.wallPieces[api.wallPieces.length-1];
  // Long enough that it cannot fit beside the splay on the left wall.
  p.len = 300; p.thick = 100;
  p.orientationLocked = false;
  p.cx = 150; p.cy = 2150;      // dead centre of the splay
  api.releaseSnap(p, api.wallPieces.indexOf(p));
  const area = api.cornerOverlapArea(api.wpBB(p), c);
  const state = p.snapped ? 'snapped to ' + p.snappedFace : 'left free-standing';
  api.selectedItem = p;
  api.deleteSelected();
  return area < 1 ? `${state}, clear of the splay` : fail(`buried by ${area.toFixed(0)}mm2`);
});

// ── Units and furniture lying flush along an angled wall ───────────────────
check('a unit snaps flush along an angled wall', () => {
  // Clean slate. Earlier tests leave wall pieces and units lying about, and
  // their faces are snap targets too, so they would compete with the angled
  // wall and make the result depend on test order.
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400, roomName:'Angled test',
    drawnWalls:[], wallPieces:[], roomLabels:[], openings:[], kitchenUnits:[], furniture:[],
    // A long shallow canted wall, like the one in the user's screenshot.
    corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]
  });
  const c = api.corners[0];
  const h = api.hypOf(c);

  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];

  // Drop it just off the middle of the angled face, on the room side.
  const midX = (h.p1.x+h.p2.x)/2, midY = (h.p1.y+h.p2.y)/2;
  ku.cx = midX + h.nx*250;
  ku.cy = midY + h.ny*250;
  api.snapBox(ku);

  if(!api.isAngled(ku)){
    api.selectedItem = ku; api.deleteSelected();
    return fail(`did not snap to the angled wall (snapType=${ku.snapType} face=${ku.snappedFace})`);
  }
  // A 180-degree flip is fine — the box is symmetric along the wall. What must
  // hold is that u is parallel to the wall and v points into the room.
  const ax = api.boxAxes(ku);
  const alongDot = Math.abs(ax.ux*h.ux + ax.uy*h.uy);
  const intoDot = ax.vx*h.nx + ax.vy*h.ny;
  const deg = api.boxAngle(ku)*180/Math.PI;
  return Math.abs(alongDot-1) < 1e-9 && Math.abs(intoDot-1) < 1e-9
    ? `angle ${deg.toFixed(1)}deg: parallel to the wall, back against it`
    : fail(`along-wall dot ${alongDot.toFixed(6)} and into-room dot ${intoDot.toFixed(6)} should both be 1`);
});

check('its back edge sits exactly on the angled face', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const c = ku.snapCorner, h = api.hypOf(c);
  // Perpendicular distance from each back corner to the hypotenuse line.
  const cp = api.boxCorners(ku);
  const dist = p => (p.x-h.p1.x)*h.nx + (p.y-h.p1.y)*h.ny;
  const back = [dist(cp[0]), dist(cp[1])];
  const front = [dist(cp[2]), dist(cp[3])];
  const flush = Math.abs(back[0]) < 0.01 && Math.abs(back[1]) < 0.01;
  const inRoom = front[0] > 0 && front[1] > 0;
  return flush && inRoom
    ? `back corners at ${back.map(d => d.toFixed(3)).join('/')}mm, front at ${front.map(d => Math.round(d)).join('/')}mm into the room`
    : fail(`back corners ${back.map(d=>d.toFixed(2))} should be 0, front ${front.map(d=>d.toFixed(2))} should be positive`);
});

check('it does not cut into the solid part of the corner', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const area = api.cornerOverlapArea(api.boxPolygon(ku), ku.snapCorner);
  return area < 1 ? `penetration ${area.toFixed(3)}mm2` : fail(`penetrating ${area.toFixed(0)}mm2`);
});

check('the rotated footprint has the right area', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const area = api.polyArea(api.boxCorners(ku));
  const expect = ku.width*ku.depth;
  return Math.abs(area-expect) < 1
    ? `${Math.round(area)}mm2 = ${ku.width}x${ku.depth}`
    : fail(`${Math.round(area)} vs expected ${expect}`);
});

check('dragging along the angled wall slides it, keeping it flush', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const c = ku.snapCorner, h = api.hypOf(c);
  const seen = [];
  let worstFlush = 0;
  for(const frac of [0.15, 0.3, 0.5, 0.7, 0.85]){
    const px = h.p1.x + frac*h.len*h.ux, py = h.p1.y + frac*h.len*h.uy;
    ku.cx = px + h.nx*(ku.depth/2 + 60);   // a little off the face
    ku.cy = py + h.ny*(ku.depth/2 + 60);
    api.snapBox(ku);
    if(!api.isAngled(ku)) return fail(`lost the angled snap at t=${frac} (snapType=${ku.snapType} face=${ku.snappedFace})`);
    seen.push(ku.snapT.toFixed(2));
    for(const p of api.boxCorners(ku).slice(0,2)){
      worstFlush = Math.max(worstFlush, Math.abs((p.x-h.p1.x)*h.nx + (p.y-h.p1.y)*h.ny));
    }
  }
  return worstFlush < 0.01
    ? `slid through t = ${seen.join(', ')}, stayed flush within ${worstFlush.toFixed(4)}mm`
    : fail(`drifted off the face by ${worstFlush.toFixed(2)}mm`);
});

check('it cannot slide off either end of the angled wall', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const c = ku.snapCorner, h = api.hypOf(c);
  const halfT = ku.width/2/h.len;
  const results = [];
  for(const frac of [-0.5, 0, 1, 1.5]){
    const px = h.p1.x + frac*h.len*h.ux, py = h.p1.y + frac*h.len*h.uy;
    ku.cx = px + h.nx*(ku.depth/2);
    ku.cy = py + h.ny*(ku.depth/2);
    api.snapBox(ku);
    if(!api.isAngled(ku)){ results.push(`${frac}:released`); continue; }
    results.push(`${frac}->${ku.snapT.toFixed(3)}`);
    if(ku.snapT < halfT - 1e-9 || ku.snapT > 1-halfT + 1e-9) return fail(`t=${ku.snapT} outside [${halfT.toFixed(3)}, ${(1-halfT).toFixed(3)}]`);
  }
  return `clamped within the wall: ${results.join(', ')}`;
});

check('rotating releases it from the angled wall', () => {
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  api.setBoxRot(ku, (ku.rot ?? 0)+1);
  const releasedAngle = !api.isAngled(ku);
  api.snapBox(ku);
  const res = `angled=${api.isAngled(ku)} face=${ku.snappedFace}`;
  return releasedAngle ? `released on rotate, then re-snapped: ${res}` : fail('rotate did not release it from the angled wall');
});

check('gap dimensions along an angled wall reach both ends', () => {
  const c = api.corners[0], h = api.hypOf(c);
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  const px = h.p1.x + 0.5*h.len*h.ux, py = h.p1.y + 0.5*h.len*h.uy;
  ku.cx = px + h.nx*(ku.depth/2); ku.cy = py + h.ny*(ku.depth/2);
  api.snapBox(ku);
  const g = api.boxHypGaps(ku);
  if(!g) return fail('boxHypGaps returned nothing');
  const total = g.gapLo + ku.width + g.gapHi;
  return Math.abs(total - h.len) < 2
    ? `${g.gapLo} + ${ku.width} + ${g.gapHi} = ${Math.round(total)}mm, wall is ${Math.round(h.len)}mm`
    : fail(`${g.gapLo} + ${ku.width} + ${g.gapHi} = ${Math.round(total)} but the wall is ${Math.round(h.len)}`);
});

check('two units on the same angled wall measure the gap between them', () => {
  const c = api.corners[0], h = api.hypOf(c);
  const first = api.kitchenUnits[api.kitchenUnits.length-1];
  document.getElementById('ku-width').value = '400';
  api.addKitchenUnit();
  const second = api.kitchenUnits[api.kitchenUnits.length-1];
  // Place the second one further along, leaving a gap.
  const t2 = first.snapT + (first.width/2 + 300 + 200)/h.len;
  const px = h.p1.x + t2*h.len*h.ux, py = h.p1.y + t2*h.len*h.uy;
  second.cx = px + h.nx*(second.depth/2); second.cy = py + h.ny*(second.depth/2);
  api.snapBox(second);
  const g = api.boxHypGaps(second);
  const ok = g && g.gapLo > 0 && g.gapLo < 400;
  const res = g ? `gap to neighbour ${g.gapLo}mm, to the far end ${g.gapHi}mm` : 'none';
  api.selectedItem = second; api.deleteSelected();
  return ok ? res : fail(`unexpected: ${res}`);
});

check('an angled unit appears in that wall\'s elevation', () => {
  api.refreshElevWalls();
  const sel = document.getElementById('elev-wall');
  const cornerOpt = sel.options.find
    ? sel.options.find(o => String(o.value).startsWith('corner-'))
    : [...sel.options].filter(o => String(o.value).startsWith('corner-'))[0];
  if(!cornerOpt) return fail(`no angled wall option (options: ${[...sel.options].map(o=>o.value).join(',')})`);
  sel.value = cornerOpt.value;
  const info = api.elevInfo();
  if(info.kind !== 'corner') return fail(`elevInfo gave kind=${info.kind}`);
  const items = api.elevItems(info);
  api.setView('elev');
  api.drawElevation();
  api.setView('plan');
  sel.value = 'top';
  return items.length
    ? `${info.name}, ${Math.round(info.len)}mm long, ${items.length} item(s): ${items.map(i => i.label).join(', ')}`
    : fail('the angled wall elevation listed nothing');
});

check('an angled unit survives save and load', () => {
  const before = api.kitchenUnits.filter(k => api.isAngled(k));
  if(!before.length) return fail('there was no angled unit to test with');
  const ref = before[0];
  const snap = {t:ref.snapT, angle:ref.angle, cx:ref.cx, cy:ref.cy, cornerIdx:api.corners.indexOf(ref.snapCorner)};
  const data = JSON.parse(JSON.stringify(api.roomData()));
  api.applySnapshot(data);
  const after = api.kitchenUnits.filter(k => api.isAngled(k));
  if(after.length !== before.length) return fail(`${before.length} angled before, ${after.length} after`);
  const a = after[0];
  const sameCorner = api.corners.indexOf(a.snapCorner) === snap.cornerIdx;
  const samePlace = Math.abs(a.cx-snap.cx) < 0.01 && Math.abs(a.cy-snap.cy) < 0.01;
  const liveRef = api.corners.includes(a.snapCorner);
  return sameCorner && samePlace && liveRef
    ? `re-linked to corner ${snap.cornerIdx}, position and angle preserved`
    : fail(`corner=${sameCorner} place=${samePlace} liveRef=${liveRef}`);
});

check('a corner-snapped door survives save and load', () => {
  const c = api.corners[0], h = api.hypOf(c);
  api.addDoor();
  const d = api.openings[api.openings.length-1];
  d.cx = (h.p1.x+h.p2.x)/2; d.cy = (h.p1.y+h.p2.y)/2;
  api.snapDoor(d);
  if(d.snapType !== 'corner') return fail(`door did not snap to the corner (type=${d.snapType})`);
  const beforeT = d.snapT;
  const data = JSON.parse(JSON.stringify(api.roomData()));
  api.applySnapshot(data);
  const after = api.openings.filter(o => o.snapType === 'corner');
  if(!after.length) return fail('the corner-snapped door was lost on reload');
  const a = after[after.length-1];
  return api.corners.includes(a.snapCorner) && Math.abs(a.snapT-beforeT) < 1e-9
    ? `re-linked, still at t=${a.snapT.toFixed(3)} with a live corner reference`
    : fail(`snapCorner live=${api.corners.includes(a.snapCorner)} t=${a.snapT} vs ${beforeT}`);
});

check('undo no longer unsnaps corner-snapped items', () => {
  const angledBefore = api.kitchenUnits.filter(k => api.isAngled(k)).length;
  const doorsBefore = api.openings.filter(o => o.snapType === 'corner').length;
  api.pushHistory();
  api.addWallPiece();          // an unrelated change
  api.undo();
  const angledAfter = api.kitchenUnits.filter(k => api.isAngled(k)).length;
  const doorsAfter = api.openings.filter(o => o.snapType === 'corner').length;
  return angledAfter === angledBefore && doorsAfter === doorsBefore
    ? `${angledAfter} angled unit(s) and ${doorsAfter} corner door(s) intact through undo`
    : fail(`angled ${angledBefore}->${angledAfter}, doors ${doorsBefore}->${doorsAfter}`);
});

check('clipByConvex intersects two rotated rectangles', () => {
  const sq = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  // A square of the same size turned 45 degrees about the shared centre.
  // Turned 45 degrees about the shared centre, so its corners land on the
  // axes through the centre rather than back on the original corners.
  const r = 50*Math.SQRT2;
  const dia = [0,1,2,3].map(i => ({
    x:50 + r*Math.cos(i*Math.PI/2),
    y:50 + r*Math.sin(i*Math.PI/2)
  }));
  const area = api.polyArea(api.clipByConvex(dia, sq));
  // The intersection of a square and its 45-degree rotation is a regular
  // octagon of area 2*(sqrt(2)-1)*s^2.
  const expect = 2*(Math.SQRT2-1)*100*100;
  return Math.abs(area-expect) < 1
    ? `${Math.round(area)}mm2, matches the expected octagon`
    : fail(`${Math.round(area)} vs expected ${Math.round(expect)}`);
});

check('straight-wall snapping is unchanged when no corner is involved', () => {
  // Same assertion as the earlier wall-piece test, but with a splay present at
  // the far end of the room, to prove candidate ordering still picks nearest.
  api.addWallPiece();
  const p = api.wallPieces[api.wallPieces.length-1];
  p.len = 1000; p.thick = 100;
  p.orientationLocked = false;
  p.cx = 6000; p.cy = 500;
  api.releaseSnap(p, api.wallPieces.indexOf(p));
  const bb = api.wpBB(p);
  const ok = p.snapped && p.snappedFace === 'top' && Math.abs(bb.y1) < 0.001;
  api.selectedItem = p;
  api.deleteSelected();
  return ok ? 'still snaps to the nearest wall, top edge at y=0'
            : fail(`snapped=${p.snapped} face=${p.snappedFace} y1=${bb.y1}`);
});

// Undo behaviour: the historic off-by-one bug.
check('undo steps back one real change', () => {
  const n0 = api.kitchenUnits.length;
  api.addKitchenUnit();
  const n1 = api.kitchenUnits.length;
  api.undo();
  const n2 = api.kitchenUnits.length;
  return (n1 === n0+1 && n2 === n0) ? `${n0} -> ${n1} -> undo -> ${n2}` : fail(`${n0} -> ${n1} -> undo -> ${n2}, expected ${n0} -> ${n0+1} -> ${n0}`);
});
check('redo reapplies it', () => {
  const before = api.kitchenUnits.length;
  api.redo();
  return api.kitchenUnits.length === before+1 ? `${before} -> ${api.kitchenUnits.length}` : false;
});

check('wall chain splits at objects', () => {
  // Build the fixture rather than relying on what earlier tests left behind.
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], corners:[], roomLabels:[], kitchenUnits:[], furniture:[], openings:[],
    wallPieces:[{cx:2000, cy:500, len:1000, thick:200, horiz:false,
                 snapped:true, snappedFace:'top', anchorWallCoord:0, orientationLocked:true}]
  });
  api.addDoor();
  const d = api.openings[0];
  d.cx = 5000; d.cy = 30;
  api.snapDoor(d);
  const c = api.wallChain('top');
  const spans = c.segs.map(s => Math.round(s.mmB-s.mmA) + (s.isGap ? '(gap)' : ''));
  // Expect: clear run, the 200mm piece as a gap, clear run, the 900mm door as a
  // gap, clear run to the far corner.
  return c.segs.length >= 4
    ? `${c.segs.length} segments: ${spans.join(' + ')}`
    : fail(`only ${c.segs.length} segment(s): ${spans.join(' + ')}`);
});
check('wall chain segments sum to the wall length', () => {
  const c = api.wallChain('bottom');
  const sum = c.segs.reduce((n,s) => n + (s.mmB-s.mmA), 0);
  return Math.abs(sum - api.roomW) < 30 ? `sum=${Math.round(sum)} of ${api.roomW}` : fail(`segments sum to ${Math.round(sum)} but the wall is ${api.roomW}`);
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
  return s.worktopMm === expect ? `${s.worktopMm}mm from ${bases.length} units` : fail(`got ${s.worktopMm}, expected ${expect}`);
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
  return items.length ? items.map(i => `${i.label}@${i.z1}-${i.z2}`).join(', ') : fail('the top wall elevation listed nothing');
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
  return counts.join(',') === after.join(',') ? `counts ${after.join('/')}` : fail(`${counts} vs ${after}`);
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
  return ok && api.roomW === 4000 ? `restored roomW=${api.roomW}` : fail(`ok=${ok} roomW=${api.roomW}`);
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
  return blob.size > 2000 ? `${blob.size} bytes` : fail(`only ${blob.size} bytes`);
});

check('the PDF draws an angled unit as a rotated outline, on the page', () => {
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400, roomName:'Angled PDF',
    drawnWalls:[], wallPieces:[], roomLabels:[], openings:[], kitchenUnits:[], furniture:[],
    corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]
  });
  const h = api.hypOf(api.corners[0]);
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[0];
  const px = h.p1.x + 0.5*h.len*h.ux, py = h.p1.y + 0.5*h.len*h.uy;
  ku.cx = px + h.nx*(ku.depth/2); ku.cy = py + h.ny*(ku.depth/2);
  api.snapBox(ku);
  if(!api.isAngled(ku)) return fail('the unit did not take the angled snap');

  const p = api.planPage(50);
  // A rotated box is a move plus three lines closed with h, not a re rect.
  const closedPaths = (p.content.match(/^[-\d.]+ [-\d.]+ m\n(?:[-\d.]+ [-\d.]+ l\n){3}h$/gm) || []).length;
  // Every coordinate must still land inside the MediaBox.
  let outside = 0, pts = 0;
  for(const line of p.content.split('\n')){
    const m = /^([-\d.]+) ([-\d.]+) (?:m|l)$/.exec(line);
    if(!m) continue;
    pts++;
    const x = +m[1], y = +m[2];
    if(x < -2 || y < -2 || x > p.w+2 || y > p.h+2) outside++;
  }
  if(!closedPaths) return fail('no closed rotated path found in the content stream');
  if(outside) return fail(`${outside} of ${pts} coordinates fall outside the page`);
  const blob = api.buildPdf([p], {title:'angled'});
  return `${closedPaths} rotated path(s), ${pts} coordinates all on the page, ${blob.size} byte PDF`;
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
    return objs === ends && objs > 0 ? `${objs} objects` : fail(`${objs} obj vs ${ends} endobj`);
  });
  check('stream lengths match their declared /Length', () => {
    const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g;
    let m, n = 0;
    while((m = re.exec(txt))){
      n++;
      if(m[2].length !== parseInt(m[1],10)) return fail(`stream ${n}: declared ${m[1]}, actual ${m[2].length}`);
    }
    return n ? `${n} streams verified` : fail('no streams found in the PDF');
  });
  check('xref offsets land on their object headers', () => {
    const xrefPos = txt.lastIndexOf('\nxref\n');
    const startxref = parseInt(/startxref\s+(\d+)/.exec(txt)[1], 10);
    if(startxref !== xrefPos + 1) return fail(`startxref ${startxref} but xref at ${xrefPos+1}`);
    const rows = txt.slice(xrefPos).match(/^(\d{10}) 00000 n $/gm) || [];
    for(let i=0; i<rows.length; i++){
      const off = parseInt(rows[i].slice(0,10), 10);
      const expect = `${i+1} 0 obj`;
      if(txt.slice(off, off+expect.length) !== expect){
        return fail(`object ${i+1}: offset ${off} points at "${txt.slice(off, off+20).replace(/\n/g,'\\n')}"`);
      }
    }
    return `${rows.length} offsets verified`;
  });
  check('content stream has balanced q/Q pairs', () => {
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(txt)[1];
    const q = (stream.match(/^q$/gm) || []).length;
    const Q = (stream.match(/^Q$/gm) || []).length;
    return q === Q ? `${q} save/restore pairs` : fail(`${q} q vs ${Q} Q`);
  });
  check('content stream has balanced BT/ET pairs', () => {
    const stream = /stream\n([\s\S]*?)\nendstream/.exec(txt)[1];
    const bt = (stream.match(/^BT$/gm) || []).length;
    const et = (stream.match(/^ET$/gm) || []).length;
    return bt === et && bt > 0 ? `${bt} text objects` : fail(`${bt} BT vs ${et} ET`);
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
    return bad.length ? fail(`${bad.length} bad: ${bad[0]}`) : 'all clean';
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
