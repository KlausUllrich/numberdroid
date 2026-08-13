export function requiresLandscape(width: number, height: number, coarsePointer: boolean) {
  return coarsePointer && height > width;
}
