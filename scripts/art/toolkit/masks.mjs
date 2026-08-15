function sidePosition(side, x, y) {
  return side === "L" || side === "R" ? y : x;
}

function isConnectorAt(connectors, side, x, y) {
  const p = sidePosition(side, x, y);
  return connectors.some((connector) => connector.side === side && p >= connector.start && p < connector.end);
}

export function createMask(width, height, predicate) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) mask[y * width + x] = predicate(x, y) ? 1 : 0;
  }
  return mask;
}

export function exposedBoundaryMask({ width, height, mask, connectors = [] }) {
  const boundary = new Uint8Array(width * height);
  const directions = [
    [-1, 0, "L"],
    [1, 0, "R"],
    [0, -1, "T"],
    [0, 1, "B"],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (!mask[p]) continue;
      for (const [dx, dy, side] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (!mask[ny * width + nx]) {
            boundary[p] = 1;
            break;
          }
        } else if (!isConnectorAt(connectors, side, x, y)) {
          boundary[p] = 1;
          break;
        }
      }
    }
  }
  return boundary;
}

export function distanceFromBoundary({ width, height, mask, boundary, maxDistance = Infinity }) {
  const distance = new Int16Array(width * height);
  distance.fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let p = 0; p < boundary.length; p += 1) {
    if (boundary[p] && mask[p]) {
      distance[p] = 0;
      queue[tail++] = p;
    }
  }

  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const p = queue[head++];
    if (distance[p] >= maxDistance) continue;
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const np = ny * width + nx;
      if (!mask[np] || distance[np] >= 0) continue;
      distance[np] = distance[p] + 1;
      queue[tail++] = np;
    }
  }
  return distance;
}
