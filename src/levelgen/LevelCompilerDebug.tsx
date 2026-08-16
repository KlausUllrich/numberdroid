import { useMemo, useState } from "react";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigation } from "./navigation";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { ConnectionGeometry, GridRect, SpaceGeometry } from "./geometryTypes";
import "./LevelCompilerDebug.css";

const TILE = 46;
const PAD = 34;

function friendly(id: string) {
  return id.replace(/^family-/, "").replace(/-/g, " ").toUpperCase();
}

function rectPixels(rect: GridRect, bounds: GridRect) {
  return {
    x: PAD + (rect.x - bounds.x) * TILE,
    y: PAD + (rect.y - bounds.y) * TILE,
    width: rect.w * TILE,
    height: rect.h * TILE,
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

export function LevelCompilerDebug() {
  const [showNavigation, setShowNavigation] = useState(true);
  const [showClearance, setShowClearance] = useState(true);
  const [showWallSlots, setShowWallSlots] = useState(false);

  const plan = useMemo(() => {
    const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const geometry = compileLevelGeometry(semantic);
    return compileLevelNavigation(geometry);
  }, []);

  const { geometry, bounds } = plan;
  const width = bounds.w * TILE + PAD * 2;
  const height = bounds.h * TILE + PAD * 2;
  const semanticById = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));

  const verticalGrid = Array.from({ length: bounds.w + 1 }, (_, i) => PAD + i * TILE);
  const horizontalGrid = Array.from({ length: bounds.h + 1 }, (_, i) => PAD + i * TILE);

  return (
    <main className="levelgen-debug">
      <header className="levelgen-debug__header">
        <div>
          <small>NUMBERDROID · LEVEL COMPILER DEBUG</small>
          <h1>TS-01 · GENERATED TOPOLOGY</h1>
          <p>Semantic Spec → Geometry → Shared Wall Graph → Navigation / Forbidden Zones</p>
        </div>
        <div className="levelgen-debug__stats">
          <span><b>{geometry.spaces.length}</b> SPACES</span>
          <span><b>{geometry.walls.length}</b> WALL SEGMENTS</span>
          <span><b>{plan.walkableCells.length}</b> WALKABLE CELLS</span>
          <span><b>{plan.forbiddenCells.length}</b> RESERVED CELLS</span>
        </div>
      </header>

      <section className="levelgen-debug__controls" aria-label="Debug layers">
        <label><input type="checkbox" checked={showNavigation} onChange={(event) => setShowNavigation(event.target.checked)} /> PRIMARY PATH</label>
        <label><input type="checkbox" checked={showClearance} onChange={(event) => setShowClearance(event.target.checked)} /> DOOR CLEARANCE</label>
        <label><input type="checkbox" checked={showWallSlots} onChange={(event) => setShowWallSlots(event.target.checked)} /> WALL SLOTS</label>
      </section>

      <section className="levelgen-debug__canvas-wrap">
        <svg className="levelgen-debug__canvas" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Generated TS-01 level topology">
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
              {plan.primaryPathCells.map((cell) => (
                <rect
                  key={`path-${cell.x}-${cell.y}`}
                  x={PAD + (cell.x - bounds.x) * TILE + 8}
                  y={PAD + (cell.y - bounds.y) * TILE + 8}
                  width={TILE - 16}
                  height={TILE - 16}
                  rx="7"
                />
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
            {geometry.connections.map((connection) => {
              const line = connectionLine(connection, bounds);
              return <line key={connection.id} className={`portal portal--${connection.kind}`} {...line} />;
            })}
          </g>

          {showWallSlots && (
            <g className="levelgen-debug__wall-slots">
              {plan.wallAttachmentSlots.map((slot) => {
                const cx = PAD + (slot.cell.x - bounds.x + 0.5) * TILE;
                const cy = PAD + (slot.cell.y - bounds.y + 0.5) * TILE;
                return <circle key={slot.id} className={slot.blockedBy.length ? "blocked" : "available"} cx={cx} cy={cy} r="4.5" />;
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
        <span className="path">PRIMARY PATH</span>
        <span className="clearance">DOOR CLEARANCE</span>
        <span className="door">DOOR / APERTURE</span>
      </footer>
    </main>
  );
}
