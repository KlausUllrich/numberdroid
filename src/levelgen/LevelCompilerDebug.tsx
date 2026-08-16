import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { compileActorPlacement } from "./actorPlacement";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { ConnectionGeometry, GridRect, SpaceGeometry } from "./geometryTypes";
import "./LevelCompilerDebug.css";

const TILE = 46;
const PAD = 34;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 5;

type ViewBox = { x: number; y: number; w: number; h: number };
type PointerPosition = { x: number; y: number };

function friendly(id: string) {
  return id.replace(/^family-/, "").replace(/-/g, " ").replace(/#/g, " ").toUpperCase();
}

function rectPixels(rect: GridRect, bounds: GridRect) {
  return {
    x: PAD + (rect.x - bounds.x) * TILE,
    y: PAD + (rect.y - bounds.y) * TILE,
    width: rect.w * TILE,
    height: rect.h * TILE,
  };
}

function cellCenter(cell: { x: number; y: number }, bounds: GridRect) {
  return {
    x: PAD + (cell.x - bounds.x + 0.5) * TILE,
    y: PAD + (cell.y - bounds.y + 0.5) * TILE,
  };
}

function connectionLine(connection: ConnectionGeometry, bounds: GridRect) {
  if (connection.wallOrientation === "vertical") {
    const x = PAD + (connection.boundary - bounds.x) * TILE;
    const y1 = PAD + (connection.apertureStart - bounds.y) * TILE;
    return { x1: x, y1, x2: x, y2: y1 + connection.apertureLength * TILE };
  }
  const y = PAD + (connection.boundary - bounds.y) * TILE;
  const x1 = PAD + (connection.apertureStart - bounds.x) * TILE;
  return { x1, y1: y, x2: x1 + connection.apertureLength * TILE, y2: y };
}

function spaceClass(space: SpaceGeometry, rationality?: string) {
  if (space.kind === "corridor") return "corridor";
  if (rationality === "domestic") return "domestic";
  if (rationality === "ritual") return "ritual";
  if (rationality === "system") return "system";
  return "neutral";
}

function pointerDistance(a: PointerPosition, b: PointerPosition) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: PointerPosition, b: PointerPosition): PointerPosition {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function facingVector(facing: number) {
  if (facing === 90) return { x: 0, y: 1 };
  if (facing === 180) return { x: -1, y: 0 };
  if (facing === 270) return { x: 0, y: -1 };
  return { x: 1, y: 0 };
}

export function LevelCompilerDebug() {
  const plan = useMemo(() => {
    const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const geometry = compileLevelGeometry(semantic);
    const navigation = compileLevelNavigationV031(geometry);
    const props = compileOrientedPropPlacement(navigation);
    return compileActorPlacement(props);
  }, []);

  const props = plan.props;
  const navigation = props.navigation;
  const { geometry, bounds } = navigation;
  const width = bounds.w * TILE + PAD * 2;
  const height = bounds.h * TILE + PAD * 2;
  const fullViewBox = useMemo<ViewBox>(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);

  const [showNavigation, setShowNavigation] = useState(true);
  const [showClearance, setShowClearance] = useState(true);
  const [showWallSlots, setShowWallSlots] = useState(false);
  const [showProps, setShowProps] = useState(true);
  const [showPropReservations, setShowPropReservations] = useState(false);
  const [showActors, setShowActors] = useState(true);
  const [showActorRoutes, setShowActorRoutes] = useState(true);
  const [viewBox, setViewBox] = useState<ViewBox>(fullViewBox);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewBoxRef = useRef<ViewBox>(fullViewBox);
  const pointersRef = useRef<Map<number, PointerPosition>>(new Map());

  const semanticById = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const verticalGrid = Array.from({ length: bounds.w + 1 }, (_, i) => PAD + i * TILE);
  const horizontalGrid = Array.from({ length: bounds.h + 1 }, (_, i) => PAD + i * TILE);
  const zoomPercent = Math.round((fullViewBox.w / viewBox.w) * 100);

  function commitViewBox(next: ViewBox) {
    viewBoxRef.current = next;
    setViewBox(next);
  }

  function fitView() {
    commitViewBox(fullViewBox);
  }

  function clientToSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function zoomAround(focus: { x: number; y: number }, factor: number, base = viewBoxRef.current) {
    const minWidth = fullViewBox.w / MAX_ZOOM;
    const maxWidth = fullViewBox.w / MIN_ZOOM;
    const nextWidth = Math.min(maxWidth, Math.max(minWidth, base.w * factor));
    const actualFactor = nextWidth / base.w;
    if (Math.abs(actualFactor - 1) < 0.000001) return base;
    const nextHeight = base.h * actualFactor;
    return {
      x: focus.x - (focus.x - base.x) * actualFactor,
      y: focus.y - (focus.y - base.y) * actualFactor,
      w: nextWidth,
      h: nextHeight,
    };
  }

  function zoomAtCenter(factor: number) {
    const current = viewBoxRef.current;
    commitViewBox(zoomAround({ x: current.x + current.w / 2, y: current.y + current.h / 2 }, factor, current));
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const focus = clientToSvg(event.clientX, event.clientY);
    if (!focus) return;
    commitViewBox(zoomAround(focus, Math.exp(event.deltaY * 0.0015)));
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const previousPointers = new Map(pointersRef.current);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentPointers = pointersRef.current;
    const currentView = viewBoxRef.current;

    if (currentPointers.size === 1) {
      const previous = previousPointers.get(event.pointerId);
      const current = currentPointers.get(event.pointerId);
      if (!previous || !current) return;
      const previousWorld = clientToSvg(previous.x, previous.y);
      const currentWorld = clientToSvg(current.x, current.y);
      if (!previousWorld || !currentWorld) return;
      commitViewBox({ ...currentView, x: currentView.x + previousWorld.x - currentWorld.x, y: currentView.y + previousWorld.y - currentWorld.y });
      return;
    }

    if (currentPointers.size >= 2) {
      const ids = [...currentPointers.keys()].slice(0, 2);
      const previousA = previousPointers.get(ids[0]);
      const previousB = previousPointers.get(ids[1]);
      const currentA = currentPointers.get(ids[0]);
      const currentB = currentPointers.get(ids[1]);
      if (!previousA || !previousB || !currentA || !currentB) return;
      const previousDistance = pointerDistance(previousA, previousB);
      const currentDistance = pointerDistance(currentA, currentB);
      if (previousDistance < 2 || currentDistance < 2) return;
      const previousMid = pointerMidpoint(previousA, previousB);
      const currentMid = pointerMidpoint(currentA, currentB);
      const previousWorld = clientToSvg(previousMid.x, previousMid.y);
      const currentWorld = clientToSvg(currentMid.x, currentMid.y);
      if (!previousWorld || !currentWorld) return;
      const panned: ViewBox = { ...currentView, x: currentView.x + previousWorld.x - currentWorld.x, y: currentView.y + previousWorld.y - currentWorld.y };
      commitViewBox(zoomAround(previousWorld, previousDistance / currentDistance, panned));
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(pointersRef.current.size > 0);
  }

  return (
    <main className="levelgen-debug">
      <header className="levelgen-debug__header">
        <div>
          <small>NUMBERDROID · LEVEL COMPILER DEBUG</small>
          <h1>TS-01 · GENERATED LEVEL PLAN</h1>
          <p>Spec → Geometry → Shared Walls → Navigation → Props → Actors</p>
        </div>
        <div className="levelgen-debug__stats">
          <span><b>{geometry.spaces.length}</b> SPACES</span>
          <span><b>{props.placements.length}</b> PROPS</span>
          <span><b>{plan.actors.length}</b> ACTORS</span>
          <span><b>{plan.routes.length}</b> ACTOR ROUTES</span>
        </div>
      </header>

      <section className="levelgen-debug__controls" aria-label="Debug layers and viewport">
        <label><input type="checkbox" checked={showNavigation} onChange={(event) => setShowNavigation(event.target.checked)} /> PRIMARY PATH</label>
        <label><input type="checkbox" checked={showClearance} onChange={(event) => setShowClearance(event.target.checked)} /> DOOR CLEARANCE</label>
        <label><input type="checkbox" checked={showWallSlots} onChange={(event) => setShowWallSlots(event.target.checked)} /> WALL SLOTS</label>
        <label><input type="checkbox" checked={showProps} onChange={(event) => setShowProps(event.target.checked)} /> PROPS</label>
        <label><input type="checkbox" checked={showPropReservations} onChange={(event) => setShowPropReservations(event.target.checked)} /> PROP USE-SPACE</label>
        <label><input type="checkbox" checked={showActorRoutes} onChange={(event) => setShowActorRoutes(event.target.checked)} /> ACTOR ROUTES</label>
        <label><input type="checkbox" checked={showActors} onChange={(event) => setShowActors(event.target.checked)} /> ACTORS</label>
        <div className="levelgen-debug__viewport-controls" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => zoomAtCenter(1.25)}>−</button>
          <span>{zoomPercent}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAtCenter(0.8)}>+</button>
          <button type="button" className="fit" onClick={fitView}>FIT</button>
        </div>
      </section>

      <section className="levelgen-debug__canvas-wrap">
        <svg
          ref={svgRef}
          className={`levelgen-debug__canvas${isDragging ? " is-dragging" : ""}`}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          role="img"
          aria-label="Generated TS-01 level plan. Drag to pan; use mouse wheel or pinch gesture to zoom."
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <rect className="levelgen-debug__void" x="0" y="0" width={width} height={height} />

          {geometry.spaces.map((space) => {
            const box = rectPixels(space.rect, bounds);
            const semantic = semanticById.get(space.id);
            return (
              <g key={`space-${space.id}`} className={`levelgen-debug__space levelgen-debug__space--${spaceClass(space, semantic?.kind === "room" ? semantic.rationality : undefined)}`}>
                <rect {...box} />
                <text x={box.x + box.width / 2} y={box.y + box.height / 2 - 5} textAnchor="middle">{friendly(space.id)}</text>
                <text className="levelgen-debug__dimension" x={box.x + box.width / 2} y={box.y + box.height / 2 + 13} textAnchor="middle">{space.rect.w}×{space.rect.h}</text>
              </g>
            );
          })}

          <g className="levelgen-debug__grid">
            {verticalGrid.map((x) => <line key={`vx-${x}`} x1={x} y1={PAD} x2={x} y2={height - PAD} />)}
            {horizontalGrid.map((y) => <line key={`hy-${y}`} x1={PAD} y1={y} x2={width - PAD} y2={y} />)}
          </g>

          {showNavigation && (
            <g className="levelgen-debug__navigation">
              {navigation.primaryPathCells.map((cell) => (
                <rect key={`path-${cell.x}-${cell.y}`} x={PAD + (cell.x - bounds.x) * TILE + 8} y={PAD + (cell.y - bounds.y) * TILE + 8} width={TILE - 16} height={TILE - 16} rx="7" />
              ))}
            </g>
          )}

          {showClearance && (
            <g className="levelgen-debug__clearance">
              {geometry.connections.flatMap((connection) => [
                connection.clearanceBefore ? <rect key={`${connection.id}-before`} {...rectPixels(connection.clearanceBefore, bounds)} /> : null,
                connection.clearanceAfter ? <rect key={`${connection.id}-after`} {...rectPixels(connection.clearanceAfter, bounds)} /> : null,
              ])}
            </g>
          )}

          {showPropReservations && (
            <g className="levelgen-debug__prop-reservations">
              {props.reservations.map((reservation) => (
                <rect
                  key={`${reservation.ownerPlacementId}-${reservation.kind}-${reservation.x}-${reservation.y}`}
                  className={reservation.kind}
                  x={PAD + (reservation.x - bounds.x) * TILE + 4}
                  y={PAD + (reservation.y - bounds.y) * TILE + 4}
                  width={TILE - 8}
                  height={TILE - 8}
                  rx="5"
                />
              ))}
            </g>
          )}

          {showProps && (
            <g className="levelgen-debug__props">
              {props.placements.map((placement) => {
                const box = rectPixels(placement.rect, bounds);
                const tooltip = `${placement.id}\n${placement.role} · ${placement.wallSide ?? "floor"} · ${placement.rotation}°\nscore ${placement.score.toFixed(2)}\n${placement.reasons.join(" · ")}\nvalid candidates ${placement.candidateCount}`;
                return (
                  <g key={placement.id} className={`prop prop--${placement.role}`}>
                    <rect {...box} rx="5" />
                    <text x={box.x + box.width / 2} y={box.y + box.height / 2 + 4} textAnchor="middle">{friendly(placement.id)}</text>
                    <title>{tooltip}</title>
                  </g>
                );
              })}
            </g>
          )}

          {showActorRoutes && (
            <g className="levelgen-debug__actor-routes">
              {plan.routes.map((route) => {
                const points = route.cells.map((cell) => {
                  const point = cellCenter(cell, bounds);
                  return `${point.x},${point.y}`;
                }).join(" ");
                return <polyline key={route.id} className={`route route--${route.kind}`} points={points}><title>{`${route.id}\n${route.kind} · ${route.cells.length} cells${route.loop ? " · loop" : ""}`}</title></polyline>;
              })}
            </g>
          )}

          <g className="levelgen-debug__walls">
            {geometry.walls.map((wall) => {
              const x1 = PAD + (wall.x - bounds.x) * TILE;
              const y1 = PAD + (wall.y - bounds.y) * TILE;
              const x2 = wall.orientation === "horizontal" ? x1 + wall.length * TILE : x1;
              const y2 = wall.orientation === "vertical" ? y1 + wall.length * TILE : y1;
              return <line key={wall.id} className={wall.shared ? "shared" : "outer"} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>

          <g className="levelgen-debug__portals">
            {geometry.connections.map((connection) => <line key={connection.id} className={`portal portal--${connection.kind}`} {...connectionLine(connection, bounds)} />)}
          </g>

          {showWallSlots && (
            <g className="levelgen-debug__wall-slots">
              {navigation.wallAttachmentSlots.map((slot) => {
                const cx = PAD + (slot.cell.x - bounds.x + 0.5) * TILE;
                const cy = PAD + (slot.cell.y - bounds.y + 0.5) * TILE;
                return <circle key={slot.id} className={slot.blockedBy.length ? "blocked" : "available"} cx={cx} cy={cy} r="4.5" />;
              })}
            </g>
          )}

          {showActors && (
            <g className="levelgen-debug__actors">
              {plan.actors.map((actor) => {
                const center = cellCenter(actor.cell, bounds);
                const vector = facingVector(actor.facing);
                const tooltip = `${actor.id}\n${actor.behavior} · facing ${actor.facing}°${actor.patrolRouteId ? ` · ${actor.patrolRouteId}` : ""}\nscore ${actor.score.toFixed(2)}\n${actor.reasons.join(" · ")}\nvalid candidates ${actor.candidateCount}`;
                return (
                  <g key={actor.id} className={`actor actor--${actor.behavior}`}>
                    <circle cx={center.x} cy={center.y} r={TILE * 0.27} />
                    <line x1={center.x} y1={center.y} x2={center.x + vector.x * TILE * 0.34} y2={center.y + vector.y * TILE * 0.34} />
                    <text x={center.x} y={center.y + TILE * 0.43} textAnchor="middle">{friendly(actor.id)}</text>
                    <title>{tooltip}</title>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </section>

      <footer className="levelgen-debug__legend">
        <span className="domestic">DOMESTIC</span>
        <span className="corridor">HALL / CIRCULATION</span>
        <span className="ritual">TRANSFER / RITUAL</span>
        <span className="system">PRIMUS / SYSTEM</span>
        <span className="hero-prop">HERO PROP</span>
        <span className="functional-prop">SUPPORT / FURNITURE</span>
        <span className="actor-route">ACTOR ROUTE</span>
        <span className="actor">ACTOR</span>
        <span className="path">PRIMARY PATH</span>
        <span className="clearance">DOOR CLEARANCE</span>
        <span className="door">DOOR / APERTURE</span>
        <span className="gesture">DRAG · WHEEL / PINCH</span>
      </footer>
    </main>
  );
}
