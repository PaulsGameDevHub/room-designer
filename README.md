# Room Designer

A single-file room planner: draw a room to real millimetre dimensions, place walls,
angled corners, doors, windows, kitchen units, furniture and appliances, then export
a scaled PDF, a PNG or a reusable `.room.json` file.

Everything lives in [index.html](index.html) — no build step, no dependencies, no
network access. Open the file in a browser and it works, including from a USB stick
or GitHub Pages.

## Running it

Double-click `index.html`. There is nothing to install and nothing to serve — it runs
straight from `file://`. A hosted copy is at
<https://paulsgamedevhub.github.io/room-designer/>.

## What it does

**Room** — set the inside width, depth and ceiling height in mm. Outer walls are drawn
100mm thick. Changing the room size keeps everything already placed and pulls anything
now outside back in.

**Wall pieces** snap to the room walls and to each other's faces. The first snap also
picks the orientation; after that the piece keeps its orientation but can move to any
wall. Click any dimension label to type an exact value — gaps perpendicular to the
wall resize the piece, gaps along the wall slide it.

**Angled corners** are right-angled triangles with a rotatable anchor. Dimensions show
the gap from each leg tip to the next surface beyond it. They are solid: wall pieces
stop flush against a splay rather than sliding through it, and gap dimensions measure
to the splay.

Kitchen units and furniture can also **sit flush along** an angled face, turned to
match it. Drag one near the angled wall and it snaps to the angle, slides along it,
and clamps at each end. Its dimensions are then measured along that wall. Rotate
releases it back to the square walls. Angled walls also appear in the elevation
selector, so you can see what is against them at true heights. Wall pieces remain
square to the room; only units, furniture and doors follow an angle.

**Doors and windows** spawn floating in the middle of the room and snap when dragged to
a wall — including to the hypotenuse of an angled corner. Doors draw a leaf and a
quarter-circle swing arc; windows draw a reveal. Sizes, sill height and swing side are
set in the sidebar.

**Kitchen units** — base, wall, tall and island, with real carcass and door depths.
Wall units are drawn dashed to show they are overhead.

**Furniture and appliances** — around 45 items across living, dining, bedroom, kitchen
appliance, bathroom and storage categories, each with realistic sizes. Items that
normally sit against a wall snap to one; free-standing items do not. Any item can be
resized, rotated and given its own height off the floor.

**Elevation view** shows one wall face-on at the real ceiling height, with everything
against it drawn at its true height — window sills and heads, door heights, worktop
lines, plinths and overhead units. The two far walls are mirrored, because you are
standing inside the room looking at them.

**Schedule** computes floor area, perimeter, gross and net wall area, internal wall run,
worktop run, unit counts by type and width, and a furniture list. Enter optional rates
to get an indicative cost.

**Exports**
- **PDF** — a real vector PDF at 1:20, 1:50, 1:100 or 1:200, on A4 or A3 landscape
  chosen automatically, with a title block and full dimension chains. Falls back to
  fitting the page and reports the actual scale if the requested one will not fit.
  A second page carries the schedule.
- **PNG** — the current view at 2× resolution, rendered by the same code that draws the
  screen, so it cannot disagree with what you see.
- **`.room.json`** — the full model. Files saved by earlier versions still load.

**Autosave** — the current room is written to `localStorage` and restored next time, so
closing the tab no longer loses the plan.

## Keyboard

| Key | Action |
| --- | --- |
| `Del` / `Backspace` | delete selection |
| `Esc` | cancel dimension edit, then deselect |
| arrows | nudge 10mm (`Shift` 100mm) |
| `R` | rotate selection |
| `Ctrl`+`Z` / `Ctrl`+`Y` | undo / redo |
| `Ctrl`+`S` | save |
| `F` | fit view |
| `P` / `E` | plan / elevation |
| `+` / `-` or wheel | zoom (wheel zooms to the cursor) |
| middle-drag or `Space`-drag | pan |

## Tests

```bash
node test/run.js
```

Three stages, no dependencies:

- **`wiring.js`** — checks every id the script looks up exists in the markup, and that
  every name used by an inline `onclick` is reachable from global scope. That second
  check exists because `const fn = () => …` at script top level is *not* visible to
  inline handlers, which is a silent "button does nothing" bug.
- **`smoke.js`** — shims a DOM, boots the app, then drives the model: snapping, undo and
  redo, rotation, the schedule maths, elevation for all four walls, save round-trips,
  loading a v15 file, autosave, and PDF generation. Includes byte-level validation of
  the PDF (xref offsets, stream lengths, balanced `q`/`Q` and `BT`/`ET`, string escaping).

  A test signals failure with `fail('why')`. Returning a bare string is a *pass* with a
  note. This distinction matters: the harness originally treated any non-`false` return
  as a pass, so several tests that returned a description of what had gone wrong were
  reported green. If you add a test, every negative branch must go through `fail()`.
- **`pdfcheck.js`** — parses the generated PDF's content streams and confirms every
  coordinate lands inside the page box.

## Layout

```
index.html      the whole application
backup/         v15_16_3 exactly as downloaded, plus a sample room file
test/           test suite (run.js is the entry point)
```

## History

Grew out of roughly 130 iterations named `room_designer_v12` … `v15_16_4` in the
Downloads folder. `backup/room_designer_v15_16_3.original.html` is that last version
kept byte-for-byte.

Fixed on the way to this version:

- PNG and PDF export placed every door on the right-hand wall. The export renderer only
  understood the pre-`snapAxis` opening format and read `o.wall`, which the current snap
  code sets to `null`. Kitchen units were not exported at all. Both exports now go
  through the same geometry helpers as the screen.
- Undo was off by one: the drag handler snapshotted state *after* the move, so the first
  undo restored what you had just done. Snapshots are now taken before each change.
- A precedence bug in the wall dimension chain (`isVert && A || B`) made the second test
  ignore its guard, producing phantom split points.
- `gapDims` was defined twice, the first copy dead. `addCorner` had a duplicate `rx` key
  and a stray `cy`. `snapDoor` carried a dead `closestX` calculation.
- Adding a window ignored the size inputs that adding a door read.
- A saved file whose kitchen units lacked a `label` crashed the renderer; every field the
  renderer needs is now backfilled from the spec table on load.
- Mouse movement forced a full redraw on every event, and each redraw stroked ~130 grid
  lines individually. Frames are now batched to `requestAnimationFrame`, the grid is
  batched into two paths and dropped entirely when it would be sub-pixel, and the canvas
  is `devicePixelRatio`-aware instead of blurry.
- Angled corners were not solid. A triangle cannot be expressed as a snap edge and
  snapping only ever considered axis-aligned surfaces, so units, furniture and wall
  pieces slid straight through a splay — a 600mm base unit overlapped one by
  149,000mm². Snapping now evaluates candidate walls nearest-first and rejects any that
  would leave the item buried, which also fixed a dead spot where an item snapped to an
  internal wall piece's face, landed inside the splay, and could not escape because a
  wall-snapped item may only slide along its own wall.
- The view never recovered if the canvas container was first laid out at zero size
  (background tab, collapsed pane, un-laid-out iframe): the re-fit guard only triggered
  when `scale` was exactly `0`, which it never was, and `ResizeObserver` callbacks are
  part of the rendering steps so a non-rendered document never receives them.
