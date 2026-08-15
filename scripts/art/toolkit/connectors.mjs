import { getPixel, setPixel } from "./raster.mjs";

function connectorPixel(width, height, side, position, inward = 0) {
  if (side === "L") return [inward, position];
  if (side === "R") return [width - 1 - inward, position];
  if (side === "T") return [position, inward];
  if (side === "B") return [position, height - 1 - inward];
  throw new Error(`Unknown connector side: ${side}`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function connectorLength(member) {
  const length = member.end - member.start;
  if (length <= 0) throw new Error("Connector segment must have positive length");
  return length;
}

export function canonicalizeConnectorGroup({ width, height, tiles, members, blendPx = 6 }) {
  if (members.length < 2) throw new Error("canonicalizeConnectorGroup requires at least two members");
  const length = connectorLength(members[0]);
  for (const member of members) {
    if (connectorLength(member) !== length) throw new Error("Connector members must have equal strip length");
  }

  const canonical = Array.from({ length }, (_, i) =>
    Array.from({ length: 4 }, (_, channel) => {
      const values = members.map((member) => {
        const position = member.start + i;
        const [x, y] = connectorPixel(width, height, member.side, position, 0);
        return getPixel(tiles[member.tile], width, x, y)[channel];
      });
      return Math.round(median(values));
    }),
  );

  for (const member of members) {
    const tile = tiles[member.tile];
    for (let i = 0; i < length; i += 1) {
      const position = member.start + i;
      for (let inward = 0; inward < blendPx; inward += 1) {
        const [x, y] = connectorPixel(width, height, member.side, position, inward);
        const old = getPixel(tile, width, x, y);
        if (old[3] === 0) continue;
        const weight = Math.max(0, 1 - inward / Math.max(1, blendPx));
        const next = old.map((value, channel) => Math.round(value + weight * (canonical[i][channel] - value)));
        next[3] = 255;
        setPixel(tile, width, x, y, next);
      }
    }
  }

  return canonical;
}

export function meanConnectorDifference({ width, height, tiles, a, b }) {
  const length = connectorLength(a);
  if (connectorLength(b) !== length) throw new Error("Connector comparison requires equal lengths");
  let total = 0;
  let count = 0;

  for (let i = 0; i < length; i += 1) {
    const [ax, ay] = connectorPixel(width, height, a.side, a.start + i, 0);
    const [bx, by] = connectorPixel(width, height, b.side, b.start + i, 0);
    const pa = getPixel(tiles[a.tile], width, ax, ay);
    const pb = getPixel(tiles[b.tile], width, bx, by);
    for (let channel = 0; channel < 4; channel += 1) {
      total += Math.abs(pa[channel] - pb[channel]);
      count += 1;
    }
  }

  return count ? total / count : 0;
}
