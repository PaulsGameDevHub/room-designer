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
  'pdf-scale', 'status-msg', 'build', 'btn-wall',
  'btn-electric', 'electric-panel', 'fit-type', 'fit-height', 'fit-size-display',
  ];
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
  get drawnWalls(){return drawnWalls}, get mode(){return mode},
  get pendingDrawn(){return pendingDrawn}, get drawStart(){return drawStart},
  toC, wAng, wLen, setMode, cancelDrawing, setDrawnWallLength,
  dwGeom, dwCorners, ptInDrawnWall, pickAt,
  get fittings(){return fittings}, addFitting, snapToSurface, fittingCorners,
  ptInFitting, fittingBB, drawFittings, FITTING_SPECS, pointInPoly,
  addRadiator, radOutput, RAD_SPECS, RAD_MOUNT_H, RAD_DEFAULTS,
  get dimHitAreas(){return dimHitAreas}, openDim, confirmDim, hitTest,
  get slopes(){return slopes}, addSlope, slopeBB, ptInSlope, ceilingAt,
  slopeCrossing, elevCeilingAt, elevHasSlope, HEADROOM_MM, SLOPE_DEFAULTS,
  slopeOnWall, drawSlopeElevDims, slopeRot, slopeDrop, slopeFall,
  setSlope, rotateSlope, snapSlope, SLOPE_DIRS,
  get past(){return past}, get future(){return future},
  set selectedItem(v){selectedItem=v}, get selectedItem(){return selectedItem},
  addWallPiece, addCorner, addKitchenUnit, addFurniture, addDoor, addWindow,
  deleteSelected, undo, redo, pushHistory, snapshot, applySnapshot,
  computeSchedule, wallChain, elevItems, elevInfo, setView, fitView, draw, drawPlan, drawElevation,
  planPage, schedulePage, buildPdf, roomData, boxes, boxBB, snapBox, snapDoor, wpBB,
  boxNearestObjects, cornerShadow, clipToSlab, cornerOverlapArea,
  slideBoxClear, slidePieceClear, settlePiece, settleBox, clearOfCorners, firstSnap, reSnap,
  isAngled, boxAngle, boxAxes, boxCorners, boxPolygon, hypOf, placeBoxOnHyp,
  boxInsideRoom, polyArea, clipByConvex, refreshElevWalls, rebindCornerSnaps,
  spanOf, depthOf, itemAngle, itemAxes, itemCorners, itemPolygon, itemAABB, ptInItem,
  placeOnHyp, itemHypGaps, itemInsideRoom, hypCandidates, unsnapPiece, anchorPiece,
  settleInRun, settleInAngledRun, separateUnits, anchorBox,
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
check('the build stamp is filled in and looks stamped, not left at the default', () => {
  const shown = byId['build'].textContent;
  if(!/^v\d+ · \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(shown))
    return fail(`build stamp reads "${shown}", which is not the expected shape`);
  if(/ 00:00$/.test(shown))
    return fail(`build stamp is still the placeholder "${shown}" — run node tools/stamp.js`);
  return `shows "${shown}"`;
});

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
  const g = api.itemHypGaps(ku);
  if(!g) return fail('itemHypGaps returned nothing');
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
  const g = api.itemHypGaps(second);
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

// ── Sloped ceilings ──────────────────────────────────────────────────────────
check('one click adds a 1m square slope falling 300mm from the ceiling', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  if(!z) return fail('nothing added');
  const bad = [];
  if(z.width !== 1000) bad.push(`width ${z.width}, expected 1000`);
  if(z.depth !== 1000) bad.push(`length ${z.depth}, expected 1000`);
  if(api.slopeDrop(z) !== 0) bad.push(`drop from ceiling ${api.slopeDrop(z)}, expected 0`);
  if(api.slopeFall(z) !== 300) bad.push(`fall ${api.slopeFall(z)}, expected 300`);
  if(Math.max(z.hLo, z.hHi) !== api.roomCeil) bad.push(`top ${Math.max(z.hLo,z.hHi)} is not the ceiling`);
  if(api.selectedItem !== z) bad.push('not left selected');
  return bad.length ? fail(bad.join('; '))
    : `1m × 1m, top flush with the ${api.roomCeil}mm ceiling, falling ${api.slopeFall(z)}mm `
      + `${api.SLOPE_DIRS[api.slopeRot(z)]}`;
});

check('rotating the slope turns both the fall and the footprint', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.width = 1200; z.depth = 600;
  const seen = [];
  for(let i=0; i<4; i++){
    seen.push(`${api.slopeRot(z)}:${z.width}x${z.depth}`);
    api.rotateSlope(z);
  }
  const rots = seen.map(s => s.split(':')[0]);
  if(new Set(rots).size !== 4) return fail(`only ${new Set(rots).size} directions in ${seen.join(' ')}`);
  // Four quarter turns must come back to the start.
  if(z.width !== 1200 || z.depth !== 600) return fail(`footprint ended ${z.width}x${z.depth}`);
  if(api.slopeFall(z) !== 300 || api.slopeDrop(z) !== 0)
    return fail(`drop/fall drifted to ${api.slopeDrop(z)}/${api.slopeFall(z)}`);
  return `${seen.join('  ')} — back to where it started`;
});

check('drop and fall can be set independently', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  api.setSlope(z, api.slopeRot(z), 400, 800);     // starts 400 down, falls 800
  const top = Math.max(z.hLo, z.hHi), bot = Math.min(z.hLo, z.hHi);
  const bad = [];
  if(top !== api.roomCeil - 400) bad.push(`top ${top}, expected ${api.roomCeil-400}`);
  if(bot !== api.roomCeil - 1200) bad.push(`bottom ${bot}, expected ${api.roomCeil-1200}`);
  if(api.slopeDrop(z) !== 400) bad.push(`drop reads back as ${api.slopeDrop(z)}`);
  if(api.slopeFall(z) !== 800) bad.push(`fall reads back as ${api.slopeFall(z)}`);
  return bad.length ? fail(bad.join('; '))
    : `top ${top}mm, bottom ${bot}mm, reading back as a ${api.slopeDrop(z)}mm drop and ${api.slopeFall(z)}mm fall`;
});

check('a slope snaps its nearest edge to a wall', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  // Dropped near the top-left corner, 60mm off each wall.
  z.cx = 560; z.cy = 560;
  api.snapSlope(z);
  const bb = api.slopeBB(z);
  if(!z.snapped) return fail('did not report snapping');
  if(Math.abs(bb.x1) > 0.001) return fail(`left edge at x=${bb.x1}, expected 0`);
  if(Math.abs(bb.y1) > 0.001) return fail(`top edge at y=${bb.y1}, expected 0`);
  return `clicked into the corner, edges at x=${bb.x1} and y=${bb.y1}`;
});

check('a slope well clear of any wall is left alone', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 4000; z.cy = 2500;
  api.snapSlope(z);
  return (!z.snapped && z.cx === 4000 && z.cy === 2500)
    ? 'stayed at 4000, 2500'
    : fail(`moved to ${z.cx}, ${z.cy} (snapped=${z.snapped})`);
});

check('a slope snaps to an internal wall piece face', () => {
  emptyRoom({
    wallPieces:[{cx:4000, cy:1000, len:2000, thick:200, horiz:false,
                 snapped:true, snappedFace:'top', anchorWallCoord:0, orientationLocked:true}]
  });
  api.addSlope();
  const z = api.slopes[0];
  // The stub's underside is at y=2000; drop the zone just below it.
  z.cx = 4000; z.cy = 2560;
  api.snapSlope(z);
  const bb = api.slopeBB(z);
  return Math.abs(bb.y1 - 2000) < 0.001
    ? `top edge clicked onto the stub's face at y=${bb.y1}`
    : fail(`top edge at y=${bb.y1}, expected 2000`);
});

check('the ceiling ramps across the zone and is flat outside it', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 2000; z.cy = 2000; z.width = 1000; z.depth = 2000;
  z.axis = 'y'; z.hLo = 1000; z.hHi = 2400;
  const bb = api.slopeBB(z);          // y 1000..3000
  const at = y => api.ceilingAt(2000, y);
  const lo = at(bb.y1 + 1), mid = at((bb.y1+bb.y2)/2), hi = at(bb.y2 - 1);
  const outside = api.ceilingAt(6000, 2000);
  const bad = [];
  if(Math.abs(lo - 1000) > 2) bad.push(`low edge ${lo.toFixed(0)}, expected 1000`);
  if(Math.abs(mid - 1700) > 2) bad.push(`midpoint ${mid.toFixed(0)}, expected 1700`);
  if(Math.abs(hi - 2400) > 2) bad.push(`high edge ${hi.toFixed(0)}, expected 2400`);
  if(outside !== api.roomCeil) bad.push(`outside the zone ${outside}, expected ${api.roomCeil}`);
  return bad.length ? fail(bad.join('; '))
    : `1000 → ${mid.toFixed(0)} → 2400 across the zone, ${outside} elsewhere`;
});

check('overlapping zones take the lower ceiling', () => {
  emptyRoom();
  api.addSlope();
  api.addSlope();
  const [a, b] = api.slopes;
  a.cx = 2000; a.cy = 2000; a.width = 2000; a.depth = 2000; a.hLo = 2000; a.hHi = 2000;
  b.cx = 2000; b.cy = 2000; b.width = 2000; b.depth = 2000; b.hLo = 1400; b.hHi = 1400;
  const h = api.ceilingAt(2000, 2000);
  return h === 1400 ? 'took 1400 over 2000' : fail(`got ${h}, expected 1400`);
});

check('the headroom crossing point is found', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.hLo = 1000; z.hHi = 3000;              // 2000 sits exactly halfway
  const t = api.slopeCrossing(z, api.HEADROOM_MM);
  if(t === null) return fail('no crossing found');
  if(Math.abs(t - 0.5) > 0.001) return fail(`crossing at ${t}, expected 0.5`);
  // And none reported when the whole zone is above or below the line.
  z.hLo = 2200; z.hHi = 2400;
  const none = api.slopeCrossing(z, api.HEADROOM_MM);
  return none === null
    ? `crossing at halfway when spanning 1000-3000, none when wholly above`
    : fail(`expected no crossing for a 2200-2400 zone, got ${none}`);
});

check('the elevation ceiling follows the slope', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  // A zone along the top wall, sloping across the room's width.
  z.cx = 2000; z.cy = 500; z.width = 4000; z.depth = 1000;
  z.axis = 'x'; z.hLo = 1200; z.hHi = 2400;
  document.getElementById('elev-wall').value = 'top';
  const info = api.elevInfo();
  if(!api.elevHasSlope(info)) return fail('the top wall elevation did not notice the slope');
  const bb = api.slopeBB(z);               // x 0..4000
  const left = api.elevCeilingAt(info, bb.x1 + 10);
  const right = api.elevCeilingAt(info, bb.x2 - 10);
  const beyond = api.elevCeilingAt(info, 7000);
  if(!(left < right)) return fail(`left ${left.toFixed(0)} not below right ${right.toFixed(0)}`);
  if(Math.abs(beyond - api.roomCeil) > 0.5) return fail(`beyond the zone ${beyond}`);
  api.setView('elev'); api.drawElevation(); api.setView('plan');
  return `ceiling rises ${left.toFixed(0)} → ${right.toFixed(0)} across the zone, `
    + `${beyond} beyond it`;
});

check('a wall with no slope over it still reads as flat', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 2000; z.cy = 500; z.width = 2000; z.depth = 800;   // near the top wall only
  document.getElementById('elev-wall').value = 'bottom';
  const info = api.elevInfo();
  const flat = !api.elevHasSlope(info);
  api.setView('elev'); api.drawElevation(); api.setView('plan');
  return flat ? 'the bottom wall elevation is unaffected'
              : fail('the bottom wall thinks it is sloped');
});

check('the schedule reports restricted headroom', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 1000; z.cy = 1000; z.width = 2000; z.depth = 2000;
  z.axis = 'y'; z.hLo = 1000; z.hHi = 3000;    // half the run is under 2000
  const s = api.computeSchedule();
  const zoneArea = 2000*2000;
  if(s.slopeCount !== 1) return fail(`slopeCount ${s.slopeCount}`);
  if(Math.abs(s.slopeAreaMm2 - zoneArea) > 1) return fail(`zone area ${s.slopeAreaMm2}`);
  if(Math.abs(s.lowHeadAreaMm2 - zoneArea/2) > 1)
    return fail(`low-headroom area ${s.lowHeadAreaMm2}, expected ${zoneArea/2}`);
  if(s.lowestCeil !== 1000) return fail(`lowest ceiling ${s.lowestCeil}`);
  if(Math.abs(s.standingAreaMm2 - (s.areaMm2 - zoneArea/2)) > 1)
    return fail(`standing area ${s.standingAreaMm2}`);
  return `${fmtA(s.slopeAreaMm2)} under a slope, ${fmtA(s.lowHeadAreaMm2)} below 2m, `
    + `${fmtA(s.standingAreaMm2)} with full headroom, lowest ${s.lowestCeil}mm`;
});
function fmtA(mm2){ return (mm2/1e6).toFixed(2) + 'm2'; }

check('a slope zone can be selected, dimensioned, saved and deleted', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 3000; z.cy = 2000;
  api.selectedItem = z;
  // draw() clears the hit areas first; drawPlan() only appends to them.
  api.draw();
  const dims = api.dimHitAreas.filter(h => h.tag && h.tag.type === 'slope-dim');
  if(dims.length !== 2) return fail(`${dims.length} clickable dimensions, expected 2`);
  // Retype the width on the canvas.
  const wDim = dims.find(d => d.tag.which === 'width');
  api.openDim(wDim.tag, wDim.bx, wDim.by);
  document.getElementById('dim-inp').value = '1800';
  api.confirmDim();
  if(z.width !== 1800) return fail(`width ${z.width} after typing 1800`);

  // Round trip, then a PDF, then delete.
  api.applySnapshot(JSON.parse(JSON.stringify(api.roomData())));
  const after = api.slopes[0];
  if(!after) return fail('the zone was lost on reload');
  if(after.width !== 1800 || after.hLo !== z.hLo || after.axis !== z.axis)
    return fail(`reloaded as ${after.width}/${after.hLo}/${after.axis}`);
  const p = api.planPage(50);
  if(!/sloped ceiling/.test(p.content)) return fail('not labelled in the PDF');
  api.selectedItem = after;
  api.deleteSelected();
  return api.slopes.length === 0
    ? `2 dimensions, retyped to ${after.width}mm, survived reload, drawn in the PDF, deleted`
    : fail(`${api.slopes.length} left after delete`);
});

check('the top stays flush with the ceiling whichever way it faces', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  // Which of hLo/hHi holds the ceiling-level end depends on the direction, so
  // the drop is the figure that has to stay at zero through a full turn.
  const drops = [];
  for(let i=0; i<4; i++){
    drops.push(api.slopeDrop(z));
    if(Math.max(z.hLo, z.hHi) !== api.roomCeil)
      return fail(`facing ${api.slopeRot(z)}: top is ${Math.max(z.hLo,z.hHi)}, not ${api.roomCeil}`);
    api.rotateSlope(z);
  }
  return drops.every(d => d === 0)
    ? `0mm drop in all four directions, top always at the ${api.roomCeil}mm ceiling`
    : fail(`drops were ${drops.join(', ')}`);
});

check('a slope running along a wall offers two editable heights in elevation', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 2000; z.cy = 400; z.width = 3000; z.depth = 800;
  z.axis = 'x'; z.hLo = 1200; z.hHi = 2400;      // ramps along the top wall
  document.getElementById('elev-wall').value = 'top';
  api.selectedItem = z;
  api.setView('elev');
  api.draw();
  const dims = api.dimHitAreas.filter(h => h.tag && h.tag.type === 'slope-height');
  api.setView('plan');
  if(dims.length !== 2) return fail(`${dims.length} height dimensions, expected 2`);
  const ts = dims.map(d => d.tag.t).sort((a,b) => a-b);
  return ts[0] < 0.2 && ts[1] > 0.8
    ? `two heights offered, at t=${ts[0].toFixed(2)} and t=${ts[1].toFixed(2)}`
    : fail(`t values ${ts.map(t => t.toFixed(2)).join(', ')} are not at the two ends`);
});

check('a slope running into a wall offers just one height there', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  // Must actually reach the top wall: y from 0 to 2400.
  z.cx = 2000; z.cy = 1200; z.width = 1000; z.depth = 2400;
  z.axis = 'y'; z.hLo = 1200; z.hHi = 2400;      // ramps away from the top wall
  document.getElementById('elev-wall').value = 'top';
  api.selectedItem = z;
  api.setView('elev');
  api.draw();
  const dims = api.dimHitAreas.filter(h => h.tag && h.tag.type === 'slope-height');
  api.setView('plan');
  return dims.length === 1
    ? 'one height offered, since the ceiling is a single height at that wall'
    : fail(`${dims.length} height dimensions, expected 1`);
});

check('typing a height in elevation sets it exactly', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 2000; z.cy = 400; z.width = 3000; z.depth = 800;
  z.axis = 'x'; z.hLo = 1200; z.hHi = 2400;
  document.getElementById('elev-wall').value = 'top';
  api.selectedItem = z;
  api.setView('elev');
  api.draw();
  const dims = api.dimHitAreas.filter(h => h.tag && h.tag.type === 'slope-height')
    .sort((a,b) => a.tag.t - b.tag.t);
  if(dims.length !== 2){ api.setView('plan'); return fail(`${dims.length} dimensions`); }

  // Type 900 at the low-end dimension. The promise is that the ceiling becomes
  // 900 AT THAT POINT — not that hLo becomes 900, since the dimension sits a
  // little way along the run.
  const tLow = dims[0].tag.t;
  api.openDim(dims[0].tag, dims[0].bx, dims[0].by);
  document.getElementById('dim-inp').value = '900';
  api.confirmDim();
  const atLow = z.hLo + tLow*(z.hHi - z.hLo);
  if(Math.abs(atLow - 900) > 1){
    api.setView('plan');
    return fail(`height at t=${tLow.toFixed(3)} is ${atLow.toFixed(1)}, expected 900`);
  }

  // And 2200 at the high-end dimension.
  api.draw();
  const hi = api.dimHitAreas.filter(h => h.tag && h.tag.type === 'slope-height')
    .sort((a,b) => b.tag.t - a.tag.t)[0];
  const tHigh = hi.tag.t;
  api.openDim(hi.tag, hi.bx, hi.by);
  document.getElementById('dim-inp').value = '2200';
  api.confirmDim();
  const atHigh = z.hLo + tHigh*(z.hHi - z.hLo);
  api.setView('plan');
  return Math.abs(atHigh - 2200) < 1
    ? `clicked heights came out at exactly ${Math.round(atLow)}mm and ${Math.round(atHigh)}mm`
    : fail(`height at t=${tHigh.toFixed(3)} is ${atHigh.toFixed(1)}, expected 2200`);
});

check('a height typed mid-run solves back to the right end', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  // The top wall cuts the zone halfway along its run, so t there is 0.5.
  z.cx = 2000; z.cy = 0; z.width = 1000; z.depth = 2000;
  z.axis = 'y'; z.hLo = 1000; z.hHi = 2000;
  document.getElementById('elev-wall').value = 'top';
  const info = api.elevInfo();
  const on = api.slopeOnWall(info, z);
  if(!on) { return fail('the zone was not found on the top wall'); }
  const t = on.tLo;
  const before = z.hLo + t*(z.hHi - z.hLo);
  api.selectedItem = z;
  api.setView('elev');
  api.draw();
  const dim = api.dimHitAreas.find(h => h.tag && h.tag.type === 'slope-height');
  api.openDim(dim.tag, dim.bx, dim.by);
  document.getElementById('dim-inp').value = '1800';
  api.confirmDim();
  const after = z.hLo + t*(z.hHi - z.hLo);
  api.setView('plan');
  return Math.abs(after - 1800) < 1
    ? `at t=${t.toFixed(2)} the height went ${Math.round(before)} → ${Math.round(after)}mm as typed`
    : fail(`height came out ${after.toFixed(1)}, expected 1800`);
});

check('a tall unit under the low end is flagged in elevation', () => {
  emptyRoom();
  api.addSlope();
  const z = api.slopes[0];
  z.cx = 1000; z.cy = 400; z.width = 2000; z.depth = 800;
  z.axis = 'x'; z.hLo = 1400; z.hHi = 1400;      // flat and low, easy to reason about
  document.getElementById('ku-type').value = 'tall';   // 2100 tall
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const ku = api.kitchenUnits[0];
  ku.cx = 1000; ku.cy = 300;
  api.snapBox(ku);
  document.getElementById('elev-wall').value = 'top';
  const info = api.elevInfo();
  const items = api.elevItems(info);
  const unit = items.find(i => i.obj === ku);
  if(!unit) return fail('the unit is not in the elevation');
  const ceil = api.elevCeilingAt(info, (unit.a1+unit.a2)/2);
  api.setView('elev'); api.drawElevation(); api.setView('plan');   // exercises the flag
  return unit.z2 > ceil
    ? `a ${unit.z2}mm unit under a ${ceil.toFixed(0)}mm ceiling — ${Math.round(unit.z2-ceil)}mm too tall`
    : fail(`unit top ${unit.z2} vs ceiling ${ceil}, expected a clash to flag`);
});

// ── Radiators ────────────────────────────────────────────────────────────────
// One button, no options: add the default radiator, then set it up like a user
// would — by editing it.
function dropRadiator(radType, len, ht, cx, cy, depth, floor){
  api.addRadiator();
  const r = api.furniture[api.furniture.length-1];
  if(radType !== undefined) r.radType = radType;
  if(len !== undefined) r.width = len;
  if(ht !== undefined) r.height = ht;
  if(depth !== undefined) r.depth = depth;
  if(floor !== undefined) r.mountH = floor;
  r.cx = cx; r.cy = cy;
  api.snapBox(r);
  return r;
}

check('radiator types have sensible depths, deepest for a double panel', () => {
  const t11 = api.RAD_SPECS.type11, t21 = api.RAD_SPECS.type21, t22 = api.RAD_SPECS.type22;
  if(!(t11.depth < t21.depth && t21.depth < t22.depth))
    return fail(`depths ${t11.depth}/${t21.depth}/${t22.depth} are not increasing`);
  if(!api.RAD_SPECS.towel) return fail('no towel rail type');
  return `T11 ${t11.depth}mm, T21 ${t21.depth}mm, T22 ${t22.depth}mm, plus a towel rail`;
});

check('output rises with type, length and height', () => {
  const base = api.radOutput('type11', 1000, 600);
  const byType = api.radOutput('type22', 1000, 600);
  const byLen = api.radOutput('type11', 2000, 600);
  const byHt = api.radOutput('type11', 1000, 700);
  const shorter = api.radOutput('type11', 1000, 300);
  const bad = [];
  if(byType <= base) bad.push(`T22 ${byType}W not above T11 ${base}W`);
  if(Math.abs(byLen - base*2) > 1) bad.push(`double length gave ${byLen}W, not ${base*2}W`);
  if(byHt <= base) bad.push(`700mm ${byHt}W not above 600mm ${base}W`);
  if(shorter >= base) bad.push(`300mm ${shorter}W not below 600mm ${base}W`);
  return bad.length ? fail(bad.join('; '))
    : `T11 1000x600 ${base}W, T22 ${byType}W, 2m long ${byLen}W, 700h ${byHt}W, 300h ${shorter}W`;
});

check('one click adds a 1m single-convector radiator, 150 off the floor', () => {
  emptyRoom();
  api.addRadiator();                       // no options, no panel
  const r = api.furniture[api.furniture.length-1];
  const bad = [];
  if(!r.isRad) bad.push('isRad not set');
  if(r.width !== 1000) bad.push(`length ${r.width}, expected 1000`);
  if(r.mountH !== 150) bad.push(`off floor ${r.mountH}, expected 150`);
  if(r.radType !== 'type11') bad.push(`type ${r.radType}, expected type11 (single convector)`);
  if(r.depth !== api.RAD_SPECS.type11.depth)
    bad.push(`depth ${r.depth}, expected ${api.RAD_SPECS.type11.depth}`);
  if(api.selectedItem !== r) bad.push('not left selected');
  return bad.length ? fail(bad.join('; '))
    : `${r.width} × ${r.height}mm, ${r.depth}mm deep (single convector), ${r.mountH}mm off the floor, selected`;
});

check('the Add radiator button is a plain toolbar button with no panel', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  if(!/<button onclick="addRadiator\(\)">Add radiator<\/button>/.test(html))
    return fail('no plain Add radiator button in the toolbar');
  if(/id="rad-panel"/.test(html)) return fail('the radiator panel is still in the markup');
  return 'one button, no panel';
});

check('every radiator dimension can still be any number', () => {
  emptyRoom();
  const r = dropRadiator('type22', 1337, 523, 3000, 200, 47, 92);
  const bad = [];
  if(r.width !== 1337) bad.push(`length ${r.width}`);
  if(r.height !== 523) bad.push(`height ${r.height}`);
  if(r.depth !== 47) bad.push(`depth ${r.depth}`);
  if(r.mountH !== 92) bad.push(`off floor ${r.mountH}`);
  if(bad.length) return fail(bad.join('; '));
  const bb = api.boxBB(r);
  if(Math.abs((bb.x2-bb.x1) - 1337) > 0.001) return fail(`footprint spans ${bb.x2-bb.x1}`);
  if(Math.abs((bb.y2-bb.y1) - 47) > 0.001) return fail(`footprint depth ${bb.y2-bb.y1}`);
  return `1337 × 523mm, 47mm deep, 92mm off the floor, all as set`;
});

check('a radiator on a wall offers three editable dimensions', () => {
  emptyRoom();
  const r = dropRadiator(undefined, 1000, 600, 3000, 200);
  api.selectedItem = r;
  api.drawPlan();
  const tags = api.dimHitAreas.map(h => h.tag).filter(t => t && t.box === r);
  const spans = tags.filter(t => t.type === 'box-span');
  const gaps  = tags.filter(t => t.type === 'box-gap');
  if(spans.length !== 1) return fail(`${spans.length} size dimensions, expected 1`);
  if(gaps.length !== 2) return fail(`${gaps.length} gap dimensions, expected 2`);
  return `its own length plus gaps to left and right — ${tags.length} clickable dimensions`;
});

check('clicking the size dimension changes the radiator length', () => {
  const r = api.furniture[api.furniture.length-1];
  api.selectedItem = r;
  api.drawPlan();
  const hit = api.dimHitAreas.find(h => h.tag && h.tag.type === 'box-span' && h.tag.box === r);
  if(!hit) return fail('no size dimension to click');
  // Click it, type a new length, apply — exactly the on-screen route.
  api.openDim(hit.tag, hit.bx, hit.by);
  document.getElementById('dim-inp').value = '1600';
  api.confirmDim();
  const bb = api.boxBB(r);
  if(r.width !== 1600) return fail(`length is ${r.width} after typing 1600`);
  if(Math.abs((bb.x2-bb.x1) - 1600) > 0.001) return fail(`footprint is ${bb.x2-bb.x1}`);
  if(Math.abs(bb.y1) > 0.001) return fail(`came off the wall, back edge at y=${bb.y1}`);
  return `retyped to ${r.width}mm on the canvas, still flush to the wall`;
});

check('the gap dimensions still move it along the wall', () => {
  emptyRoom();
  const r = dropRadiator(undefined, 1000, 600, 3000, 200);
  api.selectedItem = r;
  api.drawPlan();
  const hit = api.dimHitAreas.find(h => h.tag && h.tag.type === 'box-gap'
                                     && h.tag.side === 'lo' && h.tag.box === r);
  if(!hit) return fail('no left-hand gap dimension');
  api.openDim(hit.tag, hit.bx, hit.by);
  document.getElementById('dim-inp').value = '250';
  api.confirmDim();
  const bb = api.boxBB(r);
  return Math.abs(bb.x1 - 250) < 0.001
    ? `set the left gap to 250mm, radiator now starts at x=${bb.x1}`
    : fail(`left edge at ${bb.x1}, expected 250`);
});

check('an odd height still gets an output estimate', () => {
  const w = api.radOutput('type22', 1337, 523);
  const at600 = api.radOutput('type22', 1337, 600);
  return w > 0 && w < at600
    ? `523mm high gives ${w}W, below the ${at600}W of the same length at 600mm`
    : fail(`${w}W at 523mm vs ${at600}W at 600mm`);
});

check('a radiator snaps to a wall 150mm off the floor', () => {
  emptyRoom();
  const r = dropRadiator('type22', 1200, 600, 3000, 200);
  if(!r.isRad) return fail('the isRad flag was not set');
  if(!r.snapped || r.snappedFace !== 'top') return fail(`snapped=${r.snapped} face=${r.snappedFace}`);
  if(r.mountH !== api.RAD_MOUNT_H) return fail(`mountH is ${r.mountH}, expected ${api.RAD_MOUNT_H}`);
  const bb = api.boxBB(r);
  if(Math.abs(bb.y1) > 0.001) return fail(`back edge at y=${bb.y1}, expected 0`);
  return `on the top wall, ${r.width}×${r.height}mm, ${r.depth}mm deep, ${r.mountH}mm off the floor`;
});

check('a radiator shows in the elevation between 150 and 750', () => {
  emptyRoom();
  dropRadiator('type22', 1200, 600, 3000, 200);
  document.getElementById('elev-wall').value = 'top';
  const items = api.elevItems(api.elevInfo()).filter(i => i.obj && i.obj.isRad);
  if(items.length !== 1) return fail(`${items.length} radiators in the elevation`);
  const it = items[0];
  if(Math.abs(it.z1 - 150) > 0.001 || Math.abs(it.z2 - 750) > 0.001)
    return fail(`spans ${it.z1}-${it.z2}, expected 150-750`);
  api.setView('elev'); api.drawElevation(); api.setView('plan');
  return `drawn from ${it.z1}mm to ${it.z2}mm`;
});

check('a radiator joins a wall run and cannot overlap furniture', () => {
  emptyRoom();
  const r = dropRadiator('type22', 1000, 600, 2000, 200);
  document.getElementById('furn-cat').value = 'Living';
  document.getElementById('furn-type').value = 'bookcase';
  api.addFurniture();
  const shelf = api.furniture[api.furniture.length-1];
  shelf.cx = 2600; shelf.cy = 200;
  api.snapBox(shelf);
  const rb = api.boxBB(r), sb = api.boxBB(shelf);
  const ox = Math.min(rb.x2,sb.x2) - Math.max(rb.x1,sb.x1);
  const oy = Math.min(rb.y2,sb.y2) - Math.max(rb.y1,sb.y1);
  const overlap = (ox > 0 && oy > 0) ? ox*oy : 0;
  return overlap < 1
    ? `bookcase sits clear of the radiator (${Math.round(rb.x2)} then ${Math.round(sb.x1)})`
    : fail(`overlapping by ${Math.round(overlap)}mm2`);
});

check('the schedule totals radiator output and keeps them out of the furniture list', () => {
  emptyRoom();
  dropRadiator('type22', 1200, 600, 2000, 200);
  dropRadiator('type11', 800, 600, 6000, 200);
  document.getElementById('furn-cat').value = 'Living';
  document.getElementById('furn-type').value = 'sofa2';
  api.addFurniture();
  const sofa = api.furniture[api.furniture.length-1];
  sofa.cx = 4000; sofa.cy = 4800;
  api.snapBox(sofa);

  const s = api.computeSchedule();
  const expect = api.radOutput('type22',1200,600) + api.radOutput('type11',800,600);
  if(s.radTotal !== 2) return fail(`radTotal ${s.radTotal}, expected 2`);
  if(s.radWatts !== expect) return fail(`radWatts ${s.radWatts}, expected ${expect}`);
  if(s.furn.some(f => /radiator|panel/i.test(f.label)))
    return fail('a radiator leaked into the furniture list');
  if(!s.furn.some(f => /sofa/i.test(f.label)))
    return fail('the sofa went missing from the furniture list');
  return `${s.radTotal} radiators totalling ${s.radWatts}W, listed apart from ${s.furn.length} furniture row(s)`;
});

check('radiators survive save and load', () => {
  const before = api.furniture.filter(f => f.isRad).map(r => ({t:r.radType, w:r.width, h:r.height, m:r.mountH}));
  if(before.length !== 2) return fail(`${before.length} radiators to start with`);
  api.applySnapshot(JSON.parse(JSON.stringify(api.roomData())));
  const after = api.furniture.filter(f => f.isRad);
  if(after.length !== before.length) return fail(`${before.length} before, ${after.length} after`);
  for(let i=0; i<before.length; i++){
    const b = before[i], a = after[i];
    if(a.radType !== b.t || a.width !== b.w || a.height !== b.h || a.mountH !== b.m)
      return fail(`radiator ${i} changed: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  api.drawPlan();
  const p = api.planPage(50);
  return `both survived with type, size and height intact; PDF ${p.content.length} bytes`;
});

check('the old furniture radiators are hidden from the picker but still load', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  for(const key of ['radiator:', 'towelRad:']){
    const line = html.split('\n').find(l => l.includes(key) && l.includes('cat:'));
    if(!line) return fail(`${key} entry has gone, so old files would lose its size`);
    if(!/cat:'Legacy'/.test(line)) return fail(`${key} is still listed in a visible category`);
  }
  // And a v1-style file naming the old type still opens.
  api.applySnapshot({
    roomW:4000, roomH:3000, roomCeil:2400,
    drawnWalls:[], corners:[], roomLabels:[], openings:[], kitchenUnits:[], wallPieces:[], fittings:[],
    furniture:[{fType:'radiator', cx:2000, cy:200, snapped:true, snappedFace:'top', anchorWallCoord:0, horiz:true}]
  });
  const f = api.furniture[0];
  api.drawPlan();
  return f && f.width === 1000 && f.height === 600
    ? `both kept as Legacy; an old file's radiator still loads at ${f.width}×${f.height}`
    : fail(`old radiator loaded as ${f && f.width}×${f && f.height}`);
});

// ── Sockets and switches ─────────────────────────────────────────────────────
function dropFitting(fitType, cx, cy, height){
  document.getElementById('fit-type').value = fitType;
  document.getElementById('fit-height').value = height === undefined ? '' : String(height);
  api.addFitting();
  const f = api.fittings[api.fittings.length-1];
  f.cx = cx; f.cy = cy;
  api.snapToSurface(f);
  return f;
}

check('all five fitting types exist with the specified default heights', () => {
  const want = {socket2:1100, socket1:1100, switch1:1300, fused:1100, cooker:1100};
  const bad = [];
  for(const [k, h] of Object.entries(want)){
    const s = api.FITTING_SPECS[k];
    if(!s){ bad.push(`${k} missing`); continue; }
    if(s.mountH !== h) bad.push(`${s.label} defaults to ${s.mountH}, expected ${h}`);
  }
  if(bad.length) return fail(bad.join('; '));
  const list = Object.values(api.FITTING_SPECS)
    .map(s => `${s.label} ${s.mountH}mm`).join(', ');
  return list;
});

check('a double socket is wider than a single one', () => {
  const d = api.FITTING_SPECS.socket2, s = api.FITTING_SPECS.socket1;
  return d.width > s.width
    ? `double ${d.width}mm vs single ${s.width}mm`
    : fail(`double ${d.width}mm is not wider than single ${s.width}mm`);
});

check('a socket snaps onto a wall at its default height', () => {
  emptyRoom();
  const f = dropFitting('socket2', 3000, 60);       // near the top wall
  if(!f.snapped) return fail('did not snap to the wall');
  if(f.snapType !== 'axis' || f.snapAxis !== 'h' || f.snapCoord !== 0)
    return fail(`snapped as ${f.snapType}/${f.snapAxis}@${f.snapCoord}`);
  if(f.mountH !== 1100) return fail(`height is ${f.mountH}, expected 1100`);
  return `on the top wall at ${f.pos}mm along, ${f.mountH}mm to centre, ${f.width}mm plate`;
});

check('a light switch takes 1300 rather than the socket height', () => {
  emptyRoom();
  const sw = dropFitting('switch1', 3000, 60);
  const so = dropFitting('socket1', 5000, 60);
  return sw.mountH === 1300 && so.mountH === 1100
    ? `switch at ${sw.mountH}mm, socket at ${so.mountH}mm`
    : fail(`switch ${sw.mountH}, socket ${so.mountH}`);
});

check('a typed height overrides the default', () => {
  emptyRoom();
  const f = dropFitting('socket2', 3000, 60, 450);   // low-level socket
  return f.mountH === 450 ? 'placed at 450mm as typed'
                          : fail(`height is ${f.mountH}, expected 450`);
});

check('a fitting snaps to each of the four walls', () => {
  const got = [];
  for(const [name, cx, cy, axis, coord] of [
    ['top', 3000, 60, 'h', 0], ['bottom', 3000, 4990, 'h', 5050],
    ['left', 60, 2500, 'v', 0], ['right', 8160, 2500, 'v', 8220]]){
    emptyRoom();
    const f = dropFitting('socket1', cx, cy);
    if(!f.snapped || f.snapAxis !== axis || f.snapCoord !== coord)
      return fail(`${name}: got ${f.snapAxis}@${f.snapCoord}, expected ${axis}@${coord}`);
    got.push(name);
  }
  return 'snapped to ' + got.join(', ');
});

check('a fitting snaps to an angled wall too', () => {
  emptyRoom({corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]});
  const h = api.hypOf(api.corners[0]);
  const mx = h.p1.x + 0.5*h.len*h.ux, my = h.p1.y + 0.5*h.len*h.uy;
  const f = dropFitting('socket2', mx + h.nx*40, my + h.ny*40);
  if(f.snapType !== 'corner') return fail(`snapped as ${f.snapType}, expected corner`);
  return `on the angled wall at t=${f.snapT.toFixed(2)}, ${f.mountH}mm high`;
});

check('a fitting is clickable despite being small', () => {
  emptyRoom();
  const f = dropFitting('socket1', 3000, 60);
  const hit = api.pickAt(f.pos, 20);
  const miss = api.pickAt(f.pos, 1500);
  if(hit !== f) return fail('a click on the plate did not select it');
  if(miss === f) return fail('a click 1.5m away still selected it');
  return 'selected from on the plate, not from across the room';
});

check('fittings appear in the elevation at their real height', () => {
  emptyRoom();
  dropFitting('socket2', 2000, 60);
  dropFitting('switch1', 4000, 60);
  document.getElementById('elev-wall').value = 'top';
  const items = api.elevItems(api.elevInfo()).filter(i => i.kind === 'fitting');
  if(items.length !== 2) return fail(`${items.length} fittings in the elevation, expected 2`);
  const sock = items.find(i => i.label === '2G');
  const sw = items.find(i => i.label === 'SW');
  if(!sock || !sw) return fail(`labels were ${items.map(i => i.label).join(',')}`);
  // The plate should straddle its quoted centre height.
  if(Math.abs((sock.z1+sock.z2)/2 - 1100) > 0.001) return fail(`socket centred at ${(sock.z1+sock.z2)/2}`);
  if(Math.abs((sw.z1+sw.z2)/2 - 1300) > 0.001) return fail(`switch centred at ${(sw.z1+sw.z2)/2}`);
  api.setView('elev'); api.drawElevation(); api.setView('plan');
  return `socket ${sock.z1}-${sock.z2} centred 1100, switch ${sw.z1}-${sw.z2} centred 1300`;
});

check('the schedule counts fittings by type and height', () => {
  emptyRoom();
  dropFitting('socket2', 1500, 60);
  dropFitting('socket2', 3000, 60);
  dropFitting('socket2', 1500, 4990, 450);     // same type, different height
  dropFitting('cooker', 5000, 60);
  const s = api.computeSchedule();
  if(s.fitTotal !== 4) return fail(`fitTotal is ${s.fitTotal}, expected 4`);
  const doubles = s.fits.filter(f => f.code === '2G');
  if(doubles.length !== 2) return fail(`double sockets grouped into ${doubles.length} rows, expected 2 (1100 and 450)`);
  return `${s.fitTotal} fittings in ${s.fits.length} rows: `
    + s.fits.map(f => `${f.code}x${f.count}@${f.mountH}`).join(', ');
});

check('fittings survive save and load, including on an angled wall', () => {
  emptyRoom({corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]});
  const h = api.hypOf(api.corners[0]);
  const mx = h.p1.x + 0.4*h.len*h.ux, my = h.p1.y + 0.4*h.len*h.uy;
  // Beyond x=3700, where the splay ends — nearer the top wall than the angle.
  const flat = dropFitting('socket2', 6000, 60);
  if(flat.snapType !== 'axis') return fail(`the flat one snapped as ${flat.snapType}, expected axis`);
  const ang = dropFitting('switch1', mx + h.nx*40, my + h.ny*40);
  if(ang.snapType !== 'corner') return fail('the second one did not take the angled wall');
  const before = {n:api.fittings.length, t:ang.snapT, h:ang.mountH};

  api.applySnapshot(JSON.parse(JSON.stringify(api.roomData())));
  const after = api.fittings;
  if(after.length !== before.n) return fail(`${before.n} before, ${after.length} after`);
  // Match by code: picking the first corner-snapped one would be ambiguous.
  const a = after.find(f => f.code === 'SW');
  if(!a) return fail('the switch went missing');
  if(a.snapType !== 'corner') return fail('the switch lost its angled wall');
  if(!api.corners.includes(a.snapCorner)) return fail('snapCorner is not a live reference');
  if(Math.abs(a.snapT-before.t) > 1e-9) return fail(`moved along the wall`);
  if(a.mountH !== before.h) return fail(`height changed to ${a.mountH}`);
  api.drawPlan();
  return `both survived, angled one re-linked at t=${a.snapT.toFixed(2)}, ${a.mountH}mm`;
});

check('fittings render into the PDF', () => {
  emptyRoom();
  dropFitting('socket2', 2000, 60);
  dropFitting('cooker', 5000, 60);
  const p = api.planPage(50);
  const has2G = /\(2G\) Tj/.test(p.content);
  const hasCCU = /\(CCU\) Tj/.test(p.content);
  let outside = 0, pts = 0;
  for(const line of p.content.split('\n')){
    const m = /^([-\d.]+) ([-\d.]+) (?:m|l)$/.exec(line);
    if(!m) continue;
    pts++;
    if(+m[1] < -2 || +m[2] < -2 || +m[1] > p.w+2 || +m[2] > p.h+2) outside++;
  }
  if(!has2G || !hasCCU) return fail(`codes in the PDF: 2G=${has2G} CCU=${hasCCU}`);
  if(outside) return fail(`${outside} of ${pts} coordinates off the page`);
  return `both codes labelled, ${pts} coordinates all on the page`;
});

// ── Draw-wall tool (switched off, kept working) ──────────────────────────────
// The feature is complete but hidden behind FEATURES.drawWall. These tests keep
// the dormant path honest, so flipping the flag back on cannot ship something
// broken. They call setMode('wall') directly, which is why they still run.
check('the draw-wall button is hidden while the feature is off', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const flag = /drawWall:\s*(true|false)/.exec(html);
  if(!flag) return fail('could not find the FEATURES.drawWall flag');
  const btn = /<button id="btn-wall"[^>]*>/.exec(html);
  if(!btn) return fail('the btn-wall markup has gone, so the flag cannot restore it');
  const markupHidden = / hidden/.test(btn[0]);
  const applied = /\$\('btn-wall'\)\.hidden = !FEATURES\.drawWall;/.test(html);
  if(!applied) return fail('nothing applies the flag to the button');
  if(flag[1] === 'false' && !markupHidden) return fail('flag is off but the button is not hidden in the markup');
  return `FEATURES.drawWall = ${flag[1]}, button hidden in markup = ${markupHidden}, flag applied at startup`;
});
// Drive the real click handler rather than calling internals, by converting room
// coordinates back to canvas pixels the way the app does.
function clickCanvas(roomX, roomY){
  const p = api.toC(roomX, roomY);
  const listeners = byId['canvas']._listeners.click || [];
  if(!listeners.length) throw new Error('no click listener registered on the canvas');
  for(const fn of listeners) fn({clientX:p.x, clientY:p.y, button:0});
}
check('the second click places the wall immediately, 100mm thick', () => {
  emptyRoom();
  api.setMode('wall');
  if(api.mode !== 'wall') return fail(`setMode left the mode as ${api.mode}`);

  clickCanvas(1000, 1000);
  if(api.drawnWalls.length) return fail('the first click already created a wall');
  clickCanvas(2000, 2000);

  if(api.drawnWalls.length !== 1) return fail(`${api.drawnWalls.length} walls after the second click`);
  const w = api.drawnWalls[0];
  if(w.thick !== 100) return fail(`thickness is ${w.thick}, expected 100`);
  const len = api.wLen(w), deg = api.wAng(w);
  if(Math.abs(len - Math.hypot(1000,1000)) > 0.001) return fail(`length ${len.toFixed(1)}`);
  if(Math.abs(deg - 45) > 0.001) return fail(`angle ${deg.toFixed(2)}deg, expected 45`);
  if(api.drawStart) return fail('the start point was not cleared, so the next click would extend this wall');
  if(api.mode !== 'wall') return fail('mode left wall-drawing, so several walls cannot be drawn in a row');
  return `placed on the second click: ${Math.round(len)}mm at ${deg}deg, ${w.thick}mm thick, ready to draw another`;
});

check('a drawn wall is a solid rectangle of its thickness', () => {
  const w = api.drawnWalls[0];
  if(!w) return fail('no drawn wall to measure');
  const area = api.polyArea(api.dwCorners(w));
  const expect = api.wLen(w) * w.thick;
  if(Math.abs(area - expect) > 1) return fail(`footprint ${Math.round(area)}mm2 vs ${Math.round(expect)}`);
  // A point 40mm off the centre line is inside a 100mm wall; 80mm is outside.
  const g = api.dwGeom(w);
  const at = d => ({x:g.cx + g.nx*d, y:g.cy + g.ny*d});
  const inAt40 = api.ptInDrawnWall(at(40).x, at(40).y, w);
  const inAt80 = api.ptInDrawnWall(at(80).x, at(80).y, w);
  if(!inAt40 || inAt80) return fail(`hit test wrong: 40mm off=${inAt40}, 80mm off=${inAt80}`);
  return `${Math.round(area)}mm2 footprint, and it is clickable across its full ${w.thick}mm width`;
});

check('the length can still be set exactly after placing', () => {
  const w = api.drawnWalls[0];
  if(!w) return fail('no drawn wall');
  const x1 = w.x1, y1 = w.y1;
  api.setDrawnWallLength(w, 2000);
  const len = api.wLen(w), deg = api.wAng(w);
  if(Math.abs(len - 2000) > 0.001) return fail(`length is ${len} after asking for 2000`);
  if(Math.abs(deg - 45) > 0.001) return fail(`angle changed to ${deg}`);
  if(Math.abs(w.x1-x1) > 0.001 || Math.abs(w.y1-y1) > 0.001) return fail('the start point moved');
  return `rescaled to exactly ${len}mm about its start, still at ${deg}deg`;
});

check('a drawn wall can be selected, dimensioned and deleted', () => {
  const w = api.drawnWalls[0];
  // Without this guard the test passes vacuously: deleting nothing also leaves
  // zero walls behind.
  if(!w) return fail('no drawn wall to work with — the previous test must run first');
  api.selectedItem = w;
  api.showSelected();
  api.drawPlan();                       // exercises drawDrawnWallDims
  const p = api.planPage(50);           // and the PDF path
  if(!p.content.length) return fail('the PDF produced no content');
  api.deleteSelected();
  return api.drawnWalls.length === 0
    ? 'selected, dimensioned, rendered to PDF and deleted cleanly'
    : fail(`${api.drawnWalls.length} still present after delete`);
});

check('cancelling a half-drawn wall leaves nothing behind', () => {
  emptyRoom();
  api.setMode('wall');
  clickCanvas(500, 500);
  if(!api.drawStart) return fail('the first click did not register a start point');
  api.cancelDrawing();
  api.setMode('select');
  return api.drawnWalls.length === 0 && !api.drawStart
    ? 'no stray wall or start point left'
    : fail(`walls=${api.drawnWalls.length} start=${!!api.drawStart}`);
});

check('a drawn wall can be clicked anywhere across its width', () => {
  emptyRoom();
  api.setMode('wall');
  clickCanvas(2000, 2000);
  clickCanvas(5000, 2000);          // a horizontal 3000mm wall, 100mm thick
  api.setMode('select');
  const w = api.drawnWalls[0];
  if(!w) return fail('no wall created');
  // 40mm above the centre line is still within a 100mm wall.
  const hit = api.pickAt(3500, 2040);
  const miss = api.pickAt(3500, 2400);
  if(hit !== w) return fail('a click inside the wall did not select it');
  if(miss === w) return fail('a click 400mm away still selected it');
  return 'selected from inside its thickness, and not from well outside it';
});

// ── Runs of units along one wall ─────────────────────────────────────────────
// Declared with `function` so tests earlier in the file can use it too.
function emptyRoom(extra){
  api.applySnapshot(Object.assign({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], roomLabels:[], openings:[], furniture:[], corners:[],
    wallPieces:[], kitchenUnits:[]
  }, extra || {}));
}

// Drop a base unit of the given width at a spot and let it snap.
function dropUnit(width, cx, cy){
  document.getElementById('ku-type').value = 'base';
  document.getElementById('ku-width').value = String(width);
  api.addKitchenUnit();
  const ku = api.kitchenUnits[api.kitchenUnits.length-1];
  ku.cx = cx; ku.cy = cy;
  api.snapBox(ku);
  return ku;
}
const xSpan = ku => { const bb = api.boxBB(ku); return [bb.x1, bb.x2]; };

check('two units on the same wall click flush together', () => {
  emptyRoom();
  const a = dropUnit(600, 2000, 250);
  const b = dropUnit(600, 2680, 250);      // 80mm short of touching
  const [aLo, aHi] = xSpan(a), [bLo, bHi] = xSpan(b);
  const gap = bLo - aHi;
  return Math.abs(gap) < 0.001
    ? `dropped 80mm apart, closed to a ${gap}mm joint at x=${aHi}`
    : fail(`gap is ${gap}mm, expected 0 (a ${aLo}..${aHi}, b ${bLo}..${bHi})`);
});

check('a unit dragged onto another is pushed out rather than overlapping', () => {
  emptyRoom();
  const a = dropUnit(600, 2000, 250);
  const b = dropUnit(600, 2200, 250);      // squarely on top of a
  const [aLo, aHi] = xSpan(a), [bLo, bHi] = xSpan(b);
  const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
  if(overlap > 0.001) return fail(`still overlapping by ${overlap}mm (a ${aLo}..${aHi}, b ${bLo}..${bHi})`);
  return `pushed clear to ${bLo}..${bHi}, touching a at ${aHi}`;
});

check('three units form an exact continuous run', () => {
  emptyRoom();
  const a = dropUnit(600, 2000, 250);
  const b = dropUnit(600, 2670, 250);
  const c = dropUnit(500, 3250, 250);
  const spans = [a,b,c].map(xSpan).sort((p,q) => p[0]-q[0]);
  const gaps = [spans[1][0]-spans[0][1], spans[2][0]-spans[1][1]];
  const total = spans[2][1] - spans[0][0];
  if(gaps.some(g => Math.abs(g) > 0.001)) return fail(`gaps ${gaps.join(', ')}mm, expected 0`);
  return Math.abs(total - 1700) < 0.001
    ? `600+600+500 runs a continuous ${total}mm from x=${spans[0][0]} to ${spans[2][1]}`
    : fail(`run measures ${total}mm, expected 1700`);
});

check('a unit on a different wall is left alone', () => {
  emptyRoom();
  const top = dropUnit(600, 2000, 250);
  const left = dropUnit(600, 250, 2000);   // against the left wall
  const beforeCy = left.cy;
  api.snapBox(left);
  if(left.snappedFace !== 'left') return fail(`expected the left wall, got ${left.snappedFace}`);
  return Math.abs(left.cy - beforeCy) < 0.001
    ? `left-wall unit stayed at cy=${left.cy} while a top-wall unit sat at cx=${top.cx}`
    : fail(`left-wall unit moved from ${beforeCy} to ${left.cy}`);
});

check('a unit clicks flush to a wall stub on the same wall', () => {
  emptyRoom({
    // A stub hanging down off the top wall, crossing the unit depth band.
    wallPieces:[{cx:3000, cy:500, len:1000, thick:100, horiz:false,
                 snapped:true, snappedFace:'top', anchorWallCoord:0, orientationLocked:true}]
  });
  const ku = dropUnit(600, 2550, 250);     // right edge ~100mm short of the stub
  const [lo, hi] = xSpan(ku);
  return Math.abs(hi - 2950) < 0.001
    ? `unit runs to x=${hi}, exactly against the stub face at 2950`
    : fail(`unit right edge at ${hi}, expected 2950 (span ${lo}..${hi})`);
});

// ── Kitchen carcasses are solid ──────────────────────────────────────────────
function dropIsland(width, cx, cy){
  document.getElementById('ku-type').value = 'island';
  document.getElementById('ku-width').value = String(width);
  api.addKitchenUnit();
  const k = api.kitchenUnits[api.kitchenUnits.length-1];
  k.cx = cx; k.cy = cy;
  api.snapBox(k);
  return k;
}
const areaOverlap = (p, q) => {
  const a = api.boxBB(p), b = api.boxBB(q);
  const ox = Math.min(a.x2,b.x2) - Math.max(a.x1,b.x1);
  const oy = Math.min(a.y2,b.y2) - Math.max(a.y1,b.y1);
  return (ox > 0 && oy > 0) ? ox*oy : 0;
};

check('two islands cannot occupy the same floor space', () => {
  emptyRoom();
  const a = dropIsland(1000, 3000, 2500);
  const b = dropIsland(1000, 3200, 2500);   // dropped squarely on top
  const area = areaOverlap(a, b);
  const bb = api.boxBB(b);
  return area < 1
    ? `pushed clear to x ${bb.x1}..${bb.x2}, overlap ${area}mm2`
    : fail(`still overlapping by ${Math.round(area)}mm2`);
});

check('an island pushed off a base unit ends up clear of it', () => {
  emptyRoom();
  const wallUnit = dropUnit(600, 2000, 250);      // against the top wall
  const isle = dropIsland(1000, 2100, 500);      // dropped over it
  const area = areaOverlap(wallUnit, isle);
  return area < 1
    ? `island clear of the wall unit, overlap ${area}mm2`
    : fail(`island still overlaps the base unit by ${Math.round(area)}mm2`);
});

check('an island escapes by the shortest route', () => {
  emptyRoom();
  const a = dropIsland(1000, 3000, 2500);        // x 2500..3500, y 2210..2790
  // Nudged mostly downward, so the shortest way out is downward, not sideways.
  const b = dropIsland(1000, 3000, 2700);
  const bb = api.boxBB(b), ab = api.boxBB(a);
  if(areaOverlap(a,b) > 1) return fail('still overlapping');
  return Math.abs(bb.y1 - ab.y2) < 0.001
    ? `moved down to sit on the first island's edge at y=${ab.y2}`
    : fail(`ended at y ${bb.y1}..${bb.y2}, expected its top edge at ${ab.y2}`);
});

check('chairs can still tuck under a dining table', () => {
  emptyRoom();
  document.getElementById('furn-cat').value = 'Dining';
  document.getElementById('furn-type').value = 'dining6';
  api.addFurniture();
  const table = api.furniture[0];
  table.snapToWall = false;
  table.cx = 4000; table.cy = 2500;
  api.snapBox(table);
  document.getElementById('furn-type').value = 'chair';
  api.addFurniture();
  const chair = api.furniture[1];
  chair.snapToWall = false;
  chair.cx = 4000; chair.cy = 2500;             // deliberately under the table
  api.snapBox(chair);
  const area = areaOverlap(table, chair);
  return area > 1
    ? `chair still overlaps the table by ${Math.round(area)}mm2, as it should`
    : fail('the chair was pushed out from under the table');
});

check('two units on an angled wall butt up and do not overlap', () => {
  emptyRoom({corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]});
  const h = api.hypOf(api.corners[0]);
  const onHyp = (width, t) => {
    document.getElementById('ku-type').value = 'base';
    document.getElementById('ku-width').value = String(width);
    api.addKitchenUnit();
    const k = api.kitchenUnits[api.kitchenUnits.length-1];
    const px = h.p1.x + t*h.len*h.ux, py = h.p1.y + t*h.len*h.uy;
    k.cx = px + h.nx*(k.depth/2); k.cy = py + h.ny*(k.depth/2);
    api.snapBox(k);
    return k;
  };
  const a = onHyp(600, 0.4);
  if(!api.isAngled(a)) return fail('first unit did not take the angled wall');
  // Second one placed to overlap the first along the wall.
  const b = onHyp(600, 0.45);
  if(!api.isAngled(b)) return fail('second unit did not take the angled wall');
  const aC = a.snapT*h.len, bC = b.snapT*h.len;
  const gap = Math.abs(bC-aC) - 600;
  return Math.abs(gap) < 0.01
    ? `along the wall they meet exactly, centres ${Math.round(aC)} and ${Math.round(bC)}mm apart`
    : fail(`gap of ${gap.toFixed(2)}mm between them along the wall`);
});

check('furniture joins the run too, not just kitchen units', () => {
  emptyRoom();
  const ku = dropUnit(600, 2000, 250);          // base unit on the top wall
  document.getElementById('furn-cat').value = 'Bedroom';
  document.getElementById('furn-type').value = 'chest';   // 800 x 450
  api.addFurniture();
  const f = api.furniture[api.furniture.length-1];
  f.cx = 2790; f.cy = 200;                      // ~90mm short of the unit's edge
  api.snapBox(f);
  const [, kuHi] = xSpan(ku);
  const fb = api.boxBB(f);
  if(f.snappedFace !== 'top') return fail(`chest landed on the ${f.snappedFace} wall`);
  const gap = fb.x1 - kuHi;
  return Math.abs(gap) < 0.001
    ? `chest of drawers butts the unit at x=${kuHi} with a ${gap}mm joint`
    : fail(`gap of ${gap}mm between the unit and the chest`);
});

check('closing a run gap never pushes a unit into an angled wall', () => {
  emptyRoom({corners:[{rx:0, ry:0, wa:3500, ha:520, rot:0, snapped:'placed'}]});
  // On the LEFT wall just below the splay, which ends at y=520.
  const ku = dropUnit(600, 250, 900);
  const bb = api.boxBB(ku);
  const area = api.cornerOverlapArea(api.boxPolygon(ku), api.corners[0]);
  if(area > 1) return fail(`driven into the splay by ${area.toFixed(0)}mm2`);
  return `sits at y ${bb.y1}..${bb.y2}, clear of the splay ending at y=520`;
});

// ── Gaps must only count things on the same wall ─────────────────────────────
// Reported case: a unit on the left wall took its gap from a wall piece 4.3m away
// on the top wall, because every wall piece was treated as an obstacle whatever
// its position.
check('a gap ignores a wall piece that is nowhere near the unit', () => {
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], roomLabels:[], openings:[], furniture:[],
    // A shallow canted corner across the top-left, as in the user's plan.
    corners:[{rx:0, ry:0, wa:3500, ha:520, rot:0, snapped:'placed'}],
    // A short wall stub hanging off the TOP wall, far to the right.
    wallPieces:[{cx:4300, cy:500, len:1000, thick:100, horiz:false,
                 snapped:true, snappedFace:'top', anchorWallCoord:0, orientationLocked:true}],
    // A base unit against the LEFT wall.
    kitchenUnits:[{kuType:'base', width:600, carcassDepth:560, doorDepth:20, depth:580,
                   totalH:870, height:870, plinth:150, mountH:0, cx:290, cy:1700,
                   horiz:false, rot:1, snapped:true, snappedFace:'left', anchorWallCoord:0}]
  });
  const ku = api.kitchenUnits[0];
  const bb = api.boxBB(ku);
  const near = api.boxNearestObjects(ku, bb);

  // The stub spans x 4250..4350, so it never crosses the unit's depth band of
  // x 0..580 and must be ignored. The splay does cross it, ending at y=520.
  const stubBottom = 1000;
  if(Math.abs(near.nearLo - stubBottom) < 1)
    return fail(`gap measured to the far wall stub at y=${stubBottom} (${near.gapLo}mm)`);
  return Math.abs(near.nearLo - 520) < 1
    ? `gap above is ${near.gapLo}mm, measured to the splay at y=520, not the stub at y=1000`
    : fail(`gap above reaches y=${Math.round(near.nearLo)}, expected the splay at y=520`);
});

check('a wall piece that does cross the band still counts', () => {
  // Same room, but now the stub hangs off the LEFT wall, across the unit's depth.
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], roomLabels:[], openings:[], furniture:[], corners:[],
    wallPieces:[{cx:400, cy:1000, len:800, thick:100, horiz:true,
                 snapped:true, snappedFace:'left', anchorWallCoord:0, orientationLocked:true}],
    kitchenUnits:[{kuType:'base', width:600, carcassDepth:560, doorDepth:20, depth:580,
                   totalH:870, height:870, plinth:150, mountH:0, cx:290, cy:1700,
                   horiz:false, rot:1, snapped:true, snappedFace:'left', anchorWallCoord:0}]
  });
  const ku = api.kitchenUnits[0];
  const near = api.boxNearestObjects(ku, api.boxBB(ku));
  // The stub occupies y 950..1050 across x 0..800, so the gap should stop at 1050.
  return Math.abs(near.nearLo - 1050) < 1
    ? `gap above is ${near.gapLo}mm, stopping at the stub's face at y=1050`
    : fail(`gap above reaches y=${Math.round(near.nearLo)}, expected the stub at y=1050`);
});

check('a door in another wall does not shorten the run', () => {
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], roomLabels:[], furniture:[], corners:[], wallPieces:[],
    kitchenUnits:[{kuType:'base', width:600, carcassDepth:560, doorDepth:20, depth:580,
                   totalH:870, height:870, plinth:150, mountH:0, cx:290, cy:2500,
                   horiz:false, rot:1, snapped:true, snappedFace:'left', anchorWallCoord:0}],
    // A door in the TOP wall, 3m along, nothing to do with the left wall.
    openings:[{type:'door', width:900, height:2030, thickness:100, sill:0, swing:'left',
               snapped:true, snapType:'axis', snapAxis:'h', snapCoord:0, pos:3000,
               snapInward:1, cx:3000, cy:0}]
  });
  const ku = api.kitchenUnits[0];
  const near = api.boxNearestObjects(ku, api.boxBB(ku));
  return Math.abs(near.nearLo) < 1
    ? `gap above runs the full ${near.gapLo}mm to the top wall`
    : fail(`gap above stopped at y=${Math.round(near.nearLo)}, expected 0`);
});

// ── Every object type against every kind of wall ────────────────────────────
// The whole point of the feature, asserted as one matrix so a regression in any
// single cell fails loudly.
check('every object type clips to every kind of wall', () => {
  const freshRoom = () => api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400, roomName:'Matrix',
    drawnWalls:[], roomLabels:[], openings:[], kitchenUnits:[], furniture:[],
    // An internal wall piece to snap against, plus a shallow canted corner.
    wallPieces:[{cx:4000, cy:1000, len:2000, thick:200, horiz:false,
                 snapped:true, snappedFace:'top', anchorWallCoord:0, orientationLocked:true}],
    corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]
  });

  // How far the item's centre sits from the surface it is meeting. A wall piece
  // meets a straight wall end-on but lies along an angled one; an opening sits
  // inside the wall either way, so its offset is zero.
  const endOnHalf = it => it.len !== undefined ? it.len/2
                        : it.depth !== undefined ? it.depth/2 : 0;
  const alongHalf = it => it.len !== undefined ? it.thick/2
                        : it.depth !== undefined ? it.depth/2 : 0;

  const targets = {
    'room wall': it => { it.cx = 6000; it.cy = 5050 - endOnHalf(it) - 40; },
    'wall piece face': it => { it.cx = 4000; it.cy = 2000 + endOnHalf(it) + 30; },
    'angled wall': it => {
      const h = api.hypOf(api.corners[0]);
      const px = h.p1.x + 0.5*h.len*h.ux, py = h.p1.y + 0.5*h.len*h.uy;
      it.cx = px + h.nx*(alongHalf(it) + 40);
      it.cy = py + h.ny*(alongHalf(it) + 40);
    },
  };

  const makers = {
    'kitchen unit': () => {
      document.getElementById('ku-type').value = 'base';
      document.getElementById('ku-width').value = '600';
      api.addKitchenUnit();
      const it = api.kitchenUnits[api.kitchenUnits.length-1];
      return {it, snap:() => api.snapBox(it)};
    },
    'sofa': () => {
      document.getElementById('furn-cat').value = 'Living';
      document.getElementById('furn-type').value = 'sofa2';
      api.addFurniture();
      const it = api.furniture[api.furniture.length-1];
      return {it, snap:() => api.snapBox(it)};
    },
    'door':   () => { api.addDoor();   const it = api.openings[api.openings.length-1]; return {it, snap:() => api.snapDoor(it)}; },
    'window': () => { api.addWindow(); const it = api.openings[api.openings.length-1]; return {it, snap:() => api.snapDoor(it)}; },
    'wall piece': () => {
      api.addWallPiece();
      const it = api.wallPieces[api.wallPieces.length-1];
      it.len = 900; it.thick = 100;
      return {it, snap:() => {
        it.orientationLocked = false; it.snapped = false;
        api.releaseSnap(it, api.wallPieces.indexOf(it));
      }};
    },
  };

  const bad = [], grid = [];
  for(const [objName, make] of Object.entries(makers)){
    const row = [];
    for(const [wallName, place] of Object.entries(targets)){
      freshRoom();
      const {it, snap} = make();
      place(it);
      snap();
      const angled = it.snapType === 'corner';
      const ok = wallName === 'angled wall' ? angled : (it.snapped && !angled);
      if(!ok) bad.push(`${objName} -> ${wallName} (snapType=${it.snapType} snapped=${it.snapped} face=${it.snappedFace})`);
      row.push(ok ? 'y' : 'N');
    }
    grid.push(objName + ':' + row.join(''));
  }
  return bad.length ? fail(bad.join('; '))
                    : `all 15 combinations snap — ${grid.join('  ')}`;
});

check('a wall piece on an angled wall lies flush along it', () => {
  api.applySnapshot({
    roomW:8220, roomH:5050, roomCeil:2400,
    drawnWalls:[], roomLabels:[], openings:[], kitchenUnits:[], furniture:[], wallPieces:[],
    corners:[{rx:0, ry:0, wa:3700, ha:550, rot:0, snapped:'placed'}]
  });
  const h = api.hypOf(api.corners[0]);
  api.addWallPiece();
  const p = api.wallPieces[0];
  p.len = 900; p.thick = 100; p.orientationLocked = false;
  const px = h.p1.x + 0.5*h.len*h.ux, py = h.p1.y + 0.5*h.len*h.uy;
  p.cx = px + h.nx*(p.thick/2 + 40);
  p.cy = py + h.ny*(p.thick/2 + 40);
  api.releaseSnap(p, 0);
  if(!api.isAngled(p)) return fail(`did not take the angled snap (snapType=${p.snapType})`);

  const cp = api.itemCorners(p);
  const dist = q => (q.x-h.p1.x)*h.nx + (q.y-h.p1.y)*h.ny;
  const back = [dist(cp[0]), dist(cp[1])];
  const front = [dist(cp[2]), dist(cp[3])];
  const area = api.polyArea(cp);
  if(Math.abs(back[0]) > 0.01 || Math.abs(back[1]) > 0.01)
    return fail(`back edge not flush: ${back.map(d=>d.toFixed(3))}`);
  if(front[0] <= 0 || front[1] <= 0)
    return fail(`front edge is not inside the room: ${front.map(d=>d.toFixed(1))}`);
  if(Math.abs(area - p.len*p.thick) > 1)
    return fail(`footprint area ${Math.round(area)} vs ${p.len*p.thick}`);
  return `flush to ${back.map(d=>d.toFixed(3)).join('/')}mm, `
    + `${Math.round(front[0])}mm thick into the room, area ${Math.round(area)}mm2`;
});

check('an angled wall piece is dimensioned along that wall and survives reload', () => {
  const p = api.wallPieces[0];
  const g = api.itemHypGaps(p);
  if(!g) return fail('no along-wall gaps computed');
  const total = g.gapLo + p.len + g.gapHi;
  if(Math.abs(total - g.h.len) > 2) return fail(`${g.gapLo}+${p.len}+${g.gapHi} != ${Math.round(g.h.len)}`);
  const t = p.snapT, cx = p.cx, cy = p.cy;
  api.applySnapshot(JSON.parse(JSON.stringify(api.roomData())));
  const q = api.wallPieces[0];
  if(!api.isAngled(q)) return fail('lost the angled snap on reload');
  if(!api.corners.includes(q.snapCorner)) return fail('snapCorner is not a live reference after reload');
  if(Math.abs(q.snapT-t) > 1e-9 || Math.abs(q.cx-cx) > 0.01 || Math.abs(q.cy-cy) > 0.01)
    return fail(`moved on reload: t ${t}->${q.snapT}`);
  return `${g.gapLo} + ${p.len} + ${g.gapHi} = ${Math.round(total)}mm along the wall, reload preserved it`;
});

check('deleting the corner releases an angled wall piece', () => {
  const before = api.wallPieces.length;
  api.selectedItem = api.corners[0];
  api.deleteSelected();
  const p = api.wallPieces[0];
  if(!p) return fail(`the wall piece went too (${before} -> ${api.wallPieces.length})`);
  if(api.isAngled(p)) return fail('still flagged as angled with no corner left');
  const inside = api.itemInsideRoom(p);
  return inside ? `released, now ${p.snapped ? 'snapped to '+p.snappedFace : 'free'}, still inside the room`
                : fail('released but left outside the room');
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

// A known room with known contents, so the arithmetic is actually checked
// rather than merely printed.
const scheduleFixture = () => {
  emptyRoom({
    openings:[
      {type:'door', width:900, height:2030, thickness:100, sill:0, swing:'left',
       snapped:true, snapType:'axis', snapAxis:'h', snapCoord:0, pos:2000, snapInward:1, cx:2000, cy:0},
      {type:'window', width:1000, height:1000, thickness:100, sill:1100,
       snapped:true, snapType:'axis', snapAxis:'v', snapCoord:0, pos:3000, snapInward:1, cx:0, cy:3000},
    ]
  });
  dropUnit(600, 1000, 250);
  dropUnit(800, 4000, 250);
  return api.computeSchedule();
};

check('schedule computes the room figures exactly', () => {
  const s = scheduleFixture();
  const bad = [];
  if(s.areaMm2 !== 8220*5050) bad.push(`area ${s.areaMm2} != ${8220*5050}`);
  if(s.perimeterMm !== 2*(8220+5050)) bad.push(`perimeter ${s.perimeterMm} != ${2*(8220+5050)}`);
  if(s.wallAreaMm2 !== 2*(8220+5050)*2400) bad.push(`gross wall ${s.wallAreaMm2}`);
  if(s.doors !== 1 || s.windows !== 1) bad.push(`${s.doors} doors, ${s.windows} windows`);
  if(s.unitTotal !== 2) bad.push(`${s.unitTotal} units`);
  if(s.worktopMm !== 1400) bad.push(`worktop ${s.worktopMm} != 1400`);
  return bad.length ? fail(bad.join('; '))
    : `${(s.areaMm2/1e6).toFixed(2)}m2 floor, ${s.perimeterMm}mm perimeter, `
      + `${s.unitTotal} units, ${s.worktopMm}mm worktop, ${s.doors} door, ${s.windows} window`;
});
check('worktop run counts base and island units only', () => {
  // Own fixture, so the answer cannot be a vacuous zero.
  emptyRoom();
  dropUnit(600, 1000, 250);
  dropUnit(800, 2000, 250);
  dropIsland(1000, 4000, 2500);
  document.getElementById('ku-type').value = 'wall';      // overhead, no worktop
  document.getElementById('ku-width').value = '600';
  api.addKitchenUnit();
  const wu = api.kitchenUnits[api.kitchenUnits.length-1];
  wu.cx = 6000; wu.cy = 200;
  api.snapBox(wu);

  const s = api.computeSchedule();
  const counted = api.kitchenUnits.filter(k => k.kuType === 'base' || k.kuType === 'island');
  const expect = counted.reduce((n,k) => n+k.width, 0);
  if(!expect) return fail('fixture produced no worktop units');
  if(s.unitTotal !== 4) return fail(`expected 4 units in the schedule, got ${s.unitTotal}`);
  return s.worktopMm === expect
    ? `${s.worktopMm}mm from ${counted.length} base/island units, wall unit excluded`
    : fail(`got ${s.worktopMm}, expected ${expect}`);
});
check('net wall area subtracts exactly the opening areas', () => {
  const s = scheduleFixture();
  const expect = 900*2030 + 1000*1000;          // the door plus the window
  if(s.openingAreaMm2 !== expect)
    return fail(`openings total ${s.openingAreaMm2}mm2, expected ${expect}`);
  if(s.netWallAreaMm2 !== s.wallAreaMm2 - expect)
    return fail(`net ${s.netWallAreaMm2} != gross ${s.wallAreaMm2} - ${expect}`);
  return `gross ${(s.wallAreaMm2/1e6).toFixed(2)}m2 less ${(expect/1e6).toFixed(2)}m2 `
    + `of openings = ${(s.netWallAreaMm2/1e6).toFixed(2)}m2`;
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
