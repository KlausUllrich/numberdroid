import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { ConnectionGeometry, GridRect, SpaceGeometry } from "./geometryTypes";
import type { CardinalDirection, PlacementOverride } from "./types";
import {
  activeOverride,
  compileWorkbenchPlan,
  materializeGeometryLock,
  materializePropLock,
  nudgeLockedGeometry,
  nudgeLockedProp,
  overrideJson,
  regenerateSemanticTarget,
  resetOverride,
  resizeLockedGeometry,
  setPreferredWall,
  tryCompileWorkbenchPlan,
  unlockGeometry,
  unlockProp,
  type WorkbenchSelection,
} from "./workbench";
import "./LevelCompilerDebug.css";

const TILE = 46;
const PAD = 34;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 5;
const WALLS: Array<CardinalDirection | undefined> = [undefined, "north", "east", "south", "west"];

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

export function LevelCompilerWorkbench() {
  const [overrides, setOverrides] = useState<PlacementOverride[]>(() => [...(TS01_LEVEL_SPEC.overrides ?? [])]);
  const [selection, setSelection] = useState<WorkbenchSelection | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const plan = useMemo(() => compileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, overrides), [overrides]);

  const actors = plan.actors;
  const props = actors.props;
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
  const [showEvents, setShowEvents] = useState(true);
  const [viewBox, setViewBox] = useState<ViewBox>(fullViewBox);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewBoxRef = useRef<ViewBox>(fullViewBox);
  const pointersRef = useRef<Map<number, PointerPosition>>(new Map());

  const semanticById = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const verticalGrid = Array.from({ length: bounds.w + 1 }, (_, i) => PAD + i * TILE);
  const horizontalGrid = Array.from({ length: bounds.h + 1 }, (_, i) => PAD + i * TILE);
  const zoomPercent = Math.round((fullViewBox.w / viewBox.w) * 100);
  const selectedSpace = selection?.kind === "space" ? geometry.spaces.find((entry) => entry.id === selection.id) ?? null : null;
  const selectedProp = selection?.kind === "prop" ? props.placements.find((entry) => entry.id === selection.id) ?? null : null;
  const selectedPropRequest = selectedProp ? geometry.semantic.props.find((entry) => entry.id === selectedProp.requestId) ?? null : null;
  const selectedTargetId = selectedSpace?.id ?? selectedPropRequest?.id ?? null;
  const selectedOverride = selectedTargetId ? activeOverride(overrides, selectedTargetId) : null;

  useEffect(() => {
    viewBoxRef.current = fullViewBox;
    setViewBox(fullViewBox);
  }, [fullViewBox]);

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

  function select(event: ReactPointerEvent<SVGElement>, next: WorkbenchSelection) {
    if (!editMode) return;
    event.stopPropagation();
    setSelection(next);
    setEditError(null);
  }

  function applyEdit(factory: () => PlacementOverride[]) {
    try {
      const candidate = factory();
      const result = tryCompileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, candidate);
      if (!result.plan) {
        setEditError(result.error ?? "Unknown compiler error");
        return;
      }
      setOverrides(candidate);
      setEditError(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    }
  }

  function toggleSpaceLock() {
    if (!selectedSpace) return;
    applyEdit(() => selectedOverride?.lockGeometry
      ? unlockGeometry(overrides, selectedSpace.id)
      : materializeGeometryLock(plan, overrides, selectedSpace.id));
  }

  function togglePropLock() {
    if (!selectedProp || !selectedPropRequest) return;
    applyEdit(() => selectedOverride?.lockPlacement
      ? unlockProp(overrides, selectedPropRequest.id)
      : materializePropLock(plan, overrides, selectedProp.id));
  }

  async function copyOverrides() {
    try {
      await navigator.clipboard.writeText(overrideJson(overrides));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setEditError("Clipboard access unavailable; copy the override JSON manually.");
    }
  }

  return (
    <main className="levelgen-debug levelgen-debug--workbench">
      <header className="levelgen-debug__header">
        <div>
          <small>NUMBERDROID · LEVEL COMPILER WORKBENCH v0.12</small>
          <h1>TS-01 · SEMANTIC EDITING</h1>
          <p>Choose a Space or Prop → edit semantic Override → full compiler validation → export Override data</p>
        </div>
        <div className="levelgen-debug__stats">
          <span><b>{geometry.spaces.length}</b> SPACES</span>
          <span><b>{props.placements.length}</b> PROPS</span>
          <span><b>{actors.actors.length}</b> ACTORS</span>
          <span><b>{overrides.length}</b> OVERRIDES</span>
          <span><b>{plan.triggers.length}</b> TRIGGERS</span>
          <span><b>{plan.events.length}</b> EVENTS</span>
        </div>
      </header>

      <section className="levelgen-debug__controls" aria-label="Workbench layers and viewport">
        <label className="edit-mode"><input type="checkbox" checked={editMode} onChange={(event) => setEditMode(event.target.checked)} /> EDIT MODE</label>
        <label><input type="checkbox" checked={showNavigation} onChange={(event) => setShowNavigation(event.target.checked)} /> PRIMARY PATH</label>
        <label><input type="checkbox" checked={showClearance} onChange={(event) => setShowClearance(event.target.checked)} /> DOOR CLEARANCE</label>
        <label><input type="checkbox" checked={showWallSlots} onChange={(event) => setShowWallSlots(event.target.checked)} /> WALL SLOTS</label>
        <label><input type="checkbox" checked={showProps} onChange={(event) => setShowProps(event.target.checked)} /> PROPS</label>
        <label><input type="checkbox" checked={showPropReservations} onChange={(event) => setShowPropReservations(event.target.checked)} /> PROP USE-SPACE</label>
        <label><input type="checkbox" checked={showActorRoutes} onChange={(event) => setShowActorRoutes(event.target.checked)} /> ACTOR ROUTES</label>
        <label><input type="checkbox" checked={showActors} onChange={(event) => setShowActors(event.target.checked)} /> ACTORS</label>
        <label><input type="checkbox" checked={showEvents} onChange={(event) => setShowEvents(event.target.checked)} /> TRIGGERS / EVENTS</label>
        <div className="levelgen-debug__viewport-controls" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => zoomAtCenter(1.25)}>−</button>
          <span>{zoomPercent}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAtCenter(0.8)}>+</button>
          <button type="button" className="fit" onClick={fitView}>FIT</button>
        </div>
      </section>

      <div className="levelgen-workbench__layout">
        <section className="levelgen-debug__canvas-wrap">
          <svg
            ref={svgRef}
            className={`levelgen-debug__canvas${isDragging ? " is-dragging" : ""}`}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            role="img"
            aria-label="Generated TS-01 Level Compiler Workbench. Select Spaces or Props in Edit Mode; drag background to pan."
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <rect className="levelgen-debug__void" x="0" y="0" width={width} height={height} onPointerDown={() => setSelection(null)} />

            {geometry.spaces.map((space) => {
              const box = rectPixels(space.rect, bounds);
              const semantic = semanticById.get(space.id);
              const selected = selection?.kind === "space" && selection.id === space.id;
              return (
                <rect
                  key={`space-${space.id}`}
                  className={`levelgen-debug__space-fill levelgen-debug__space-fill--${spaceClass(space, semantic?.kind === "room" ? semantic.rationality : undefined)}${selected ? " is-selected" : ""}`}
                  {...box}
                  onPointerDown={(event) => select(event, { kind: "space", id: space.id })}
                />
              );
            })}

            <g className="levelgen-debug__grid">
              {verticalGrid.map((x) => <line key={`vx-${x}`} x1={x} y1={PAD} x2={x} y2={height - PAD} />)}
              {horizontalGrid.map((y) => <line key={`hy-${y}`} x1={PAD} y1={y} x2={width - PAD} y2={y} />)}
            </g>

            {showNavigation && <g className="levelgen-debug__navigation">{navigation.primaryPathCells.map((cell) => (
              <rect key={`path-${cell.x}-${cell.y}`} x={PAD + (cell.x - bounds.x) * TILE + 8} y={PAD + (cell.y - bounds.y) * TILE + 8} width={TILE - 16} height={TILE - 16} rx="7" />
            ))}</g>}

            {showClearance && <g className="levelgen-debug__clearance">{navigation.doorClearanceZones.map((zone) => (
              <rect key={zone.id} {...rectPixels(zone.rect, bounds)}><title>{`${zone.connectionId} · ${zone.side} · widened door clearance`}</title></rect>
            ))}</g>}

            {showEvents && <g className="levelgen-debug__trigger-zones">{plan.zones.flatMap((zone) => zone.cells.map((cell) => (
              <rect key={`${zone.id}-${cell.x}-${cell.y}`} x={PAD + (cell.x - bounds.x) * TILE + 3} y={PAD + (cell.y - bounds.y) * TILE + 3} width={TILE - 6} height={TILE - 6} rx="6" />
            )))}</g>}

            {showPropReservations && <g className="levelgen-debug__prop-reservations">{props.reservations.map((reservation) => (
              <rect key={`${reservation.kind}-${reservation.ownerPlacementId}-${reservation.x}-${reservation.y}`} className={reservation.kind} x={PAD + (reservation.x - bounds.x) * TILE + 5} y={PAD + (reservation.y - bounds.y) * TILE + 5} width={TILE - 10} height={TILE - 10} rx="5" />
            ))}</g>}

            {showProps && <g className="levelgen-debug__props">{props.placements.map((placement) => {
              const box = rectPixels(placement.rect, bounds);
              const tooltip = `${placement.id}\n${placement.role} · ${placement.wallSide ?? "floor"} · ${placement.rotation}°\nscore ${placement.score.toFixed(2)}\n${placement.reasons.join(" · ")}\nvalid candidates ${placement.candidateCount}`;
              const selected = selection?.kind === "prop" && selection.id === placement.id;
              return (
                <rect
                  key={placement.id}
                  className={`prop prop--${placement.role}${selected ? " is-selected" : ""}`}
                  {...box}
                  rx="5"
                  onPointerDown={(event) => select(event, { kind: "prop", id: placement.id })}
                >
                  <title>{tooltip}</title>
                </rect>
              );
            })}</g>}

            {showEvents && <g className="levelgen-debug__pickups">{plan.pickups.map((pickup) => {
              const center = cellCenter(pickup.cell, bounds);
              return <rect key={pickup.id} x={center.x - TILE * 0.18} y={center.y - TILE * 0.18} width={TILE * 0.36} height={TILE * 0.36} rx="3" transform={`rotate(45 ${center.x} ${center.y})`}><title>{`${pickup.id}\nkey ${pickup.keyId}\n${pickup.reasons.join(" · ")}`}</title></rect>;
            })}</g>}

            {showActorRoutes && <g className="levelgen-debug__actor-routes">{actors.routes.map((route) => {
              const points = route.cells.map((cell) => { const point = cellCenter(cell, bounds); return `${point.x},${point.y}`; }).join(" ");
              return <polyline key={route.id} className={`route route--${route.kind}`} points={points}><title>{`${route.id}\n${route.kind} · ${route.cells.length} cells${route.loop ? " · loop" : ""}`}</title></polyline>;
            })}</g>}

            <g className="levelgen-debug__walls">{geometry.walls.map((wall) => {
              const x1 = PAD + (wall.x - bounds.x) * TILE;
              const y1 = PAD + (wall.y - bounds.y) * TILE;
              const x2 = wall.orientation === "horizontal" ? x1 + wall.length * TILE : x1;
              const y2 = wall.orientation === "vertical" ? y1 + wall.length * TILE : y1;
              return <line key={wall.id} className={wall.shared ? "shared" : "outer"} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}</g>

            <g className="levelgen-debug__portals">{geometry.connections.map((connection) => <line key={connection.id} className={`portal portal--${connection.kind}`} {...connectionLine(connection, bounds)} />)}</g>

            {showWallSlots && <g className="levelgen-debug__wall-slots">{navigation.wallAttachmentSlots.map((slot) => {
              const cx = PAD + (slot.cell.x - bounds.x + 0.5) * TILE;
              const cy = PAD + (slot.cell.y - bounds.y + 0.5) * TILE;
              return <circle key={slot.id} className={slot.blockedBy.length ? "blocked" : "available"} cx={cx} cy={cy} r="4.5" />;
            })}</g>}

            {showActors && <g className="levelgen-debug__actors">{actors.actors.map((actor) => {
              const center = cellCenter(actor.cell, bounds);
              const vector = facingVector(actor.facing);
              const tooltip = `${actor.id}\n${actor.behavior} · facing ${actor.facing}°${actor.patrolRouteId ? ` · ${actor.patrolRouteId}` : ""}\nscore ${actor.score.toFixed(2)}\n${actor.reasons.join(" · ")}\nvalid candidates ${actor.candidateCount}`;
              return <g key={actor.id} className={`actor actor--${actor.behavior}`}><circle cx={center.x} cy={center.y} r={TILE * 0.27} /><line x1={center.x} y1={center.y} x2={center.x + vector.x * TILE * 0.34} y2={center.y + vector.y * TILE * 0.34} /><title>{tooltip}</title></g>;
            })}</g>}

            {showEvents && <g className="levelgen-debug__triggers">{plan.triggers.filter((trigger) => trigger.source.point).map((trigger) => {
              const point = cellCenter(trigger.source.point!, bounds);
              const size = TILE * 0.22;
              const tooltip = `${trigger.id}\n${trigger.kind} · ${trigger.once ? "once" : "repeat"}${trigger.delayMs ? ` · delay ${trigger.delayMs}ms` : ""}\n${trigger.eventIds.join(" → ")}`;
              return <path key={trigger.id} className={`trigger trigger--${trigger.kind}`} d={`M ${point.x} ${point.y - size} L ${point.x + size} ${point.y} L ${point.x} ${point.y + size} L ${point.x - size} ${point.y} Z`}><title>{tooltip}</title></path>;
            })}</g>}

            {/* Binding rule: labels are ALWAYS the final SVG layer, including in Edit Mode. */}
            <g className="levelgen-debug__labels">
              {geometry.spaces.map((space) => {
                const box = rectPixels(space.rect, bounds);
                return <g key={`label-space-${space.id}`} className="label label--space"><text x={box.x + box.width / 2} y={box.y + box.height / 2 - 5} textAnchor="middle">{friendly(space.id)}</text><text className="dimension" x={box.x + box.width / 2} y={box.y + box.height / 2 + 13} textAnchor="middle">{space.rect.w}×{space.rect.h}</text></g>;
              })}
              {showProps && props.placements.map((placement) => {
                const box = rectPixels(placement.rect, bounds);
                return <text key={`label-prop-${placement.id}`} className={`label label--prop label--${placement.role}`} x={box.x + box.width / 2} y={box.y + box.height / 2 + 4} textAnchor="middle">{friendly(placement.id)}</text>;
              })}
              {showActors && actors.actors.map((actor) => {
                const center = cellCenter(actor.cell, bounds);
                return <text key={`label-actor-${actor.id}`} className="label label--actor" x={center.x} y={center.y + TILE * 0.43} textAnchor="middle">{friendly(actor.id)}</text>;
              })}
              {showEvents && plan.pickups.map((pickup) => {
                const center = cellCenter(pickup.cell, bounds);
                return <text key={`label-pickup-${pickup.id}`} className="label label--pickup" x={center.x} y={center.y - TILE * 0.32} textAnchor="middle">{friendly(pickup.label ?? pickup.id)}</text>;
              })}
              {showEvents && plan.triggers.filter((trigger) => trigger.source.point).map((trigger) => {
                const center = cellCenter(trigger.source.point!, bounds);
                return <text key={`label-trigger-${trigger.id}`} className="label label--trigger" x={center.x + TILE * 0.28} y={center.y + TILE * 0.28} textAnchor="start">{friendly(trigger.id)}</text>;
              })}
            </g>
          </svg>
        </section>

        <aside className="levelgen-workbench__inspector" aria-label="Semantic override inspector">
          <div className="levelgen-workbench__inspector-head">
            <small>SEMANTIC OVERRIDE</small>
            <strong>{selectedSpace ? friendly(selectedSpace.id) : selectedProp ? friendly(selectedProp.id) : "NOTHING SELECTED"}</strong>
            <span>{selectedSpace ? `SPACE · ${selectedSpace.rect.w}×${selectedSpace.rect.h}` : selectedProp ? `PROP · ${selectedProp.rotation}° · ${selectedProp.wallSide ?? "FLOOR"}` : "Select a Space or Prop in Edit Mode."}</span>
          </div>

          {selectedSpace && (
            <>
              <div className="levelgen-workbench__button-row">
                <button className={selectedOverride?.lockGeometry ? "active" : ""} onClick={toggleSpaceLock}>{selectedOverride?.lockGeometry ? "UNLOCK" : "LOCK GEOMETRY"}</button>
                <button onClick={() => applyEdit(() => regenerateSemanticTarget(overrides, selectedSpace.id))}>REGENERATE</button>
              </div>
              <div className="levelgen-workbench__edit-grid">
                <span>MOVE</span>
                <button onClick={() => applyEdit(() => nudgeLockedGeometry(plan, overrides, selectedSpace.id, -1, 0))}>←</button>
                <button onClick={() => applyEdit(() => nudgeLockedGeometry(plan, overrides, selectedSpace.id, 0, -1))}>↑</button>
                <button onClick={() => applyEdit(() => nudgeLockedGeometry(plan, overrides, selectedSpace.id, 0, 1))}>↓</button>
                <button onClick={() => applyEdit(() => nudgeLockedGeometry(plan, overrides, selectedSpace.id, 1, 0))}>→</button>
                <span>SIZE</span>
                <button onClick={() => applyEdit(() => resizeLockedGeometry(plan, overrides, selectedSpace.id, -1, 0))}>W−</button>
                <button onClick={() => applyEdit(() => resizeLockedGeometry(plan, overrides, selectedSpace.id, 1, 0))}>W+</button>
                <button onClick={() => applyEdit(() => resizeLockedGeometry(plan, overrides, selectedSpace.id, 0, -1))}>H−</button>
                <button onClick={() => applyEdit(() => resizeLockedGeometry(plan, overrides, selectedSpace.id, 0, 1))}>H+</button>
              </div>
            </>
          )}

          {selectedProp && selectedPropRequest && (
            <>
              <div className="levelgen-workbench__button-row">
                <button disabled={selectedPropRequest.quantity !== 1} className={selectedOverride?.lockPlacement ? "active" : ""} onClick={togglePropLock}>{selectedOverride?.lockPlacement ? "UNLOCK" : "LOCK PLACEMENT"}</button>
                <button onClick={() => applyEdit(() => regenerateSemanticTarget(overrides, selectedPropRequest.id))}>REGENERATE</button>
              </div>
              {selectedPropRequest.quantity !== 1 && <p className="levelgen-workbench__note">Per-instance locking for quantity &gt; 1 is deliberately deferred; request-level preferences/regeneration remain available.</p>}
              <div className="levelgen-workbench__edit-grid">
                <span>MOVE</span>
                <button disabled={selectedPropRequest.quantity !== 1} onClick={() => applyEdit(() => nudgeLockedProp(plan, overrides, selectedProp.id, -1, 0))}>←</button>
                <button disabled={selectedPropRequest.quantity !== 1} onClick={() => applyEdit(() => nudgeLockedProp(plan, overrides, selectedProp.id, 0, -1))}>↑</button>
                <button disabled={selectedPropRequest.quantity !== 1} onClick={() => applyEdit(() => nudgeLockedProp(plan, overrides, selectedProp.id, 0, 1))}>↓</button>
                <button disabled={selectedPropRequest.quantity !== 1} onClick={() => applyEdit(() => nudgeLockedProp(plan, overrides, selectedProp.id, 1, 0))}>→</button>
              </div>
              <label className="levelgen-workbench__field">PREFERRED WALL
                <select value={selectedOverride?.preferredWall ?? ""} onChange={(event) => applyEdit(() => setPreferredWall(overrides, selectedPropRequest.id, (event.target.value || undefined) as CardinalDirection | undefined))}>
                  {WALLS.map((wall) => <option key={wall ?? "auto"} value={wall ?? ""}>{wall?.toUpperCase() ?? "AUTO"}</option>)}
                </select>
              </label>
            </>
          )}

          {selectedTargetId && <button className="levelgen-workbench__reset" onClick={() => applyEdit(() => resetOverride(overrides, selectedTargetId))}>RESET SELECTED OVERRIDE</button>}
          {editError && <div className="levelgen-workbench__error"><b>EDIT REJECTED</b><span>{editError}</span></div>}

          <div className="levelgen-workbench__export">
            <div><strong>OVERRIDES</strong><button onClick={copyOverrides}>{copied ? "COPIED" : "COPY JSON"}</button></div>
            <pre>{overrideJson(overrides)}</pre>
          </div>
        </aside>
      </div>

      <footer className="levelgen-debug__legend">
        <span className="domestic">DOMESTIC</span><span className="corridor">HALL / CIRCULATION</span><span className="ritual">TRANSFER / RITUAL</span><span className="system">PRIMUS / SYSTEM</span><span className="hero-prop">HERO PROP</span><span className="functional-prop">SUPPORT / FURNITURE</span><span className="actor-route">ACTOR ROUTE</span><span className="actor">ACTOR</span><span className="trigger-zone">TRIGGER ZONE</span><span className="trigger">TRIGGER / EVENT</span><span className="path">PRIMARY PATH</span><span className="clearance">DOOR CLEARANCE</span><span className="door">DOOR / APERTURE</span><span className="gesture">SELECT · DRAG BACKGROUND · WHEEL / PINCH</span>
      </footer>
    </main>
  );
}
